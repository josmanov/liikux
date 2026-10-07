import express from "express";
import cors from "cors";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { chains, enrichRuns, gyms } from "../db/schema.js";
import { cached } from "./memoryCache.js";
import {
  fetchListedGymsByChainSlug,
  fetchListedGymsWithChain,
} from "./gymListQuery.js";
import { rateLimit } from "./rateLimit.js";

const app = express();
const PORT = 3001;
const LIST_CACHE_MS = 2 * 60 * 1000;

app.use(cors());
app.use(express.json());

const apiLimit = rateLimit({ windowMs: 60_000, max: 120 });
app.use("/api", apiLimit);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/chains", async (_req, res) => {
  const { data, hit } = await cached("chains", LIST_CACHE_MS, () =>
    db.select().from(chains),
  );
  res.setHeader("Cache-Control", "public, max-age=120");
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

  res.setHeader("Cache-Control", "public, max-age=120");
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
    () => fetchListedGymsByChainSlug(slug),
  );

  if (!data) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=120");
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

app.get("/api/gyms", async (_req, res) => {
  const { data, hit } = await cached("gyms-listed-v4", LIST_CACHE_MS, () =>
    fetchListedGymsWithChain(),
  );
  res.setHeader("Cache-Control", "public, max-age=120");
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

app.get("/api/stats", async (_req, res) => {
  const { data, hit } = await cached("stats", LIST_CACHE_MS, async () => {
    const rows = await db
      .select({ city: gyms.city })
      .from(gyms)
      .where(eq(gyms.listed, true));
    const chainRows = await db.select({ slug: chains.slug }).from(chains);
    const cities = new Set(rows.map((r) => r.city).filter(Boolean));
    return {
      gymCount: rows.length,
      cityCount: cities.size,
      chainCount: chainRows.filter((c) => c.slug !== "muut").length,
    };
  });
  res.setHeader("Cache-Control", "public, max-age=120");
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(data);
});

app.get("/api/gyms/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  const rows = await db
    .select()
    .from(gyms)
    .where(and(eq(gyms.slug, slug), eq(gyms.listed, true)))
    .limit(1);
  const gym = rows[0];
  if (!gym) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const chainRows = await db
    .select()
    .from(chains)
    .where(eq(chains.id, gym.chainId))
    .limit(1);

  res.json({
    ...gym,
    chain: chainRows[0] ?? null,
  });
});

function adminAllowed(req: express.Request) {
  const key = process.env.ADMIN_KEY;
  if (!key) return true;
  const given = String(req.query.key ?? req.headers["x-admin-key"] ?? "");
  return given === key;
}

app.get("/api/admin/data-status", async (req, res) => {
  if (!adminAllowed(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const chainRows = await db.select().from(chains);
  const chainById = new Map(chainRows.map((c) => [c.id, c]));
  const gymRows = await db.select().from(gyms).where(eq(gyms.listed, true));

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

const GEOCODE_CITIES = [
  "Helsinki",
  "Espoo",
  "Vantaa",
  "Tampere",
  "Turku",
  "Oulu",
  "Jyväskylä",
  "Lahti",
  "Kuopio",
  "Pori",
  "Seinäjoki",
  "Orimattila",
  "Orivesi",
  "Joensuu",
  "Kouvola",
  "Hämeenlinna",
];

type GeocodeHit = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type NominatimRow = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

function parseStreetQuery(q: string) {
  const m = q.match(/^(.+?)\s+(\d+\s*[a-zA-ZäöåÄÖÅ]?)\s*$/);
  if (!m) return { street: q, number: "" };
  return { street: m[1].trim(), number: m[2].trim() };
}

function labelFromAddress(a: Record<string, string>, displayName: string) {
  const road = a.road || a.pedestrian || a.street || "";
  const num = a.house_number || "";
  const city = a.city || a.town || a.municipality || a.village || "";
  if (road && num && city) return `${road} ${num}, ${city}`;
  if (road && city) return `${road}, ${city}`;
  if (city && !road) return city;
  return displayName
    .split(",")
    .slice(0, 3)
    .map((p) => p.trim())
    .join(", ");
}

function hitFromNominatim(row: NominatimRow): GeocodeHit {
  const a = row.address ?? {};
  return {
    id: String(row.place_id),
    label: labelFromAddress(a, row.display_name),
    lat: Number(row.lat),
    lng: Number(row.lon),
  };
}

async function nominatimSearch(q: string, limit: number) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      format: "json",
      q,
      countrycodes: "fi",
      limit: String(limit),
      addressdetails: "1",
    });

  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "Liikux/1.0 (localhost dev)",
      "Accept-Language": "fi",
    },
  });
  if (!upstream.ok) return [] as GeocodeHit[];
  const rows = (await upstream.json()) as NominatimRow[];
  return rows.map(hitFromNominatim);
}

async function photonSearch(q: string) {
  const url =
    "https://photon.komoot.io/api/?" +
    new URLSearchParams({
      q,
      lang: "en",
      limit: "14",
      bbox: "19.5,59.5,31.6,70.1",
    });

  const upstream = await fetch(url, {
    headers: { "Accept-Language": "fi" },
  });
  if (!upstream.ok) return [] as GeocodeHit[];

  const data = (await upstream.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[] };
      properties?: Record<string, string | number | undefined>;
    }>;
  };

  if (!Array.isArray(data.features)) return [] as GeocodeHit[];

  const hits: GeocodeHit[] = [];
  for (const f of data.features) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const country = String(p.countrycode || "").toUpperCase();
    if (country && country !== "FI") continue;

    const road = String(p.street || p.name || "");
    const num = String(p.housenumber || "");
    const city = String(p.city || p.town || p.village || "");
    let label = "";
    if (road && num && city) label = `${road} ${num}, ${city}`;
    else if (road && city) label = `${road}, ${city}`;
    else if (city) label = city;
    else label = String(p.name || p.street || q);
    if (!label.trim()) continue;

    hits.push({
      id: `ph-${p.osm_id ?? label}-${coords[0]}-${coords[1]}`,
      label,
      lat: coords[1],
      lng: coords[0],
    });
  }
  return hits;
}

function dedupeHits(hits: GeocodeHit[]) {
  const seen = new Set<string>();
  const out: GeocodeHit[] = [];
  for (const h of hits) {
    const key = h.label.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function rankHits(hits: GeocodeHit[], q: string, number: string) {
  const ql = q.toLowerCase();
  return [...hits].sort((a, b) => {
    const aNum =
      number && a.label.toLowerCase().includes(number.toLowerCase()) ? 0 : 1;
    const bNum =
      number && b.label.toLowerCase().includes(number.toLowerCase()) ? 0 : 1;
    if (aNum !== bNum) return aNum - bNum;
    const aExact = a.label.toLowerCase().startsWith(ql) ? 0 : 1;
    const bExact = b.label.toLowerCase().startsWith(ql) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.label.localeCompare(b.label, "fi");
  });
}

app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const { number } = parseStreetQuery(q);
    const hits = await photonSearch(q);
    res.json(rankHits(dedupeHits(hits), q, number).slice(0, 6));
  } catch {
    res.status(502).json([]);
  }
});

app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
