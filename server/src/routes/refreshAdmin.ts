import type express from "express";
import { and, desc, eq, gte, like } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chains, dataChanges, enrichRuns, gyms, offers, pageHealth } from "../../db/schema.js";
import { clearCache } from "../memoryCache.js";
import { fromLogged, type Field } from "../refresh/apply.js";
import { isActive } from "../offers.js";

/**
 * Admin view of the daily refresh (refresh-data.ts):
 *
 *   GET  /api/admin/refresh                  last run, changes of the last 7 days,
 *                                            held changes, broken pages, offers
 *   POST /api/admin/changes/:id/undo         put the old value back
 *   POST /api/admin/changes/:id/approve      write a held value
 *   POST /api/admin/offers/:id/hide | show   take an offer off the site / back on
 */

const FIELDS: Field[] = ["priceFrom", "hoursWeekday", "hoursWeekend", "is247", "dayPass", "freeTrial", "membershipsJson"];

async function writeField(entityType: string, entityId: string, field: Field, value: unknown) {
  const set = { [field]: value };
  if (entityType === "chain") await db.update(chains).set(set).where(eq(chains.id, entityId));
  else await db.update(gyms).set(set).where(eq(gyms.id, entityId));
}

export function registerRefreshAdminRoutes(
  app: express.Application,
  adminAllowed: (req: express.Request) => boolean,
) {
  const guard = (req: express.Request, res: express.Response) => {
    if (adminAllowed(req)) return true;
    res.status(403).json({ error: "forbidden" });
    return false;
  };

  app.get("/api/admin/refresh", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [runs, recent, held, pages, offerRows, chainRows, gymRows] = await Promise.all([
        db.select().from(enrichRuns).where(like(enrichRuns.id, "refresh-%")).orderBy(desc(enrichRuns.startedAt)).limit(1),
        db.select().from(dataChanges).where(gte(dataChanges.changedAt, since)).orderBy(desc(dataChanges.changedAt)).limit(500),
        db.select().from(dataChanges).where(eq(dataChanges.status, "held")).orderBy(desc(dataChanges.changedAt)),
        db.select().from(pageHealth),
        db.select().from(offers).orderBy(desc(offers.lastSeenAt)),
        db.select({ id: chains.id, name: chains.name }).from(chains),
        db.select({ id: gyms.id, name: gyms.name, slug: gyms.slug }).from(gyms),
      ]);
      const chainName = new Map(chainRows.map((c) => [c.id, c.name]));
      const gymById = new Map(gymRows.map((g) => [g.id, g]));
      const nameOf = (type: string, id: string) => (type === "chain" ? chainName.get(id) : gymById.get(id)?.name) ?? id;
      const withName = <T extends { entityType: string; entityId: string }>(r: T) => ({
        ...r,
        name: nameOf(r.entityType, r.entityId),
        slug: r.entityType === "gym" ? gymById.get(r.entityId)?.slug ?? null : null,
      });

      // Held changes stay held until approved; a newer run may hold the same field again.
      const latestHeld = new Map<string, (typeof held)[number]>();
      for (const h of held) {
        const key = `${h.entityType}|${h.entityId}|${h.field}`;
        if (!latestHeld.has(key)) latestHeld.set(key, h);
      }

      const byChain = new Map<string, { chainId: string; name: string; ok: number; broken: number }>();
      for (const p of pages) {
        const entry = byChain.get(p.chainId) ?? { chainId: p.chainId, name: chainName.get(p.chainId) ?? p.chainId, ok: 0, broken: 0 };
        if (p.ok) entry.ok += 1;
        else entry.broken += 1;
        byChain.set(p.chainId, entry);
      }

      res.json({
        ready: true,
        lastRun: runs[0] ?? null,
        recent: recent.filter((r) => r.status !== "held").map(withName),
        held: [...latestHeld.values()].map(withName),
        chains: [...byChain.values()].sort((a, b) => b.broken - a.broken || a.name.localeCompare(b.name, "fi")),
        brokenPages: pages
          .filter((p) => !p.ok)
          .map((p) => ({ ...p, chain: chainName.get(p.chainId) ?? p.chainId, gym: p.gymId ? gymById.get(p.gymId)?.name ?? null : null })),
        offers: offerRows.map((o) => ({
          ...o,
          active: isActive(o),
          chain: chainName.get(o.chainId) ?? o.chainId,
          gym: o.gymId ? gymById.get(o.gymId)?.name ?? null : null,
        })),
      });
    } catch {
      // Tables do not exist before `npm run db:push`.
      res.json({ ready: false });
    }
  });

  async function change(req: express.Request, res: express.Response, action: "undo" | "approve") {
    if (!guard(req, res)) return;
    const id = String(req.params.id ?? "");
    const rows = await db.select().from(dataChanges).where(eq(dataChanges.id, id)).limit(1);
    const row = rows[0];
    const field = row?.field as Field | undefined;
    if (!row || !field || !FIELDS.includes(field)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (action === "undo" && row.status !== "applied" && row.status !== "approved") {
      res.status(409).json({ error: "only written changes can be undone" });
      return;
    }
    if (action === "approve" && row.status !== "held") {
      res.status(409).json({ error: "only held changes can be approved" });
      return;
    }

    const value = action === "undo" ? row.oldValue : row.newValue;
    await writeField(row.entityType, row.entityId, field, fromLogged(field, value));
    await db.update(dataChanges).set({ status: action === "undo" ? "reverted" : "approved" }).where(eq(dataChanges.id, id));

    // The membership list was held because of the price: approve it together.
    if (action === "approve" && field === "priceFrom") {
      const lists = await db
        .select()
        .from(dataChanges)
        .where(and(eq(dataChanges.runId, row.runId), eq(dataChanges.entityId, row.entityId), eq(dataChanges.field, "membershipsJson"), eq(dataChanges.status, "held")));
      for (const l of lists) {
        await writeField(l.entityType, l.entityId, "membershipsJson", l.newValue);
        await db.update(dataChanges).set({ status: "approved" }).where(eq(dataChanges.id, l.id));
      }
    }
    clearCache();
    res.json({ ok: true });
  }

  app.post("/api/admin/changes/:id/undo", (req, res) => void change(req, res, "undo"));
  app.post("/api/admin/changes/:id/approve", (req, res) => void change(req, res, "approve"));

  async function offerVisibility(req: express.Request, res: express.Response, hide: boolean) {
    if (!guard(req, res)) return;
    const id = String(req.params.id ?? "");
    await db.update(offers).set({ hiddenAt: hide ? new Date().toISOString() : null }).where(eq(offers.id, id));
    clearCache();
    res.json({ ok: true });
  }

  app.post("/api/admin/offers/:id/hide", (req, res) => void offerVisibility(req, res, true));
  app.post("/api/admin/offers/:id/show", (req, res) => void offerVisibility(req, res, false));
}
