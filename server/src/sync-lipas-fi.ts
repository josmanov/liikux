import "dotenv/config";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const TYPE_CODES = "2120,2110";
const PAGE_SIZE = 100;

const OTHER_CHAIN = {
  id: "c-other",
  slug: "muut",
  name: "Muut",
  image: "/pins/gym-pin.png",
  logoFit: "contain",
};

const brandHints: { match: RegExp; chainId: string }[] = [
  { match: /elixia/i, chainId: "c2" },
  { match: /easy\s*fit|easyfit/i, chainId: "c1" },
  { match: /fressi/i, chainId: "c3" },
  { match: /fitness\s*24|24\s*seven/i, chainId: "c4" },
  { match: /go\s*fitness/i, chainId: "c5" },
  { match: /\bliikku\b/i, chainId: "c6" },
  { match: /\bforever\b/i, chainId: "c7" },
  { match: /lady\s*line|ladyline/i, chainId: "c8" },
  { match: /ole\.?\s*fit/i, chainId: "c9" },
  { match: /\besport\b/i, chainId: "c10" },
  { match: /unisport/i, chainId: "c11" },
  { match: /m\s*&\s*m\b|m&m/i, chainId: "c12" },
];

const RESIDENTS_NAME =
  /palvelutalo|palvelukesk|seniorikuntosali|hoivakoti|vanhainkoti|asukaskuntosali|asukkaiden kuntosali/i;

const SCHOOL_NAME =
  /(lukion|ammattikoulun|yhtenäiskoulun|peruskoulun|yläkoulun|alakoulun|yhteiskoulun|opiston)\s+kuntosali|koulun\s+kuntosali/i;

const RESTRICTED_TEXT =
  /vain\s+.*(jäsen|asukka|henkilö|opiskel|oppila|työntek)|yrityskohtai|ei\s+(ole\s+)?avoin|ei\s+yleisö|suljettu\s+yleisöltä|henkilökunnan\s+käyt|asukkaiden\s+käyt|oppilaiden\s+(ja\s+henkilökunnan\s+)?käyt/i;

type LipasItem = {
  "lipas-id": number;
  name?: string;
  comment?: string;
  www?: string;
  email?: string;
  "phone-number"?: string;
  location?: {
    address?: string;
    "postal-office"?: string;
    "postal-code"?: string;
    geometries?: {
      features?: Array<{
        geometry?: {
          type?: string;
          coordinates?: number[] | number[][] | number[][][];
        };
      }>;
    };
  };
  properties?: {
    "school-use?"?: boolean;
  };
};

function cleanText(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  return v ? v : null;
}

