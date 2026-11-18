import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

/**
 * Makes every town that has gyms a real city on the site.
 *
 * Reads the listed gyms and writes client/src/data/cities.generated.ts:
 * one row per town with its name (as written on the gyms), a URL slug, the
 * region (maakunta) and a centre point (average of its gyms).
 * The region is found by checking which region's border each gym is inside
 * (client/public/geo/maakunnat.json); the most common answer wins.
 *
 * Run again when gyms are added or moved:  npm run db:cities
 */

type Ring = [number, number][];
type Feature = { properties: { nimi: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } };

const OUT = "../client/src/data/cities.generated.ts";
const REGIONS_FILE = "../client/public/geo/maakunnat.json";

/** Same rule as toCitySlug in client/src/data/citySlug.ts. */
function toCitySlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonsOf(f: Feature): Ring[][] {
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][]);
}

function regionAt(lng: number, lat: number, features: Feature[]) {
  for (const f of features) {
    for (const poly of polygonsOf(f)) {
      const [outer, ...holes] = poly;
      if (outer && inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) return f.properties.nimi;
    }
  }
  return null;
}

async function main() {
  const features = (JSON.parse(readFileSync(REGIONS_FILE, "utf8")) as { features: Feature[] }).features;
  const rows = await db.select({ city: gyms.city, lat: gyms.lat, lng: gyms.lng }).from(gyms).where(eq(gyms.listed, true));

  type Acc = { names: Map<string, number>; lat: number; lng: number; n: number; regions: Map<string, number> };
  const bySlug = new Map<string, Acc>();
  for (const r of rows) {
    const name = r.city?.trim();
    if (!name || r.lat == null || r.lng == null) continue;
    const slug = toCitySlug(name);
    if (!slug) continue;
    const acc = bySlug.get(slug) ?? { names: new Map(), lat: 0, lng: 0, n: 0, regions: new Map() };
    acc.names.set(name, (acc.names.get(name) ?? 0) + 1);
    acc.lat += r.lat;
    acc.lng += r.lng;
    acc.n += 1;
    const region = regionAt(r.lng, r.lat, features);
    if (region) acc.regions.set(region, (acc.regions.get(region) ?? 0) + 1);
    bySlug.set(slug, acc);
  }

  const most = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const cities = [...bySlug.entries()]
    .map(([slug, a]) => ({
      name: most(a.names)!,
      slug,
      region: most(a.regions),
      lat: Math.round((a.lat / a.n) * 10000) / 10000,
      lng: Math.round((a.lng / a.n) * 10000) / 10000,
      gyms: a.n,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fi"));

  const noRegion = cities.filter((c) => !c.region);
  const body = cities
    .filter((c) => c.region)
    .map((c) => `  { name: ${JSON.stringify(c.name)}, slug: "${c.slug}", region: ${JSON.stringify(c.region)}, lat: ${c.lat}, lng: ${c.lng}, gyms: ${c.gyms} },`)
    .join("\n");

  writeFileSync(
    OUT,
    `// Made by server/src/export-cities.ts (npm run db:cities). Do not edit by hand.
// Every town with listed gyms: name, URL slug, region, centre of its gyms and
// how many gyms it had when this file was made (the site counts live).

export type GeneratedCity = {
  name: string;
  slug: string;
  region: string;
  lat: number;
  lng: number;
  gyms: number;
};

export const GENERATED_CITIES: GeneratedCity[] = [
${body}
];
`,
  );

  console.log(`${cities.length} towns, ${noRegion.length} without a region (left out): ${noRegion.map((c) => c.name).join(", ") || "-"}`);
  for (const name of ["Asikkala", "Kauniainen", "Helsinki", "Vantaa"]) {
    const c = cities.find((x) => x.name === name);
    console.log(`  ${name}: ${c ? `${c.region}, ${c.gyms} gyms` : "missing"}`);
  }
  console.log(`Wrote ${OUT.replace("../", "")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
