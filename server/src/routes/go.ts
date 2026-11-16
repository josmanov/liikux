import type express from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chains, gyms, linkClicks } from "../../db/schema.js";

/**
 * Outbound links to a gym's own website go through here, so we can count them:
 *
 *   GET /api/go/:slug?src=button   → adds 1 to today's count, then sends the
 *                                    visitor on to the gym's site
 *   GET /api/admin/clicks?days=30  → the counts (needs ADMIN_KEY)
 *
 * What is stored: the day, the gym and where on our page the link was.
 * Nothing about the visitor (no IP address, no cookie).
 *
 * The visitor is only ever sent to the address saved for that gym in our
 * database, so this cannot be used to redirect people to other sites.
 */

/** Where on the site the link was clicked. Anything else is stored as "other". */
const SOURCES = new Set(["button", "contacts", "bar"]);
const BOTS = /bot|crawl|spider|slurp|preview|monitor|headless|curl|wget/i;

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Adds utm tags, so the gym sees "liikux" as the source in its own statistics. */
function withUtm(raw: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.searchParams.has("utm_source")) {
      url.searchParams.set("utm_source", "liikux");
      url.searchParams.set("utm_medium", "referral");
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function countClick(gymId: string, src: string) {
  try {
    await db
      .insert(linkClicks)
      .values({ day: today(), gymId, src, count: 1 })
      .onConflictDoUpdate({
        target: [linkClicks.day, linkClicks.gymId, linkClicks.src],
        set: { count: sql`${linkClicks.count} + 1` },
      });
  } catch {
    /* table missing or database busy: the visitor still gets to the gym */
  }
}

export function registerGoRoutes(
  app: express.Application,
  adminAllowed: (req: express.Request) => boolean,
) {
  app.get("/api/go/:slug", async (req, res) => {
    const slug = String(req.params.slug ?? "").trim();
    const rows = await db
      .select({ id: gyms.id, www: gyms.www, chainSite: chains.website })
      .from(gyms)
      .leftJoin(chains, eq(chains.id, gyms.chainId))
      .where(and(eq(gyms.slug, slug), eq(gyms.listed, true)))
      .limit(1);
    const gym = rows[0];
    const target = gym ? withUtm(gym.www?.trim() || gym.chainSite?.trim() || "") : null;

    if (!gym || !target) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const src = String(req.query.src ?? "");
    const isBot = BOTS.test(String(req.headers["user-agent"] ?? ""));
    if (!isBot) void countClick(gym.id, SOURCES.has(src) ? src : "other");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.redirect(302, target);
  });

  app.get("/api/admin/clicks", async (req, res) => {
    if (!adminAllowed(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    try {
      const total = sql<number>`sum(${linkClicks.count})::int`;
      const rows = await db
        .select({
          gymId: linkClicks.gymId,
          slug: gyms.slug,
          name: gyms.name,
          city: gyms.city,
          chain: chains.name,
          clicks: total,
        })
        .from(linkClicks)
        .innerJoin(gyms, eq(gyms.id, linkClicks.gymId))
        .leftJoin(chains, eq(chains.id, gyms.chainId))
        .where(gte(linkClicks.day, since))
        .groupBy(linkClicks.gymId, gyms.slug, gyms.name, gyms.city, chains.name)
        .orderBy(desc(total));
      res.json({ days, since, ready: true, rows });
    } catch {
      // Table not created yet (npm run db:push).
      res.json({ days, since, ready: false, rows: [] });
    }
  });
}