function cleanWww(raw: string | undefined | null): string | null {
  let v = (raw ?? "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

function slugify(name: string, lipasId: number) {
  const base = name
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "sali"}-${lipasId}`;
}

function chainForName(name: string) {
  for (const hint of brandHints) {
    if (hint.match.test(name)) return hint.chainId;
  }
  return OTHER_CHAIN.id;
}

const MANUAL_CLOSED_LIPAS_IDS = new Set([
  519104,
]);

function hideReasonFor(item: LipasItem, name: string): string | null {
  const lipasId = item["lipas-id"];
  if (lipasId && MANUAL_CLOSED_LIPAS_IDS.has(lipasId)) return "closed";
  if (item.properties?.["school-use?"] === true) return "school";
  if (SCHOOL_NAME.test(name)) return "school";
  if (RESIDENTS_NAME.test(name)) return "residents_only";
  const comment = (item.comment ?? "").trim();
  if (comment && RESTRICTED_TEXT.test(comment)) return "members_only";
  if (RESTRICTED_TEXT.test(name)) return "members_only";
  return null;
}

function pointFromItem(item: LipasItem): { lat: number; lng: number } | null {
  const features = item.location?.geometries?.features ?? [];
  for (const f of features) {
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const c = g.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

async function fetchAllFinland(): Promise<LipasItem[]> {
  const out: LipasItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url =
      "https://api.lipas.fi/v2/sports-sites?" +
      new URLSearchParams({
        "type-codes": TYPE_CODES,
        statuses: "active",
        page: String(page),
        "page-size": String(PAGE_SIZE),
      });

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Liikux/1.0 (dev sync)",
      },
    });
    if (!res.ok) {
      throw new Error(`Lipas HTTP ${res.status} page ${page}`);
    }
    const data = (await res.json()) as {
      items: LipasItem[];
      pagination: { "total-pages": number; "total-items": number };
    };
    out.push(...(data.items ?? []));
    totalPages = data.pagination?.["total-pages"] ?? 1;
    console.log(
      `Lipas page ${page}/${totalPages} (+${data.items?.length ?? 0}, total ${data.pagination?.["total-items"]})`,
    );
    page += 1;
  }

  return out;
}

async function sync() {
  await db.insert(chains).values(OTHER_CHAIN).onConflictDoNothing();

  const existingDead = await db
    .select({ id: gyms.id, wwwDead: gyms.wwwDead })
    .from(gyms);
  const deadById = new Map(
    existingDead
      .filter((r) => (r.wwwDead ?? "").trim())
      .map((r) => [r.id, (r.wwwDead ?? "").trim()]),
  );

  const items = await fetchAllFinland();
  let ok = 0;
  let skip = 0;
  let skippedDeadWww = 0;
  const hideCounts: Record<string, number> = {};
  const batch: {
    id: string;
    slug: string;
    name: string;
    city: string;
    address: string;
    chainId: string;
    lat: number;
    lng: number;
    listed: boolean;
    hiddenReason: string | null;
    www: string | null;
    wwwDead: string | null;
    phone: string | null;
    email: string | null;
  }[] = [];

  let withWww = 0;
  let withPhone = 0;
  let withEmail = 0;

  for (const item of items) {
    const lipasId = item["lipas-id"];
    const name = (item.name ?? "").trim();
    const point = pointFromItem(item);
    if (!lipasId || !name || !point) {
      skip += 1;
      continue;
    }

    const city = (item.location?.["postal-office"] ?? "").trim() || "Suomi";
    const addressParts = [
      item.location?.address,
      item.location?.["postal-code"],
      city,
    ].filter(Boolean);

    const reason = hideReasonFor(item, name);
    if (reason) hideCounts[reason] = (hideCounts[reason] ?? 0) + 1;

    const id = `lipas-${lipasId}`;
    const lipasWww = cleanWww(item.www);
    const prevDead = deadById.get(id) ?? null;
    let www = lipasWww;
    let wwwDead = prevDead;
    if (lipasWww && prevDead && lipasWww === prevDead) {
      www = null;
      skippedDeadWww += 1;
    } else if (lipasWww && lipasWww !== prevDead) {
      wwwDead = null;
    }

    const phone = cleanText(item["phone-number"]);
    const email = cleanText(item.email);
    if (www) withWww += 1;
    if (phone) withPhone += 1;
    if (email) withEmail += 1;

    batch.push({
      id,
      slug: slugify(name, lipasId),
      name,
      city,
      address: addressParts.join(", ") || city,
      chainId: chainForName(name),
      lat: point.lat,
      lng: point.lng,
      listed: reason == null,
      hiddenReason: reason,
      www,
      wwwDead,
      phone,
      email,
    });
  }

  const CHUNK = 50;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK);
    for (const row of slice) {
      await db
        .insert(gyms)
        .values(row)
        .onConflictDoUpdate({
          target: gyms.id,
          set: {
            slug: row.slug,
            name: row.name,
            city: row.city,
            address: row.address,
            chainId: row.chainId,
            lat: row.lat,
            lng: row.lng,
            listed: row.listed,
            hiddenReason: row.hiddenReason,
            www: row.www,
            wwwDead: row.wwwDead,
            phone: row.phone,
            email: row.email,
          },
        });
      ok += 1;
    }
    console.log(`DB upsert ${Math.min(i + CHUNK, batch.length)}/${batch.length}`);
  }

  const hiddenTotal = Object.values(hideCounts).reduce((a, b) => a + b, 0);
  console.log(`Finland sync OK: ${ok} gyms upserted, ${skip} skipped`);
  console.log(
    `Hidden ${hiddenTotal}: ${Object.entries(hideCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "none"}`,
  );
  console.log(`Listed: ${ok - hiddenTotal}`);
  console.log(`Contact: www=${withWww}, phone=${withPhone}, email=${withEmail}`);
  console.log(`Kept dead www cleared: ${skippedDeadWww}`);
  process.exit(0);
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
