import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

type SalitJson = {
  meta?: { rivit?: number };
  salit: {
    id: string;
    slug?: string;
    nimi?: string;
    ketju?: string;
    tila?: string;
    osoite?: { katu?: string; postinumero?: string; kunta?: string };
    www?: string | null;
    puhelin?: string | null;
    aukiolo?: {
      ymparivuorokautinen?: boolean | null;
      ma_pe?: [string, string][] | null;
      la?: [string, string][] | null;
      su?: [string, string][] | null;
      teksti?: { ma_pe?: string | null; la?: string | null; su?: string | null } | null;
      miehitys?: string | null;
      huom?: string | null;
    } | null;
    hinnat?: {
      malli?: string | null;
      kk_sitoutumaton?: number | null;
      kk_sitoutunut?: number | null;
      sitoutumisaika_kk?: number | null;
      kertamaksu?: number | null;
      sarjakortti?: number | null;
      alennus_kk?: number | null;
      alennusryhmat?: string | null;
      aloitusmaksu?: number | null;
      muut?: string | null;
      huom?: string | null;
    } | null;
    lahteet?: { hinnat?: string | null; aukiolo?: string | null } | null;
    varmuus?: string | null;
    tarkistettu?: string | null;
  }[];
};

const args = process.argv.slice(2);
const fileArg = (args.find((a) => a.startsWith("--file=")) ?? "").split("=")[1];

if (!fileArg) {
  throw new Error(
    "Missing input file. Usage: npm run db:import-salit -- --file=../exports/salit.json",
  );
}

function rangeToText(ranges: [string, string][] | null | undefined) {
  if (!ranges || !ranges.length) return null;
  return ranges.map(([a, b]) => `${a}–${b}`).join(", ");
}

function pickHours(a: SalitJson["salit"][0]["aukiolo"]) {
  if (!a) return { is247: null as boolean | null, weekday: null as string | null, weekend: null as string | null };
  if (a.ymparivuorokautinen === true) {
    return { is247: true, weekday: "24/7", weekend: "24/7" };
  }
  const weekday =
    a.teksti?.ma_pe ||
    rangeToText(a.ma_pe as [string, string][] | null) ||
    null;
  const weekend =
    a.teksti?.la ||
    a.teksti?.su ||
    rangeToText(a.la as [string, string][] | null) ||
    rangeToText(a.su as [string, string][] | null) ||
    null;
  const looks247 =
    weekday === "00:00–24:00" ||
    weekday === "00:00-24:00" ||
    (weekday?.includes("00:00") && weekday?.includes("24:00"));
  if (looks247) return { is247: true, weekday: "24/7", weekend: "24/7" };
  return {
    is247: a.ymparivuorokautinen === false ? false : null,
    weekday,
    weekend: weekend || weekday,
  };
}

function pickPrice(h: SalitJson["salit"][0]["hinnat"]) {
  if (!h) return null;
  const a = h.kk_sitoutumaton;
  const b = h.kk_sitoutunut;
  if (a != null && b != null) return Math.min(a, b);
  if (a != null) return a;
  if (b != null) return b;
  return null;
}

function membershipsJson(h: SalitJson["salit"][0]["hinnat"]) {
  if (!h) return null;
  const list: {
    name: string;
    priceEur: number;
    note?: string | undefined;
  }[] = [];
  if (h.kk_sitoutumaton != null) {
    list.push({ name: "Kuukausijäsenyys (sitoutumaton)", priceEur: h.kk_sitoutumaton });
  }
  if (h.kk_sitoutunut != null) {
    list.push({
      name: "Kuukausijäsenyys (sitoutunut)",
      priceEur: h.kk_sitoutunut,
      note: h.sitoutumisaika_kk != null ? `${h.sitoutumisaika_kk} kk` : undefined,
    });
  }
  if (h.kertamaksu != null) list.push({ name: "Kertamaksu", priceEur: h.kertamaksu });
  if (h.sarjakortti != null) list.push({ name: "Sarjakortti", priceEur: h.sarjakortti });
  if (h.aloitusmaksu != null) list.push({ name: "Aloitusmaksu", priceEur: h.aloitusmaksu });
  if (h.alennus_kk != null) {
    list.push({
      name: "Alennus kk",
      priceEur: h.alennus_kk,
      note: h.alennusryhmat ?? undefined,
    });
  }
  if (!list.length) return null;
  return JSON.stringify(list);
}

function checkedAtIso(d: string | null | undefined) {
  if (!d) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T12:00:00.000Z`;
  return d;
}

function formatAddress(o: SalitJson["salit"][0]["osoite"], cityFallback: string) {
  if (!o) return cityFallback;
  const parts = [o.katu, [o.postinumero, o.kunta].filter(Boolean).join(" ")].filter(Boolean);
  return parts.join(", ") || cityFallback;
}

async function main() {
  const path = resolve(fileArg!);
  const data = JSON.parse(readFileSync(path, "utf8")) as SalitJson;
  const salit = data.salit ?? [];
  console.log(`Import from ${path} salit=${salit.length}`);

  const existing = await db.select({ id: gyms.id }).from(gyms);
  const have = new Set(existing.map((g) => g.id));

  let updated = 0;
  let skipped = 0;
  let listedOn = 0;
  let listedOff = 0;
  let withPrice = 0;
  let withHours = 0;

  for (const s of salit) {
    if (!have.has(s.id)) {
      skipped++;
      continue;
    }

    const city = s.osoite?.kunta || "Suomi";
    const hours = pickHours(s.aukiolo);
    const price = pickPrice(s.hinnat);
    const active = s.tila === "aktiivinen";
    const hasHours = Boolean(hours.weekday || hours.is247);
    if (price != null) withPrice++;
    if (hasHours) withHours++;

    let enrichStatus: string;
    let missReason: string | null = null;
    if (price != null && hasHours) enrichStatus = "ok";
    else if (price != null || hasHours) {
      enrichStatus = "partial";
      missReason = price == null ? "price_not_found" : "hours_not_found";
    } else {
      enrichStatus = "unknown";
      missReason = "no_price_or_hours";
    }
    if (!active) {
      missReason = (missReason ? missReason + "; " : "") + `tila:${s.tila ?? "?"}`;
    }

    if (active) listedOn++;
    else listedOff++;

    await db
      .update(gyms)
      .set({
        name: s.nimi || undefined,
        city,
        address: formatAddress(s.osoite, city),
        www: s.www ?? null,
        phone: s.puhelin ?? null,
        listed: active,
        hiddenReason: active ? null : s.tila ?? "piilotettu",
        priceFrom: price,
        is247: hours.is247,
        hoursWeekday: hours.weekday,
        hoursWeekend: hours.weekend,
        membershipsJson: membershipsJson(s.hinnat),
        offerCheckedAt: checkedAtIso(s.tarkistettu),
        enrichStatus,
        missReason,
        offerSourceUrl: s.lahteet?.hinnat || s.lahteet?.aukiolo || null,
        offerMethod: "salit_json",
      })
      .where(eq(gyms.id, s.id));
    updated++;
    if (updated % 200 === 0) console.log(`updated ${updated}/${salit.length}`);
  }

  console.log("\n==== Import report ====");
  console.log(`updated=${updated} skipped_not_in_db=${skipped}`);
  console.log(`listed_on=${listedOn} listed_off=${listedOff}`);
  console.log(`with_price=${withPrice} with_hours=${withHours}`);
  console.log("Paluu vanhaan: npx tsx src/restore-gyms-backup.ts --file=../exports/backup-gyms-before-salit-json-....json");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
