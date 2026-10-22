import "dotenv/config";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

const WOMEN_JSON = '["women"]';

const NEW_LADYLINE: Array<{
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  www?: string;
}> = [
  {
    id: "manual-ladyline-espoo-lippulaiva",
    slug: "ladyline-espoo-lippulaiva",
    name: "LadyLine Espoo Lippulaiva",
    city: "Espoo",
    address: "Espoonlahdenkatu 8 (4. krs), 02320 Espoo",
    lat: 60.1492,
    lng: 24.6574,
    phone: "044 793 6705",
    www: "https://ladyline.fi/toimipiste/espoo-lippulaiva/",
  },
  {
    id: "manual-ladyline-kuopio",
    slug: "ladyline-kuopio",
    name: "LadyLine Kuopio",
    city: "Kuopio",
    address: "Leväsentie 2 B (2. krs), 70700 Kuopio",
    lat: 62.8441,
    lng: 27.6352,
    www: "https://ladyline.fi/toimipiste/kuopio/",
  },
  {
    id: "manual-ladyline-oulu",
    slug: "ladyline-oulu",
    name: "LadyLine Oulu",
    city: "Oulu",
    address: "Poratie 5E, 90140 Oulu",
    lat: 64.996065,
    lng: 25.481026,
    phone: "044 231 5110",
    www: "https://ladyline.fi/toimipiste/oulu/",
  },
];

function looksWomenOnly(name: string) {
  const n = name.trim();
  if (/pornaisten/i.test(n)) return false;
  if (/^lady\s*line/i.test(n) || /^ladyline/i.test(n)) return true;
  if (/^ladyt\b/i.test(n)) return true;
  if (/lady'?s\s*club/i.test(n)) return true;
  if (/\bfor\s+women\b/i.test(n)) return true;
  if (/\bfor\s+ladies\b/i.test(n)) return true;
  if (/\bladies\b/i.test(n)) return true;
  if (/\blady\s*gym\b/i.test(n)) return true;
  if (/\bgym\s*lady\b/i.test(n)) return true;
  if (/^naisten/i.test(n)) return true;
  if (/\bnaisten\s+kunto/i.test(n)) return true;
  if (/\bleidi\b/i.test(n) && /lady/i.test(n)) return true;
  if (/kerhisgym\s*lady/i.test(n)) return true;
  if (/hyvä\s*olo\s*lady/i.test(n)) return true;
  if (/movet\s*ladies/i.test(n)) return true;
  if (/fun\s*for\s*ladies/i.test(n)) return true;
  if (/wellness\s+for\s+women/i.test(n)) return true;
  return false;
}

async function main() {
  const candidates = await db
    .select({
      id: gyms.id,
      name: gyms.name,
      city: gyms.city,
      chainId: gyms.chainId,
      audience: gyms.audienceJson,
      listed: gyms.listed,
      slug: gyms.slug,
    })
    .from(gyms)
    .where(
      or(
        ilike(gyms.name, "%lady%"),
        ilike(gyms.name, "%ladies%"),
        ilike(gyms.name, "%naisten%"),
        ilike(gyms.name, "%leidi%"),
        ilike(gyms.name, "%women%"),
        eq(gyms.chainId, "c8"),
      ),
    );

  let tagged = 0;
  let listed = 0;
  const taggedNames: string[] = [];

  for (const row of candidates) {
    const women =
      row.chainId === "c8" || looksWomenOnly(row.name);
    if (!women) continue;

    const nextListed = true;
    const needsAudience = row.audience !== WOMEN_JSON;
    const needsList = row.listed !== nextListed;
    if (!needsAudience && !needsList) continue;

    await db
      .update(gyms)
      .set({
        audienceJson: WOMEN_JSON,
        listed: nextListed,
        hiddenReason: null,
      })
      .where(eq(gyms.id, row.id));

    tagged += 1;
    if (needsList) listed += 1;
    taggedNames.push(`${row.name} (${row.city})`);
  }

  let inserted = 0;
  const insertedNames: string[] = [];
  for (const g of NEW_LADYLINE) {
    const existing = await db
      .select({ id: gyms.id })
      .from(gyms)
      .where(
        or(eq(gyms.id, g.id), eq(gyms.slug, g.slug), ilike(gyms.name, g.name)),
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(gyms)
        .set({
          chainId: "c8",
          audienceJson: WOMEN_JSON,
          listed: true,
          hiddenReason: null,
          address: g.address,
          city: g.city,
          lat: g.lat,
          lng: g.lng,
          phone: g.phone ?? null,
          www: g.www ?? null,
          name: g.name,
        })
        .where(eq(gyms.id, existing[0]!.id));
      insertedNames.push(`updated ${g.name}`);
      continue;
    }

    await db.insert(gyms).values({
      id: g.id,
      slug: g.slug,
      name: g.name,
      city: g.city,
      address: g.address,
      chainId: "c8",
      lat: g.lat,
      lng: g.lng,
      listed: true,
      phone: g.phone ?? null,
      www: g.www ?? null,
      audienceJson: WOMEN_JSON,
      servicesJson: JSON.stringify([
        "Naisten kuntosali",
        "Ryhmäliikunta",
      ]),
    });
    inserted += 1;
    insertedNames.push(g.name);
  }

  const womenCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gyms)
    .where(
      sql`${gyms.listed} = true AND ${gyms.audienceJson} = ${WOMEN_JSON}`,
    );

  const uusimaaWomen = await db
    .select({
      name: gyms.name,
      city: gyms.city,
      chainId: gyms.chainId,
    })
    .from(gyms)
    .where(
      sql`${gyms.listed} = true
        AND ${gyms.audienceJson} = ${WOMEN_JSON}
        AND ${gyms.city} IN ('Espoo', 'Helsinki', 'Vantaa', 'Porvoo', 'Kauniainen', 'Kerava', 'Järvenpää', 'Hyvinkää', 'Lohja', 'Kirkkonummi')`,
    );

  const ladylineAll = await db
    .select({ name: gyms.name, city: gyms.city, listed: gyms.listed })
    .from(gyms)
    .where(eq(gyms.chainId, "c8"));

  console.log(
    JSON.stringify(
      {
        tagged,
        reListed: listed,
        taggedNames,
        inserted,
        insertedNames,
        listedWomenOnly: womenCount[0]?.n,
        uusimaaWomenListed: uusimaaWomen,
        ladylineLocations: ladylineAll,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
