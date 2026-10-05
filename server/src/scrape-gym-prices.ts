import "dotenv/config";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

function parseEuro(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html",
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

type Extracted = {
  priceFrom: number | null;
  hoursWeekday: string | null;
  hoursWeekend: string | null;
  is247: boolean | null;
  membershipsJson: string | null;
};

function extractElixia(html: string): Extracted {
  const priceCard = html.match(
    /pricing-card__price[\s\S]{0,240}?>(\d{1,3}[.,]\d{2})</i,
  );
  const priceFrom = priceCard ? parseEuro(priceCard[1]) : null;
  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = null;
  const hoursBlock = html.match(
    /(?:id="opening-hours"|Aukioloajat|Kapasiteetti)[\s\S]{0,900}?Keskus[\s\S]{0,200}?(?:Ma\s*[-–]\s*Su|Ma\s*[-–]\s*To|Ma\s*[-–]\s*Pe)[\s\S]{0,120}?(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i,
  );
  if (hoursBlock) {
    hoursWeekday = `${hoursBlock[1]}–${hoursBlock[2]}`;
    hoursWeekend = hoursWeekday;
  } else {
    const simple = html.match(
      /avoinna joka päivä klo\s*(\d{1,2})\s*[-–]\s*(\d{1,2})/i,
    );
    if (simple) {
      const a = `${simple[1].padStart(2, "0")}:00`;
      const endH = Number(simple[2]);
      const b = endH === 24 ? "24:00" : `${String(endH).padStart(2, "0")}:00`;
      hoursWeekday = `${a}–${b}`;
      hoursWeekend = hoursWeekday;
    }
  }
  return {
    priceFrom,
    hoursWeekday,
    hoursWeekend,
    is247,
    membershipsJson:
      priceFrom != null
        ? JSON.stringify([
            { name: "Basic", priceEur: priceFrom, note: "EUR/kk, tama keskus" },
          ])
        : null,
  };
}

function extractEasyFit(html: string): Extracted {
  const price =
    html.match(/alkaen\s+(\d{1,3}[.,]\d{2})\s*€/i) ||
    html.match(/Basic\s+(\d{1,3}[.,]\d{2})\s*€/i) ||
    html.match(/>(\d{1,3}[.,]\d{2})\s*€\/kk</i);
  const priceFrom = price ? parseEuro(price[1]) : null;
  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = null;
  if (/24\s*\/\s*7|kulkukortilla\s*24/i.test(html)) {
    is247 = true;
    hoursWeekday = "24/7";
    hoursWeekend = "24/7";
  } else {
    const h = html.match(
      /Aukioloajat[\s\S]{0,120}?(\d{1,2})\s*[–-]\s*(\d{1,2}|24)/i,
    );
    if (h) {
      const a = `${h[1].padStart(2, "0")}:00`;
      const b = h[2] === "24" ? "24:00" : `${h[2].padStart(2, "0")}:00`;
      hoursWeekday = `${a}–${b}`;
      hoursWeekend = hoursWeekday;
      is247 = false;
    }
  }
  return {
    priceFrom,
    hoursWeekday,
    hoursWeekend,
    is247,
    membershipsJson:
      priceFrom != null
        ? JSON.stringify([{ name: "Basic", priceEur: priceFrom, note: "EUR/kk" }])
        : null,
  };
}

function extractForever(html: string): Extracted {
  const basic12 = html.match(
    /Basic[\s\S]{0,800}?12\s*kk[\s\S]{0,400}?<strong>(\d{1,3}[.,]\d{2})\s*€<\/strong>/i,
  );
  let priceFrom = basic12 ? parseEuro(basic12[1]) : null;
  if (priceFrom != null && (priceFrom < 27 || priceFrom > 45)) priceFrom = null;
  if (priceFrom === 26.1) priceFrom = 29;

  const flexMatches = [
    ...html.matchAll(
      /Basic[\s\S]{0,400}?Toistaiseksi voimassa[\s\S]{0,400}?<strong>(\d{1,3}[.,]\d{2})\s*€<\/strong>/gi,
    ),
  ]
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 30 && n <= 50);
  const flexPrice = flexMatches.length ? Math.max(...flexMatches) : null;

  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = false;
  const openKlo = html.match(
    /Avoinna jäsenille:[\s\S]{0,500}?klo\s*(\d{1,2})[.:](\d{2})\s*[\u2013\u2014\-–]\s*(\d{1,2})[.:](\d{2})/i,
  );
  const openMa = html.match(
    /Avoinna jäsenille:[\s\S]{0,900}?Ma[\s\u2013\u2014\-–]*to\s*(\d{1,2})[.:]?(\d{2})?\s*[\u2013\u2014\-–]\s*(\d{1,2})/i,
  );
  if (openKlo) {
    hoursWeekday = `${openKlo[1].padStart(2, "0")}:${openKlo[2]}–${openKlo[3].padStart(2, "0")}:${openKlo[4]}`;
    hoursWeekend = hoursWeekday;
  } else if (openMa) {
    const aM = openMa[2] || "00";
    hoursWeekday = `${openMa[1].padStart(2, "0")}:${aM}–${openMa[3].padStart(2, "0")}:00`;
    hoursWeekend = hoursWeekday;
  }

  const memberships =
    priceFrom != null
      ? [
          {
            name: "Basic 12 kk",
            priceEur: priceFrom,
            note: "EUR / 4 vko, normaalihinta",
          },
          ...(flexPrice != null
            ? [
                {
                  name: "Basic joustava",
                  priceEur: flexPrice,
                  note: "EUR / 4 vko",
                },
              ]
            : []),
        ]
      : null;

  return {
    priceFrom,
    hoursWeekday,
    hoursWeekend,
    is247,
    membershipsJson: memberships ? JSON.stringify(memberships) : null,
  };
}

function extractFressi(html: string): Extracted {
  const ranges = [
    ...html.matchAll(
      /uabb-pricing-table-price[^>]*>\s*(\d{1,3}[.,]\d{2})\s*€\s*[-–]\s*(\d{1,3}[.,]\d{2})\s*€/gi,
    ),
  ]
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 35 && n <= 90);
  const priceFrom = ranges.length ? Math.min(...ranges) : null;

  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = null;
  if (/avoinna\s*24\s*h|24\s*h\s*joka|24\s*\/\s*7/i.test(html)) {
    is247 = true;
    hoursWeekday = "24/7";
    hoursWeekend = "24/7";
  } else {
    const h = html.match(/avoinna\s+klo\s+(\d{1,2})\s*[–-]\s*(\d{1,2})/i);
    if (h) {
      hoursWeekday = `${h[1].padStart(2, "0")}:00–${h[2].padStart(2, "0")}:00`;
      hoursWeekend = hoursWeekday;
      is247 = false;
    }
  }

  return {
    priceFrom,
    hoursWeekday,
    hoursWeekend,
    is247,
    membershipsJson:
      priceFrom != null
        ? JSON.stringify([
            {
              name: "Asiakkuus alkaen",
              priceEur: priceFrom,
              note: "EUR/kk, riippuu sitoutumisesta",
            },
          ])
        : null,
  };
}

