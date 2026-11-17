import { euro, firstEuro, linesOf } from "./text.js";

/**
 * Where each chain publishes its prices, and how to read them.
 *
 * Chain pages (the chain's price list) are read for chains whose price is
 * the same everywhere ("shared") or mostly the same ("hybrid"). Gym pages
 * (gym.www) are read for chains where every gym has its own price
 * ("location"); see gymAdapters in refresh-data.ts.
 *
 * When a chain redesigns its site, the parser below for that chain stops
 * finding prices. The refresh then keeps the old values and the admin view
 * shows the chain in red. Fix the parser here; nothing else needs to change.
 */

export type Membership = {
  name: string;
  priceEur: number;
  note?: string | undefined;
  commitmentMonths?: number | undefined; // 0 = no fixed term
  joiningFeeEur?: number | undefined;
  group?: "normal" | "student" | "senior" | "youth" | undefined;
};

export type ChainFacts = {
  priceFrom: number | null;
  memberships: Membership[];
  hoursWeekday: string | null;
  hoursWeekend: string | null;
  is247: boolean | null;
  dayPass: boolean | null;
  freeTrial: boolean | null;
};

export type ChainSource = {
  chainId: string;
  /** Pages with the chain's price list (read by `parse`). */
  priceUrls: string[];
  /** Extra pages that are only read for offers (front page, campaigns). */
  offerUrls: string[];
  parse?: (texts: string[]) => ChainFacts;
  /** For gym pages: which fields to take ("hours" only when prices are in a PDF). */
  gymFields?: ("price" | "hours" | "memberships")[];
};

function empty(): ChainFacts {
  return { priceFrom: null, memberships: [], hoursWeekday: null, hoursWeekend: null, is247: null, dayPass: null, freeTrial: null };
}

const fmt = (n: number) => n.toFixed(2).replace(".", ",");

function note(m: Omit<Membership, "note">): string {
  const parts: string[] = [];
  if (m.commitmentMonths === 0) parts.push("ei määräaikaa");
  else if (m.commitmentMonths) parts.push(`${m.commitmentMonths} kk sopimus`);
  if (m.joiningFeeEur != null) parts.push(m.joiningFeeEur === 0 ? "ei aloitusmaksua" : `aloitusmaksu ${fmt(m.joiningFeeEur)} €`);
  return parts.join(", ");
}

function withNotes(list: Omit<Membership, "note">[]): Membership[] {
  return list.map((m) => ({ ...m, note: note(m) || undefined }));
}

/**
 * "Hinta alkaen": the cheapest monthly price for everyone (not student /
 * senior / youth), on any contract. This is the same rule the gym parsers use
 * (e.g. Forever "Basic 12 kk"), so prices compare fairly across chains.
 * The full list with contract terms is shown on the gym page.
 */
function cheapestNormal(list: Membership[]) {
  const normal = list.filter((m) => (m.group ?? "normal") === "normal" && m.priceEur >= 10 && m.priceEur <= 200);
  return normal.length ? Math.min(...normal.map((m) => m.priceEur)) : null;
}

/** Line index of the first line matching re, at or after `from`. */
function findLine(lines: string[], re: RegExp, from = 0) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i] ?? "")) return i;
  return -1;
}

