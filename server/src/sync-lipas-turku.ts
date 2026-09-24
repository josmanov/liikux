import "dotenv/config";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const TURKU_CITY_CODE = "853";
const TYPE_CODES = "2120,2110";
const PAGE_SIZE = 50;

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
];

type LipasItem = {
  "lipas-id": number;
  name?: string;
  www?: string;
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
};

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

async function fetchAllTurku(): Promise<LipasItem[]> {
  const out: LipasItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url =
      "https://api.lipas.fi/v2/sports-sites?" +
      new URLSearchParams({
        "type-codes": TYPE_CODES,
        "city-codes": TURKU_CITY_CODE,
        statuses: "active",
        page: String(page),
        "page-size": String(PAGE_SIZE),
      });

    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Liikux/1.0 (dev sync)" },
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
      `Lipas page ${page}/${totalPages} (+${data.items?.length ?? 0}, total items ${data.pagination?.["total-items"]})`,
    );
    page += 1;
  }

  return out;
}

async function sync() {
  await db.insert(chains).values(OTHER_CHAIN).onConflictDoNothing();

  const items = await fetchAllTurku();
  let ok = 0;
  let skip = 0;

  for (const item of items) {
    const lipasId = item["lipas-id"];
    const name = (item.name ?? "").trim();
    const point = pointFromItem(item);
    if (!lipasId || !name || !point) {
      skip += 1;
      continue;
    }

    const addressParts = [
      item.location?.address,
      item.location?.["postal-code"],
      item.location?.["postal-office"] || "Turku",
    ].filter(Boolean);
    const address = addressParts.join(", ") || "Turku";

    const row = {
      id: `lipas-${lipasId}`,
      slug: slugify(name, lipasId),
      name,
      city: "Turku",
      address,
      chainId: chainForName(name),
      lat: point.lat,
      lng: point.lng,
    };

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
        },
      });
    ok += 1;
  }

  console.log(`Turku sync OK: ${ok} gyms upserted, ${skip} skipped`);
  process.exit(0);
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
