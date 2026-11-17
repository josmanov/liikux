import { euro, linesOf } from "./text.js";
import type { Membership } from "./chainSources.js";

/**
 * Readers for gym pages whose price list the older parsers (enrich/adapters.ts)
 * misread. They return the gym's membership list and its "hinta alkaen":
 * the cheapest full-day price for everyone. Student / senior prices and
 * day-time-only cards stay in the list but are never the "alkaen" price.
 */

export type GymPrices = { priceFrom: number | null; memberships: Membership[]; hours?: string | undefined };

const STUDENT = /opiskelij|eläkel|senior|nuori|nuoriso|junior|varusmie|työttöm/i;
/** Cards limited to part of the day ("Day 00-15", "klo 10-15", "aamu", "päivä"). */
const LIMITED = /\bday\b|aamu|päivä(?!t)|osa-aika|\b\d{1,2}\s*[-–]\s*1[0-6]\b(?!\s*€)/i;
const NOT_MEMBERSHIP = /lahjakortti|workshop|kurssi|valmennus|checkup|mittaus|pienryhm|hopea|kulta|platina|pronssi|tunti|hieronta|biocircuit|vuokra|setti|spinningpyörä|kahvakuul|käsipain|jumppapallo|lisäpain/i;

function groupOf(label: string): Membership["group"] {
  if (/eläkel|senior/i.test(label)) return "senior";
  if (/opiskelij/i.test(label)) return "student";
  if (/nuori|nuoriso|junior/i.test(label)) return "youth";
  return "normal";
}

function commitmentOf(label: string): number | undefined {
  const m = label.match(/(\d{1,2})\s*kk\s*(?:määräaik|sopimus|sitoutu)/i) ?? label.match(/^(\d{1,2})\s*kk\b/i);
  if (m) return Number(m[1]);
  if (/joustava|toistaiseksi|ei määräaik/i.test(label)) return 0;
  return undefined;
}

function finish(list: Membership[]): GymPrices {
  const full = list.filter((m) => m.group === "normal" && !LIMITED.test(m.name) && m.priceEur >= 15 && m.priceEur <= 200);
  return { priceFrom: full.length ? Math.min(...full.map((m) => m.priceEur)) : null, memberships: list };
}

function dedupe(list: Membership[]) {
  const seen = new Set<string>();
  return list.filter((m) => {
    const key = `${m.name}|${m.priceEur}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * LadyLine web shop lines: "Joustava sopimus, kuntosali klo 5-23 44.90 €",
 * "12 kk määräaikainen kuntosali ja ryhmäliikunta, koko päivä klo 05-23, Kajaani 58.00 €".
 */
export function ladyLinePrices(text: string): GymPrices | null {
  const list: Membership[] = [];
  for (const line of linesOf(text)) {
    const m = line.match(/^(.{6,140}?)\s+(\d{1,3}[.,]\d{2})\s*€$/i);
    if (!m?.[1] || !m[2] || NOT_MEMBERSHIP.test(m[1])) continue;
    if (!/sopimus|määräaikainen|kuntosali|ryhmäliikunt/i.test(m[1])) continue;
    if (/online|kertakäyn|tutustu|tarjous|ensimmäinen|viikkopassi|1\.\s*kk/i.test(m[1])) continue;
    const name = m[1].replace(/,\s*[A-ZÅÄÖ][a-zåäö]+$/, "").trim(); // drop the town name at the end
    const hours = name.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
    const span = hours ? (Number(hours[2]) || 24) - Number(hours[1]) : 24;
    list.push({
      name: span < 10 ? `${name} (rajattu aika)` : name,
      priceEur: euro(m[2])!,
      commitmentMonths: commitmentOf(name),
      group: groupOf(name),
      note: "EUR/kk",
    });
  }
  const out = dedupe(list);
  if (!out.length) return null;
  const full = out.filter((m) => m.group === "normal" && !/rajattu aika/.test(m.name) && m.priceEur >= 15);
  // Opening hours = the widest time a full membership gives ("04-24" → 04:00–24:00).
  let hours: string | undefined;
  let widest = 0;
  for (const m of full) {
    const h = m.name.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
    if (!h?.[1] || !h[2]) continue;
    const from = Number(h[1]);
    const to = Number(h[2]) || 24;
    if (to - from > widest) {
      widest = to - from;
      hours = `${String(from).padStart(2, "0")}:00–${String(to).padStart(2, "0")}:00`;
    }
  }
  return { priceFrom: full.length ? Math.min(...full.map((m) => m.priceEur)) : null, memberships: out, hours };
}

/**
 * Pages that write a label on one line and its price alone on the next:
 * "Kuntosali 24/7" / "55,95 €", "Opiskelija/eläkeläinen" / "40,95 €"
 * (Ole.Fit). Prices per 4 weeks are kept as written.
 */
export function labeledPrices(text: string): GymPrices | null {
  const lines = linesOf(text);
  const list: Membership[] = [];
  for (let i = 1; i < lines.length; i++) {
    const priceLine = lines[i] ?? "";
    const m = priceLine.match(/^(\d{1,3},\d{2})\s*€\s*(?:\/\s*(kk|4\s*vko))?$/i);
    if (!m?.[1]) continue;
    const label = (lines[i - 1] ?? "").replace(/[:\s]+$/, "");
    if (label.length < 3 || label.length > 70 || /€/.test(label) || NOT_MEMBERSHIP.test(label)) continue;
    if (/vuosikortti|\d+\s*kk\s*kortti|kertakäyn|10\s*x|sarjakortti/i.test(label)) continue;
    list.push({
      name: label,
      priceEur: euro(m[1])!,
      commitmentMonths: commitmentOf(label),
      group: STUDENT.test(label) ? groupOf(label) : "normal",
      note: /vko/i.test(m[2] ?? "") ? "EUR / 4 vko" : "EUR/kk",
    });
  }
  const out = dedupe(list);
  return out.length ? finish(out) : null;
}

/** Elixia gym pages: "Basic" / "Flexible" / "Premium", each followed by "49,90" and "€/kk". */
export function elixiaPrices(text: string): GymPrices | null {
  const lines = linesOf(text);
  const list: Membership[] = [];
  const areas: Record<string, string> = { Basic: "oma keskus", Flexible: "kaikki alueen keskukset", Premium: "kaikki keskukset Pohjoismaissa" };
  for (const name of Object.keys(areas)) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== name) continue;
      const priceLine = [1, 2, 3].map((k) => lines[i + k] ?? "").find((l) => /^\d{1,3},\d{2}$/.test(l));
      if (!priceLine) continue;
      list.push({ name: `${name} (${areas[name]})`, priceEur: euro(priceLine)!, commitmentMonths: 0, group: "normal", note: "EUR/kk" });
      break;
    }
  }
  return list.length ? finish(list) : null;
}

/** chain id → the reader to use for its gym pages (others use enrich/adapters.ts). */
export const GYM_PRICE_READERS: Record<string, (text: string) => GymPrices | null> = {
  c2: elixiaPrices,
  c8: ladyLinePrices,
  c9: labeledPrices,
};