function extractOleFit(html: string): Extracted {
  const cardPrices = [
    ...html.matchAll(
      /<h2>\s*(\d{1,3}[.,]\d{2})\s*€\s*<\/h2>\s*<h4>\s*\/\s*4\s*viikkoa/gi,
    ),
  ]
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 35 && n <= 120);

  const legacy = [
    ...html.matchAll(
      /(\d{1,3}[.,]\d{2})\s*(?:€|&euro;)[\s\S]{0,80}?(?:\/\s*4\s*vko|\/\s*4\s*viikkoa)/gi,
    ),
  ]
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 35 && n <= 120);

  const all = [...cardPrices, ...legacy];
  const priceFrom = all.length ? Math.min(...all) : null;

  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = null;
  if (/24\s*\/\s*7/i.test(html)) {
    is247 = true;
    hoursWeekday = "24/7";
    hoursWeekend = "24/7";
  } else if (/05\s*[–-]\s*24|klo\s*05/i.test(html)) {
    hoursWeekday = "05:00–24:00";
    hoursWeekend = "05:00–24:00";
    is247 = false;
  }

  return {
    priceFrom,
    hoursWeekday,
    hoursWeekend,
    is247,
    membershipsJson:
      priceFrom != null
        ? JSON.stringify([
            { name: "Jasenyys", priceEur: priceFrom, note: "EUR / 4 vko" },
          ])
        : null,
  };
}

