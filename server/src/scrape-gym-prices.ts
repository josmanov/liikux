import "dotenv/config";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

function parseEuro(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extractElixia(html: string): {
  priceFrom: number | null;
  hoursWeekday: string | null;
  hoursWeekend: string | null;
  is247: boolean | null;
} {
  const priceCard = html.match(
    /pricing-card__price[\s\S]{0,240}?>(\d{1,3}[.,]\d{2})</i,
  );
  const priceFrom = priceCard ? parseEuro(priceCard[1]) : null;

  const hoursBlock = html.match(
    /(?:id="opening-hours"|Aukioloajat|Kapasiteetti)[\s\S]{0,900}?Keskus[\s\S]{0,200}?(?:Ma\s*[-–]\s*Su|Ma\s*[-–]\s*To|Ma\s*[-–]\s*Pe|Ma\s*-\s*Su)[\s\S]{0,120}?(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i,
  );
  let hoursWeekday: string | null = null;
  let hoursWeekend: string | null = null;
  let is247: boolean | null = null;
  if (hoursBlock) {
    const a = hoursBlock[1];
    const b = hoursBlock[2];
    hoursWeekday = `${a}–${b}`;
    hoursWeekend = hoursWeekday;
    if (
      (a === "00:00" || a === "05:00") &&
      (b === "24:00" || b === "23:59")
    ) {
      /* keep as written */
    }
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
  return { priceFrom, hoursWeekday, hoursWeekend, is247 };
}

function extractOleFit(html: string): number | null {
  const all = [
    ...html.matchAll(
      /(\d{1,3}[.,]\d{2})\s*(?:€|&euro;|EUR)[\s\S]{0,80}?(?:\/\s*4\s*vko|\/\s*4\s*viikkoa)/gi,
    ),
  ];
  const prices = all
    .map((m) => parseEuro(m[1]))
    .filter((n): n is number => n != null && n >= 20 && n <= 120);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

function extractLadyLine(html: string): number | null {
  const m =
    html.match(/Basic\s+(\d{1,3}[.,]\d{2})\s*(?:€|&euro;)/i) ||
    html.match(/Basic[\s\S]{0,80}?(\d{1,3}[.,]\d{2})\s*(?:€|&euro;)/i);
  if (!m) return null;
  const n = parseEuro(m[1]);
  if (n == null || n < 30) return null;
  return n;
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
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function main() {
  const rows = await db
    .select()
    .from(gyms)
    .where(
      and(eq(gyms.listed, true), isNotNull(gyms.www), ne(gyms.www, "")),
    );

  let updated = 0;
  let withPrice = 0;
  for (const g of rows) {
    if (!g.www) continue;
    const chainId = g.chainId;
    if (chainId !== "c2" && chainId !== "c8" && chainId !== "c9") continue;

    const html = await fetchHtml(g.www);
    if (!html) {
      console.log("FAIL fetch", g.name, g.www);
      continue;
    }

    let priceFrom: number | null = null;
    let hoursWeekday: string | null = null;
    let hoursWeekend: string | null = null;
    let is247: boolean | null = null;
    let membershipsJson: string | null = null;

    if (chainId === "c2") {
      const x = extractElixia(html);
      priceFrom = x.priceFrom;
      hoursWeekday = x.hoursWeekday;
      hoursWeekend = x.hoursWeekend;
      is247 = x.is247;
      if (priceFrom != null) {
        membershipsJson = JSON.stringify([
          {
            name: "Basic",
            priceEur: priceFrom,
            note: "EUR/kk, tama keskus",
          },
        ]);
      }
    } else if (chainId === "c9") {
      priceFrom = extractOleFit(html);
      if (/24\s*\/\s*7/i.test(html)) {
        is247 = true;
        hoursWeekday = "24/7";
        hoursWeekend = "24/7";
      } else if (/05\s*[–-]\s*24|klo\s*05/i.test(html)) {
        hoursWeekday = "05:00–24:00";
        hoursWeekend = "05:00–24:00";
        is247 = false;
      }
      if (priceFrom != null) {
        membershipsJson = JSON.stringify([
          {
            name: "Salikortti",
            priceEur: priceFrom,
            note: "EUR / 4 vko",
          },
        ]);
      }
    } else if (chainId === "c8") {
      priceFrom = extractLadyLine(html);
      if (/24\s*\/\s*7|avoinna 24/i.test(html)) {
        is247 = true;
        hoursWeekday = "24/7";
        hoursWeekend = "24/7";
      } else if (/04\s*[–-]\s*24|klo\s*4\s*[–-]\s*24/i.test(html)) {
        hoursWeekday = "04:00–24:00";
        hoursWeekend = "04:00–24:00";
      }
      if (priceFrom != null) {
        membershipsJson = JSON.stringify([
          {
            name: "Basic",
            priceEur: priceFrom,
            note: "EUR (tarkista jakso sivulta)",
          },
        ]);
      }
    }

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
      g.name,
      "price=" + priceFrom,
      "hours=" + (hoursWeekday || "-"),
    );
  }

  console.log("Updated gyms:", updated, "withPrice:", withPrice);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
