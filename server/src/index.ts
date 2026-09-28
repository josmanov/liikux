import express from "express";
import cors from "cors";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/chains", async (_req, res) => {
  const rows = await db.select().from(chains);
  res.json(rows);
});

app.get("/api/gyms", async (_req, res) => {
  const rows = await db.select().from(gyms);
  res.json(rows);
});

app.get("/api/gyms/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  const rows = await db.select().from(gyms).where(eq(gyms.slug, slug)).limit(1);
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
