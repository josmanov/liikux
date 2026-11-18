import type express from "express";
import { and, desc, eq, gte, inArray, like } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chains, dataChanges, enrichRuns, gyms, offers, pageHealth } from "../../db/schema.js";
import { clearCache } from "../memoryCache.js";
import { fromLogged, type Field } from "../refresh/apply.js";
import { isActive } from "../offers.js";

/**
 * The review page (/admin/tarkistus). The daily refresh never writes to the
 * site by itself: every new value and offer waits here for a person.
 *
 *   GET  /api/admin/refresh                     everything waiting + last 7 days + broken pages
 *   POST /api/admin/changes/approve  {ids}      write the new values to the site
 *   POST /api/admin/changes/reject   {ids}      keep the old values
 *   POST /api/admin/changes/:id/undo            put an approved value back to the old one
 *   POST /api/admin/offers/:id/approve | reject | hide | show
 */

const FIELDS: Field[] = ["priceFrom", "hoursWeekday", "hoursWeekend", "is247", "dayPass", "freeTrial", "membershipsJson"];

async function writeField(entityType: string, entityId: string, field: Field, value: unknown, sourceUrl: string | null) {
  const now = new Date().toISOString();
  if (entityType === "chain") {
    await db
      .update(chains)
      .set({ [field]: value, checkedAt: now.slice(0, 10), ...(sourceUrl ? { sourceUrl } : {}) })
      .where(eq(chains.id, entityId));
  } else {
    await db
      .update(gyms)
      .set({ [field]: value, offerCheckedAt: now, offerMethod: "refresh", ...(sourceUrl ? { offerSourceUrl: sourceUrl } : {}) })
      .where(eq(gyms.id, entityId));
  }
}

function idsFrom(req: express.Request): string[] {
  const raw = (req.body as { ids?: unknown } | undefined)?.ids;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 2000) : [];
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
      const [runs, waiting, recent, pages, offerRows, chainRows, gymRows] = await Promise.all([
        db.select().from(enrichRuns).where(like(enrichRuns.id, "refresh-%")).orderBy(desc(enrichRuns.startedAt)).limit(1),
        db.select().from(dataChanges).where(eq(dataChanges.status, "held")).orderBy(desc(dataChanges.changedAt)),
        db
          .select()
          .from(dataChanges)
          .where(and(gte(dataChanges.changedAt, since), inArray(dataChanges.status, ["approved", "rejected", "reverted"])))
          .orderBy(desc(dataChanges.changedAt))
          .limit(300),
        db.select().from(pageHealth),
        db.select().from(offers).orderBy(desc(offers.lastSeenAt)),
        db.select({ id: chains.id, name: chains.name }).from(chains),
        db.select({ id: gyms.id, name: gyms.name, slug: gyms.slug, city: gyms.city, chainId: gyms.chainId }).from(gyms),
      ]);
      const chainName = new Map(chainRows.map((c) => [c.id, c.name]));
      const gymById = new Map(gymRows.map((g) => [g.id, g]));
      const withName = <T extends { entityType: string; entityId: string }>(r: T) => {
        const g = r.entityType === "gym" ? gymById.get(r.entityId) : undefined;
        return {
          ...r,
          name: r.entityType === "chain" ? chainName.get(r.entityId) ?? r.entityId : g?.name ?? r.entityId,
          city: g?.city ?? null,
          chain: r.entityType === "chain" ? chainName.get(r.entityId) ?? null : g ? chainName.get(g.chainId) ?? null : null,
          slug: g?.slug ?? null,
        };
      };

      const byChain = new Map<string, { chainId: string; name: string; ok: number; broken: number }>();
      for (const p of pages) {
        const entry = byChain.get(p.chainId) ?? { chainId: p.chainId, name: chainName.get(p.chainId) ?? p.chainId, ok: 0, broken: 0 };
        if (p.ok) entry.ok += 1;
        else entry.broken += 1;
        byChain.set(p.chainId, entry);
      }

      const offerOut = offerRows.map((o) => ({
        ...o,
        active: isActive(o),
        chain: chainName.get(o.chainId) ?? o.chainId,
        gym: o.gymId ? gymById.get(o.gymId)?.name ?? null : null,
      }));

      res.json({
        ready: true,
        lastRun: runs[0] ?? null,
        waiting: waiting.map(withName),
        recent: recent.map(withName),
        chains: [...byChain.values()].sort((a, b) => b.broken - a.broken || a.name.localeCompare(b.name, "fi")),
        brokenPages: pages
          .filter((p) => !p.ok)
          .map((p) => ({ ...p, chain: chainName.get(p.chainId) ?? p.chainId, gym: p.gymId ? gymById.get(p.gymId)?.name ?? null : null })),
        offersWaiting: offerOut.filter((o) => o.status === "pending"),
        offersLive: offerOut.filter((o) => o.status === "approved"),
      });
    } catch {
      // Tables do not exist before `npm run db:push`.
      res.json({ ready: false });
    }
  });

  /** Approve or reject several waiting changes at once. */
  async function decide(req: express.Request, res: express.Response, action: "approve" | "reject") {
    if (!guard(req, res)) return;
    const ids = idsFrom(req);
    if (!ids.length) {
      res.status(400).json({ error: "ids required" });
      return;
    }
    const rows = await db.select().from(dataChanges).where(and(inArray(dataChanges.id, ids), eq(dataChanges.status, "held")));
    let done = 0;
    for (const row of rows) {
      const field = row.field as Field;
      if (!FIELDS.includes(field)) continue;
      if (action === "approve") await writeField(row.entityType, row.entityId, field, fromLogged(field, row.newValue), row.sourceUrl);
      await db
        .update(dataChanges)
        .set({ status: action === "approve" ? "approved" : "rejected", changedAt: new Date().toISOString() })
        .where(eq(dataChanges.id, row.id));
      done += 1;
    }
    if (action === "approve") clearCache();
    res.json({ ok: true, done });
  }

  app.post("/api/admin/changes/approve", (req, res) => void decide(req, res, "approve"));
  app.post("/api/admin/changes/reject", (req, res) => void decide(req, res, "reject"));

  app.post("/api/admin/changes/:id/undo", async (req, res) => {
    if (!guard(req, res)) return;
    const rows = await db.select().from(dataChanges).where(eq(dataChanges.id, String(req.params.id ?? ""))).limit(1);
    const row = rows[0];
    const field = row?.field as Field | undefined;
    if (!row || !field || !FIELDS.includes(field) || row.status !== "approved") {
      res.status(409).json({ error: "only approved changes can be undone" });
      return;
    }
    await writeField(row.entityType, row.entityId, field, fromLogged(field, row.oldValue), null);
    await db.update(dataChanges).set({ status: "reverted" }).where(eq(dataChanges.id, row.id));
    clearCache();
    res.json({ ok: true });
  });

  async function offerStatus(req: express.Request, res: express.Response, set: Partial<typeof offers.$inferInsert>) {
    if (!guard(req, res)) return;
    await db.update(offers).set(set).where(eq(offers.id, String(req.params.id ?? "")));
    clearCache();
    res.json({ ok: true });
  }

  app.post("/api/admin/offers/:id/approve", (req, res) => void offerStatus(req, res, { status: "approved", hiddenAt: null }));
  app.post("/api/admin/offers/:id/reject", (req, res) => void offerStatus(req, res, { status: "rejected" }));
  app.post("/api/admin/offers/:id/hide", (req, res) => void offerStatus(req, res, { status: "rejected", hiddenAt: new Date().toISOString() }));
}