function extractLadyLine(html: string): Extracted {
  const priced = [
    ...html.matchAll(
      /class="price">\s*(\d{1,3}[.,]\d{2})\s*€/gi,
    ),
  ].map((m) => {
    const start = Math.max(0, (m.index ?? 0) - 120);
    const ctx = html.slice(start, (m.index ?? 0) + 40);
    return { price: parseEuro(m[1]), ctx };
  });

  const adult = priced
    .filter(
      (p) =>
        p.price != null &&
        p.price >= 35 &&
        p.price <= 90 &&
        !/online|tutustu|vierail/i.test(p.ctx),
    )
    .map((p) => p.price as number);

  const priceFrom = adult.length ? Math.min(...adult) : null;

  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = null;
  if (/24\s*\/\s*7|avoinna 24/i.test(html)) {
    is247 = true;
    hoursWeekday = "24/7";
    hoursWeekend = "24/7";
  } else if (/05\s*[-–]\s*23|klo\s*05/i.test(html) || /Koko päivä 05-23/i.test(html)) {
    hoursWeekday = "05:00–23:00";
    hoursWeekend = "05:00–23:00";
  } else if (/04\s*[–-]\s*24/i.test(html)) {
    hoursWeekday = "04:00–24:00";
    hoursWeekend = "04:00–24:00";
  }

  return {
    priceFrom,
    hoursWeekday,
    hoursWeekend,
    is247,
    membershipsJson:
      priceFrom != null
        ? JSON.stringify([{ name: "Jasenyys alkaen", priceEur: priceFrom }])
        : null,
  };
}

const LOCATION_CHAIN_IDS = new Set([
  "c1",
  "c2",
  "c3",
  "c7",
  "c8",
  "c9",
  "c12",
]);

async function main() {
  const chainRows = await db.select().from(chains);
  const modeById = new Map(
    chainRows.map((c) => [c.id, c.pricingMode ?? "location"]),
  );

  const rows = await db
    .select()
    .from(gyms)
    .where(and(eq(gyms.listed, true), isNotNull(gyms.www), ne(gyms.www, "")));

  let updated = 0;
  let withPrice = 0;

  for (const g of rows) {
    if (!g.www) continue;
    const mode = modeById.get(g.chainId);
    if (mode === "shared") continue;
    if (!LOCATION_CHAIN_IDS.has(g.chainId)) continue;

    const html = await fetchHtml(g.www);
    if (!html) {
      console.log("FAIL", g.chainId, g.name);
      continue;
    }

    let extracted: Extracted | null = null;
    if (g.chainId === "c2") extracted = extractElixia(html);
    else if (g.chainId === "c1") extracted = extractEasyFit(html);
    else if (g.chainId === "c7") extracted = extractForever(html);
    else if (g.chainId === "c3") extracted = extractFressi(html);
    else if (g.chainId === "c9") extracted = extractOleFit(html);
    else if (g.chainId === "c8") extracted = extractLadyLine(html);
    else if (g.chainId === "c12") extracted = extractOleFit(html);
    if (!extracted) continue;

    const {
      priceFrom,
      hoursWeekday,
      hoursWeekend,
      is247,
      membershipsJson,
    } = extracted;

    await db
      .update(gyms)
      .set({
        priceFrom,
        hoursWeekday,
        hoursWeekend,
        is247,
        membershipsJson,
      })
      .where(eq(gyms.id, g.id));
    updated++;
    if (priceFrom != null) withPrice++;
    console.log(
      priceFrom != null ? "OK" : "PARTIAL",
      g.chainId,
      g.name,
      "price=" + priceFrom,
      "hours=" + (hoursWeekday || "-"),
    );
  }

  console.log("Updated:", updated, "withPrice:", withPrice);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
