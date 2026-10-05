import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../exports");
const outPath = join(outDir, "liikux-salidata.csv");

function csvEscape(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  const s = String(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtPrice(p: number | null) {
  if (p == null) return "";
  return String(Number.isInteger(p) ? p : Number(p.toFixed(2))).replace(".", ",");
}

function rowStatus(price: number | null, hours: string | null) {
  if (price != null && hours) return "OK_molemmat";
  if (price != null) return "OK_vain_hinta";
  if (hours) return "OK_vain_aukiolo";
  return "PUUTTUU_molemmat";
}

async function main() {
  const chainRows = await db.select().from(chains);
  const chainById = new Map(chainRows.map((c) => [c.id, c]));
  const gymRows = (await db.select().from(gyms).where(eq(gyms.listed, true))).sort(
    (a, b) => {
      const ca = chainById.get(a.chainId)?.name ?? a.chainId;
      const cb = chainById.get(b.chainId)?.name ?? b.chainId;
      return ca.localeCompare(cb, "fi") || a.name.localeCompare(b.name, "fi");
    },
  );

  const headers = [
    "ketju",
    "sali",
    "kaupunki",
    "osoite",
    "slug",
    "pricing_mode",
    "hinta_eur",
    "hinta_lahde",
    "aukiolo",
    "aukiolo_lahde",
    "tilanne",
    "enrich_status",
    "poimintatapa",
    "syy_jos_puuttuu",
    "tarkistettu",
    "lahde_url",
    "www",
    "id",
  ];

  const lines = [headers.join(";")];
  let okBoth = 0;
  let missAny = 0;

  for (const g of gymRows) {
    const c = chainById.get(g.chainId);
    const mode = c?.pricingMode ?? "location";
    let price: number | null = g.priceFrom ?? null;
    let priceSource = price != null ? "sali" : "";
    if (price == null && (mode === "shared" || mode === "hybrid")) {
      price = c?.priceFrom ?? null;
      if (price != null) priceSource = "ketju";
    }
    let hours: string | null = g.is247 === true ? "24/7" : g.hoursWeekday ?? null;
    let hoursSource = hours ? "sali" : "";
    if (!hours && mode === "shared") {
      hours = c?.is247 === true ? "24/7" : c?.hoursWeekday ?? null;
      if (hours) hoursSource = "ketju";
    }

    const tilanne = rowStatus(price, hours);
    if (tilanne === "OK_molemmat") okBoth++;
    else missAny++;

    const checkedAt =
      g.offerCheckedAt ?? (priceSource === "ketju" ? c?.checkedAt ?? "" : "");
    const sourceUrl =
      g.offerSourceUrl ?? (priceSource === "ketju" ? c?.sourceUrl ?? "" : "");
    const method =
      g.offerMethod ?? (priceSource === "ketju" || hoursSource === "ketju" ? "chain" : "");
    const status =
      g.enrichStatus ?? (mode === "shared" ? "chain" : "");

    lines.push(
      [
        c?.name ?? g.chainId,
        g.name,
        g.city,
        g.address,
        g.slug,
        mode,
        fmtPrice(price),
        priceSource,
        hours ?? "",
        hoursSource,
        tilanne,
        status,
        method,
        g.missReason ?? "",
        checkedAt,
        sourceUrl,
        g.www ?? "",
        g.id,
      ]
        .map(csvEscape)
        .join(";"),
    );
  }

  mkdirSync(outDir, { recursive: true });
  const bom = "\uFEFF";
  writeFileSync(outPath, bom + lines.join("\n"), "utf8");

  console.log(`Wrote ${outPath}`);
  console.log(`rows=${gymRows.length} ok_molemmat=${okBoth} puuttuu_jokin=${missAny}`);
  console.log("Avaa Excelissä / Google Sheetsissä (erotin = puolipiste ;)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
