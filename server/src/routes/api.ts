import { timingSafeEqual } from "node:crypto";
import type express from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chains, enrichRuns, gyms } from "../../db/schema.js";
import { cached } from "../memoryCache.js";
import {
  fetchListedGymsByChainSlug,
  fetchListedGymsWithChain,
} from "../gymListQuery.js";
import { reverseAddress, searchAddress } from "../geocode/index.js";
import { registerFeedbackRoutes } from "./feedback.js";
import { registerGoRoutes } from "./go.js";
import { allChecks, checksForGym } from "../factChecks.js";
import { activeOffers, offerLookup, offersFor } from "../offers.js";
import { registerRefreshAdminRoutes } from "./refreshAdmin.js";
const LIST_CACHE_MS = 2 * 60 * 1000;
// Browsers keep lists 2 min; the Cloudflare edge (worker.js) keeps them 5 min.
const LIST_CACHE_HEADER = "public, max-age=120, s-maxage=300";

/** The later of two ISO dates (either may be missing). */
function latestDate(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function registerApiRoutes(app: express.Application) {
  app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

  app.get("/api/chains", async (_req, res) => {
  const { data, hit } = await cached("chains-gymcount-v2", LIST_CACHE_MS, async () => {
    const chainRows = await db.select().from(chains);
    const countRows = await db
      .select({
        chainId: gyms.chainId,
        n: sql<number>`count(*)::int`,
        cities: sql<number>`count(distinct nullif(lower(trim(${gyms.city})), ''))::int`,
      })
      .from(gyms)
      .where(eq(gyms.listed, true))
      .groupBy(gyms.chainId);
    const byId = new Map(
      countRows.map((r) => [
        r.chainId,
        { gyms: Number(r.n) || 0, cities: Number(r.cities) || 0 },
      ]),
    );
    return chainRows.map((c) => {
      const stats = byId.get(c.id);
      return {
        ...c,
        gymCount: stats?.gyms ?? 0,
        cityCount: stats?.cities ?? 0,
      };
    });
  });
  res.setHeader("Cache-Control", LIST_CACHE_HEADER);
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

  app.get("/api/chains/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  const { data, hit } = await cached(`chain:${slug}`, LIST_CACHE_MS, async () => {
    const rows = await db
      .select()
      .from(chains)
      .where(eq(chains.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!data) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.setHeader("Cache-Control", LIST_CACHE_HEADER);
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

  app.get("/api/chains/:slug/gyms", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  const { data, hit } = await cached(
    `chain-gyms:${slug}`,
    LIST_CACHE_MS,
    async () => {
      const rows = await fetchListedGymsByChainSlug(slug);
      if (!rows) return rows;
      const hasOffer = offerLookup(await activeOffers());
      return { ...rows, gyms: rows.gyms.map((g) => ({ ...g, hasOffer: hasOffer(g) })) };
    },
  );

  if (!data) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.setHeader("Cache-Control", LIST_CACHE_HEADER);
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

  app.get("/api/gyms", async (_req, res) => {
  const { data, hit } = await cached("gyms-listed-v8", LIST_CACHE_MS, async () => {
    const [rows, offers, checks] = await Promise.all([fetchListedGymsWithChain(), activeOffers(), allChecks()]);
    const hasOffer = offerLookup(offers);
    return rows.map((g) => ({
      ...g,
      hasOffer: hasOffer(g),
      checkedAt: latestDate(g.checkedAt, checks.get(g.id)?.price?.verifiedAt ?? null),
    }));
  });
  res.setHeader("Cache-Control", LIST_CACHE_HEADER);
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

  app.get("/api/stats", async (_req, res) => {
  const { data, hit } = await cached("stats-v2", LIST_CACHE_MS, async () => {
    const rows = await db
      .select({ city: gyms.city, chainId: gyms.chainId })
      .from(gyms)
      .where(eq(gyms.listed, true));
    const chainRows = await db.select({ id: chains.id, slug: chains.slug }).from(chains);
    // Only chains that really have gyms on the site ("muut" = independent gyms).
    const chainsWithGyms = new Set(rows.map((r) => r.chainId));
    const cities = new Set(rows.map((r) => r.city).filter(Boolean));
    return {
      gymCount: rows.length,
      cityCount: cities.size,
      chainCount: chainRows.filter((c) => c.slug !== "muut" && chainsWithGyms.has(c.id)).length,
    };
  });
  res.setHeader("Cache-Control", LIST_CACHE_HEADER);
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

  app.get("/api/gyms/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  const { data, hit } = await cached(`gym-v3:${slug}`, LIST_CACHE_MS, async () => {
    const rows = await db
      .select()
      .from(gyms)
      .where(and(eq(gyms.slug, slug), eq(gyms.listed, true)))
      .limit(1);
    const gym = rows[0];
    if (!gym) return null;
    const chainRows = await db
      .select()
      .from(chains)
      .where(eq(chains.id, gym.chainId))
      .limit(1);
    // checks = what the daily robot confirmed on the gym's own page.
    const checks = await checksForGym(gym.id);
    // offers = campaigns the daily refresh found on the chain's or gym's own pages.
    const offers = offersFor(await activeOffers(), gym);
    return { ...gym, chain: chainRows[0] ?? null, checks, offers };
  });

  if (!data) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.setHeader("Cache-Control", LIST_CACHE_HEADER);
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

function adminAllowed(req: express.Request) {
  const key = process.env.ADMIN_KEY?.trim();
  if (!key) return false;

  const given = String(req.query.key ?? req.headers["x-admin-key"] ?? "").trim();
  const givenBuffer = Buffer.from(given);
  const keyBuffer = Buffer.from(key);
  if (givenBuffer.length !== keyBuffer.length) return false;
  return timingSafeEqual(givenBuffer, keyBuffer);
}

  registerFeedbackRoutes(app, adminAllowed);
  registerGoRoutes(app, adminAllowed);
  registerRefreshAdminRoutes(app, adminAllowed);

  app.get("/api/admin/data-status", async (req, res) => {
  if (!adminAllowed(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const chainRows = await db.select().from(chains);
  const chainById = new Map(chainRows.map((c) => [c.id, c]));
  const gymRows = await db.select().from(gyms).where(eq(gyms.listed, true));
  const checksByGym = await allChecks();

  const rows = gymRows.map((g) => {
    const c = chainById.get(g.chainId);
    const mode = c?.pricingMode ?? "location";
    let price: number | null = g.priceFrom ?? null;
    let priceSource: "sali" | "ketju" | null = price != null ? "sali" : null;
    if (price == null && (mode === "shared" || mode === "hybrid")) {
      price = c?.priceFrom ?? null;
      priceSource = price != null ? "ketju" : null;
    }
    let hours: string | null = g.is247 === true ? "24/7" : g.hoursWeekday ?? null;
    let hoursSource: "sali" | "ketju" | null = hours ? "sali" : null;
    if (!hours && mode === "shared") {
      hours = c?.is247 === true ? "24/7" : c?.hoursWeekday ?? null;
      hoursSource = hours ? "ketju" : null;
    }
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      city: g.city,
      chainId: g.chainId,
      chain: c?.name ?? g.chainId,
      pricingMode: mode,
      price,
      priceSource,
      hours,
      hoursSource,
      www: g.www,
      checkedAt: g.offerCheckedAt ?? (priceSource === "ketju" ? c?.checkedAt ?? null : null),
      status: g.enrichStatus ?? (mode === "shared" ? "chain" : null),
      missReason: g.missReason ?? null,
      sourceUrl: g.offerSourceUrl ?? (priceSource === "ketju" ? c?.sourceUrl ?? null : null),
      method: g.offerMethod ?? (priceSource === "ketju" ? "chain" : null),
      priceCheck: checksByGym.get(g.id)?.price ?? null,
      hoursCheck: checksByGym.get(g.id)?.hours ?? null,
    };
  });

  res.json(rows);
});

  app.get("/api/admin/enrich-runs", async (req, res) => {
  if (!adminAllowed(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const rows = await db
    .select()
    .from(enrichRuns)
    .orderBy(desc(enrichRuns.startedAt))
    .limit(20);
  res.json(rows);
});
  app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json([]);
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  // Round the user's position (~1 km) so nearby users share cached answers.
  const bias =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
      : undefined;
  const cacheKey =
    "geocode:" + q.toLowerCase() + (bias ? `:${bias.lat},${bias.lng}` : "");

  try {
    // Addresses do not move: keep answers for a day.
    const { data, hit } = await cached(cacheKey, 24 * 60 * 60 * 1000, () =>
      searchAddress(q, bias),
    );
    // Addresses rarely change: let browsers and the Cloudflare edge reuse answers.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.setHeader("X-Cache", hit ? "HIT" : "MISS");
    res.json(data);
  } catch {
    res.status(502).json([]);
  }
});
  app.get("/api/geocode/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json(null);
    return;
  }

  const cacheKey = `rev-street:${lat.toFixed(4)},${lng.toFixed(4)}`;
  try {
    const { data, hit } = await cached(cacheKey, 10 * 60 * 1000, () =>
      reverseAddress(lat, lng),
    );
    res.setHeader("X-Cache", hit ? "HIT" : "MISS");
    res.json(data);
  } catch {
    res.status(502).json(null);
  }
});
}