/** The price written on the line itself or on one of the next `ahead` lines. */
function priceNear(lines: string[], i: number, ahead = 2) {
  for (let k = i; k <= i + ahead && k < lines.length; k++) {
    const p = firstEuro(lines[k] ?? "");
    if (p != null) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// EasyFit: one price list page, same prices in every gym (hybrid).
// "Basic 36,90 €/kk, Plus 46,90 €/kk, Premium alk. 56,90 €/kk" + aloitusmaksu.
function parseEasyFit(texts: string[]): ChainFacts {
  const out = empty();
  const all = linesOf(texts.join("\n")).join("\n");
  const basic = all.match(/Basic[- ]?(?:jäsenyys)?\s*(?:maksaa\s*)?(\d{1,3},\d{2})\s*€\s*\/\s*kk/i);
  const plus = all.match(/Plus\s*(\d{1,3},\d{2})\s*€\s*\/\s*kk/i);
  const premium = all.match(/Premium\s*(?:alk\.|alkaen)\s*(\d{1,3},\d{2})\s*€\s*\/\s*kk/i);
  const fee = all.match(/(\d{1,3},\d{2})\s*€(?::n)?\s*aloitusmaksu/i) ?? all.match(/aloitusmaksu\D{0,20}(\d{1,3},\d{2})\s*€/i);
  const single = all.match(/kertakäynn\w*\s*(?:maksaa\s*)?(?:\S+\s){0,2}?(\d{1,3},\d{2})\s*€/i);
  const joiningFeeEur = euro(fee?.[1]) ?? undefined;
  const list: Omit<Membership, "note">[] = [];
  if (basic) list.push({ name: "Basic (oma keskus)", priceEur: euro(basic[1])!, commitmentMonths: 0, joiningFeeEur, group: "normal" });
  if (plus) list.push({ name: "Plus (kaikki keskukset)", priceEur: euro(plus[1])!, commitmentMonths: 0, joiningFeeEur, group: "normal" });
  if (premium) list.push({ name: "Premium alkaen", priceEur: euro(premium[1])!, commitmentMonths: 0, joiningFeeEur, group: "normal" });
  out.memberships = withNotes(list);
  if (single) out.memberships.push({ name: "Kertakäynti", priceEur: euro(single[1])!, group: "normal" });
  out.priceFrom = cheapestNormal(out.memberships.filter((m) => m.name !== "Kertakäynti"));
  out.dayPass = single ? true : null;
  out.freeTrial = /tutustumisviikko\s*(?:maksaa\s*)?10\s*€/i.test(all) ? false : null;
  return out;
}

// ---------------------------------------------------------------------------
// Fitness24Seven: price list with blocks "Toistaiseksi voimassa olevat",
// "Määräaikaiset 12 kk", "Määräaikaiset 6 kk"; each has Standardi /
// Eläkeläinen / Opiskelija / Nuoriso, a price and an "Aloitusmaksu".
function parseF24(texts: string[]): ChainFacts {
  const out = empty();
  const lines = linesOf(texts.join("\n"));
  const blocks: { re: RegExp; months: number }[] = [
    { re: /^Toistaiseksi voimassa olevat/i, months: 0 },
    { re: /^Määräaikaiset 12 kk/i, months: 12 },
    { re: /^Määräaikaiset 6 kk/i, months: 6 },
  ];
  const groups: [RegExp, Membership["group"], string][] = [
    [/^standardi$/i, "normal", "Standardi"],
    [/^eläkeläinen$/i, "senior", "Eläkeläinen"],
    [/^opiskelija$/i, "student", "Opiskelija"],
    [/^nuoriso$/i, "youth", "Nuoriso 15–17 v"],
  ];
  const list: Omit<Membership, "note">[] = [];
  blocks.forEach((b, bi) => {
    const start = findLine(lines, b.re);
    if (start < 0) return;
    const nextStarts = blocks.slice(bi + 1).map((x) => findLine(lines, x.re, start + 1)).filter((x) => x > 0);
    const end = nextStarts.length ? Math.min(...nextStarts) : Math.min(lines.length, start + 60);
    for (let i = start + 1; i < end; i++) {
      const g = groups.find(([re]) => re.test(lines[i] ?? ""));
      if (!g) continue;
      const total = priceNear(lines, i + 1, 0);
      if (total == null) continue;
      const feeAt = findLine(lines, /^Aloitusmaksu/i, i + 1);
      const fee = feeAt > 0 && feeAt < i + 5 ? priceNear(lines, feeAt, 2) ?? euro(lines[feeAt + 1]) : null;
      const perMonth = b.months ? Math.round((total / b.months) * 100) / 100 : total;
      list.push({
        name: b.months ? `${g[2]} ${b.months} kk (${fmt(total)} € kerralla)` : g[2],
        priceEur: perMonth,
        commitmentMonths: b.months,
        joiningFeeEur: fee ?? undefined,
        group: g[1],
      });
    }
  });
  out.memberships = withNotes(list);
  out.priceFrom = cheapestNormal(out.memberships);
  if (out.priceFrom != null) {
    out.is247 = true;
    out.hoursWeekday = "24/7";
    out.hoursWeekend = "24/7";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Liikku: "Perus-Liikku – …", then "Hinta: vuosijäsenyys 34,90 € kuukaudessa,
// toistaiseksi voimassaoleva jäsenyys 37,90 € … tai … kertamaksulla 399 €"
// and "Liittymismaksu: vuosijäsenyys 19,90 €, toistaiseksi voimassaoleva 29,90 €".
function parseLiikku(texts: string[]): ChainFacts {
  const out = empty();
  const lines = linesOf(texts.join("\n"));
  const list: Omit<Membership, "note">[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const head = (lines[i] ?? "").match(/^(\w+-Liikku)\s*[–-]/);
    if (!head?.[1] || seen.has(head[1])) continue;
    const priceAt = findLine(lines, /^Hinta:/i, i + 1);
    if (priceAt < 0 || priceAt > i + 10) continue;
    seen.add(head[1]);
    const p = lines[priceAt] ?? "";
    const f = lines[priceAt + 1] ?? "";
    const year = euro(p.match(/vuosijäsenyys\s*(\d{1,3},\d{2})\s*€/i)?.[1]);
    const flex = euro(p.match(/toistaiseksi[^,]*?(\d{1,3},\d{2})\s*€/i)?.[1]);
    const feeYear = euro(f.match(/vuosijäsenyys\s*(\d{1,3}(?:,\d{2})?)\s*€/i)?.[1]);
    const feeFlex = euro(f.match(/toistaiseksi[^,]*?(\d{1,3}(?:,\d{2})?)\s*€/i)?.[1]);
    if (flex != null) list.push({ name: `${head[1]}`, priceEur: flex, commitmentMonths: 0, joiningFeeEur: feeFlex ?? undefined, group: "normal" });
    if (year != null) list.push({ name: `${head[1]} vuosijäsenyys`, priceEur: year, commitmentMonths: 12, joiningFeeEur: feeYear ?? undefined, group: "normal" });
  }
  out.memberships = withNotes(list);
  out.priceFrom = cheapestNormal(out.memberships);
  const open = lines.join(" ").match(/Avoinna jäsenille klo\s*(\d{1,2})\s*[–-]\s*(\d{1,2})/i);
  if (open?.[1] && open[2]) {
    const h = `${open[1].padStart(2, "0")}:00–${open[2].padStart(2, "0")}:00`;
    out.hoursWeekday = h;
    out.hoursWeekend = h;
    out.is247 = false;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Esport: "Esport Center Flexi -sopimuksen hinta on 69,90 €/kk (norm. 79,90 €/kk)".
// The normal price is the "norm." one; the lower one is a campaign (an offer).
function parseEsport(texts: string[]): ChainFacts {
  const out = empty();
  const all = linesOf(texts.join("\n")).join("\n");
  const flex = all.match(/Flexi[^\n]*?hinta on\s*(\d{1,3},\d{2})\s*€\s*\/\s*kk(?:\s*\(norm\.\s*(\d{1,3},\d{2})\s*€)?/i);
  if (flex) {
    const normal = euro(flex[2]) ?? euro(flex[1])!;
    out.memberships = withNotes([{ name: "Esport Center Flexi", priceEur: normal, commitmentMonths: 0, group: "normal" }]);
    out.priceFrom = normal;
  }
  const single = all.match(/Kertamaksu on\s*(\d{1,3}(?:,\d{2})?)\s*€/i);
  if (single) {
    out.memberships.push({ name: "Kertamaksu", priceEur: euro(single[1])!, group: "normal" });
    out.dayPass = true;
  }
  if (/maksuton tutustumisviikko/i.test(all)) out.freeTrial = true;
  return out;
}

// ---------------------------------------------------------------------------
// UniSport: table "Jäsenyys 17€/kk", "Jäsenyys, osa-aikainen 10€/kk",
// "1kk 38€", "Kertakäynti 6€" (prices for university students).
function parseUniSport(texts: string[]): ChainFacts {
  const out = empty();
  const lines = linesOf(texts.join("\n"));
  // A label can also be in the menu: take the first one with a price on the next line.
  const pick = (re: RegExp) => {
    for (let i = findLine(lines, re); i >= 0; i = findLine(lines, re, i + 1)) {
      const p = priceNear(lines, i + 1, 0);
      if (p != null) return p;
    }
    return null;
  };
  const monthly = pick(/^Jäsenyys$/i);
  const part = pick(/^Jäsenyys, osa-aikainen$/i);
  const oneMonth = pick(/^1kk$/i);
  const single = pick(/^Kertakäynti$/i);
  const list: Omit<Membership, "note">[] = [];
  if (monthly != null) list.push({ name: "Jäsenyys (opiskelijat)", priceEur: monthly, commitmentMonths: 12, group: "normal" });
  if (part != null) list.push({ name: "Osa-aikainen (opiskelijat)", priceEur: part, commitmentMonths: 12, group: "normal" });
  if (oneMonth != null) list.push({ name: "1 kk kortti (opiskelijat)", priceEur: oneMonth, group: "normal" });
  out.memberships = withNotes(list);
  if (single != null) out.memberships.push({ name: "Kertakäynti (opiskelijat)", priceEur: single, group: "normal" });
  out.priceFrom = monthly;
  out.dayPass = single != null ? true : null;
  return out;
}

export const CHAIN_SOURCES: ChainSource[] = [
  { chainId: "c1", priceUrls: ["https://www.easyfit.fi/hinnasto/"], offerUrls: [], parse: parseEasyFit },
  { chainId: "c2", priceUrls: [], offerUrls: ["https://www.elixia.fi/jasenyydet"] },
  { chainId: "c3", priceUrls: [], offerUrls: ["https://www.fressi.fi/"] },
  {
    chainId: "c4",
    priceUrls: ["https://fi.fitness24seven.com/jasenyys/jasenyys-jasenhinnasto/"],
    offerUrls: ["https://fi.fitness24seven.com/jasenyys/jasenyytemme/"],
    parse: parseF24,
  },
  {
    chainId: "c6",
    priceUrls: ["https://www.liikku.fi/liikun-jasenyydet-uudistuvat-16-11-2026/"],
    offerUrls: ["https://www.liikku.fi/"],
    parse: parseLiikku,
  },
  { chainId: "c7", priceUrls: [], offerUrls: ["https://www.foreverclub.fi/toimipisteet-ja-hinnat/"] },
  { chainId: "c8", priceUrls: [], offerUrls: ["https://ladyline.fi/"] },
  { chainId: "c9", priceUrls: [], offerUrls: [] },
  {
    chainId: "c10",
    priceUrls: ["https://esport.fi/jasenyys/esport-jasenyys/"],
    offerUrls: ["https://esport.fi/jasenyys/"],
    parse: parseEsport,
  },
  { chainId: "c11", priceUrls: ["https://www.unisport.fi/fi/tuotteet-ja-hinnat"], offerUrls: [], parse: parseUniSport },
  // M&M: prices are only in a PDF, and each gym page lists all three gyms, so only offers are read.
  { chainId: "c12", priceUrls: [], offerUrls: ["https://mmkuntotalo.fi/"] },
];

/** Chains whose gyms each have their own page with price and hours. */
export const GYM_PAGE_CHAINS = new Set(["c1", "c2", "c3", "c7", "c8", "c9"]);
