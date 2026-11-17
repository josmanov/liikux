import { linesOf, firstEuro } from "./text.js";

/**
 * Finds offers and campaigns ("Ensimmäinen kuukausi 20 €", "-50 %",
 * "aloitusmaksu 0 €", "Tarjous voimassa 30.11. asti") in a page's text.
 *
 * Because offers go live without a person checking them, the rules are
 * strict. A line only counts when it:
 *   - talks about an offer (kampanja, tarjous, etu, -X %, 0 €, norm. …),
 *   - has a concrete number (a price or a percentage),
 *   - is not out of date: every date in it must be today or later, and a
 *     season word (joulu, kesä, Black Week …) must match the current month.
 */

export type FoundOffer = {
  title: string;
  text: string;
  priceEur: number | null;
  discountPct: number | null;
  validUntil: string | null; // YYYY-MM-DD
};

const OFFER_WORD =
  /kampanj|tarjous|tarjouks|\betu\b|etu uusille|edun|alennus|alennuks|ilmai|veloitukse|\bnorm\b\.?|normaalisti|puoleen hintaan|säästä|[-–]\s?\d{1,2}\s?%|(?<![\d,.])0\s?€|0,00\s?€/i;
const CONCRETE = /\d\s*€|€\s*\d|\d\s?%/;
/** The offer must be about training at the gym, not a partner's salad or a massage. */
const ABOUT_TRAINING =
  /jäsen|kk\b|kuukau|treeni|aloitusmaksu|liittymis|avausmaksu|viikko|vko|sopimus|asiakkuu|kortti|kertakäyn|tutustu|liity|kuntosali|ryhmäliikunt|salille/i;
const OFF_TOPIC =
  /hieron|salaat|\bsub|ravintol|kahvi|ruoka|lounas|smoothie|ravintolisä|kulkuavain|kulkukortti ei|ei sisälly|ei sisällä|eikä|arvo \d|solarium|fysioterap/i;
/** Standing discounts for a group (students, seniors…) are prices, not campaigns. */
const GROUP_DISCOUNT = /opiskelij|senior|eläkel|nuoret|nuorille|vuotiaille|yrityssopimu|together/i;
const NOT_AN_OFFER =
  /evä|cookie|lahjakortti|yritysmyyn|yrityksil|liikuntaetu|epassi|smartum|edenred|työnantaj|julkaistu|tietosuoja|lapsiparkki|kertakäynti maksaa|hyvitetään|irtisano|laskutus|eräpäiv/i;

/** Season words and the months (1–12) they are true in. */
const SEASONS: [RegExp, (d: Date) => boolean][] = [
  [/tammi/i, (d) => d.getMonth() === 0],
  [/helmi|ystävänpäiv/i, (d) => d.getMonth() === 1],
  [/maalis/i, (d) => d.getMonth() === 2],
  [/pääsiäi/i, (d) => d.getMonth() === 2 || d.getMonth() === 3],
  [/huhti/i, (d) => d.getMonth() === 3],
  [/vappu|touko/i, (d) => d.getMonth() === 3 || d.getMonth() === 4],
  [/kesä/i, (d) => d.getMonth() >= 4 && d.getMonth() <= 7],
  [/elo(?:kuu)?\b/i, (d) => d.getMonth() === 7],
  [/syys|syksy/i, (d) => d.getMonth() >= 7 && d.getMonth() <= 10],
  [/loka|halloween/i, (d) => d.getMonth() === 9],
  [/marras/i, (d) => d.getMonth() === 10],
  [/singles/i, (d) => d.getMonth() === 10 && d.getDate() <= 12],
  [/black\s*week|black\s*friday|cyber/i, (d) => (d.getMonth() === 10 && d.getDate() >= 17) || (d.getMonth() === 11 && d.getDate() <= 2)],
  [/joulu|joulun/i, (d) => d.getMonth() === 11 || (d.getMonth() === 10 && d.getDate() >= 20)],
  [/uusi\s*vuosi|uudenvuod/i, (d) => d.getMonth() === 11 || d.getMonth() === 0],
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * All dates in a line ("5.–11.10.", "30.11.", "31.12.2026"), as YYYY-MM-DD.
 * Returns null when a date is impossible (e.g. "31.6."), so the line is skipped.
 */
function datesIn(line: string, now: Date): string[] | null {
  const out: string[] = [];
  const re = /(?<![\d.])(\d{1,2})\.\s?(?:[-–]\s?\d{1,2}\.\s?)?(\d{1,2})\.(?:\s?(20\d{2}))?(?![\d])/g;
  for (const m of line.matchAll(re)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1) continue;
    // A range "5.–11.10." ends on the 11th: take the later day.
    const range = m[0].match(/[-–]\s?(\d{1,2})\./);
    const endDay = range ? Number(range[1]) : day;
    const year = m[3] ? Number(m[3]) : now.getFullYear();
    const d = new Date(year, month - 1, endDay);
    if (d.getMonth() !== month - 1) return null; // 31.6. does not exist
    out.push(`${year}-${pad(month)}-${pad(endDay)}`);
  }
  return out;
}

const MONTHS = ["tammi", "helmi", "maalis", "huhti", "touko", "kesä", "heinä", "elo", "syys", "loka", "marras", "joulu"];
const MONTH_END = new RegExp(`(${MONTHS.join("|")})kuu(?:n)?\\s*(20\\d{2})?\\s*(?:loppuun|asti|saakka)`, "gi");

/** "tammikuun 2027 loppuun" → 2027-01-31. A month earlier than now means next year. */
function monthEnds(line: string, now: Date): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(MONTH_END)) {
    const month = MONTHS.indexOf((m[1] ?? "").toLowerCase());
    if (month < 0) continue;
    const year = m[2] ? Number(m[2]) : month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    const last = new Date(year, month + 1, 0).getDate();
    out.push(`${year}-${pad(month + 1)}-${pad(last)}`);
  }
  return out;
}

function today(now: Date) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Comparable key: lowercase, numbers kept, punctuation dropped. */
export function offerKey(text: string) {
  return text.toLowerCase().replace(/[^a-zåäö0-9%€]+/g, " ").trim();
}

const TITLE_WORD = /tarjou|kampanj|\betu\b|\bale\b|week|kamppis|viikko|päivät/i;

/** A short heading line above the offer, like "Syksyn aloitustarjous". */
function isTitle(line: string | undefined): line is string {
  return Boolean(line && line.length >= 3 && line.length <= 45 && !/€|\d{2}/.test(line) && TITLE_WORD.test(line));
}

function titleFor(prev: string | undefined, line: string) {
  if (isTitle(prev)) return prev.replace(/[!:]+$/, "");
  let lead = line.split(/: |[.!?] (?=[A-ZÅÄÖ])/)[0] ?? line;
  if (lead.includes("(") && !lead.includes(")")) lead = lead.slice(0, lead.indexOf("(")).trim();
  return lead.length <= 45 ? lead.replace(/[!:.]+$/, "") : "Tarjous";
}

export function findOffers(text: string, now = new Date()): FoundOffer[] {
  const lines = linesOf(text);
  const found = new Map<string, FoundOffer>();
  const todayStr = today(now);

  lines.forEach((line, i) => {
    if (line.length < 12 || line.length > 240) return;
    const prev = lines[i - 1];
    const context = `${prev ?? ""} ${line}`;
    // The offer word must be on the line itself, or in a short heading right above it.
    const offerWordHere = OFFER_WORD.test(line) || (isTitle(prev) && OFFER_WORD.test(prev));
    if (!offerWordHere || !CONCRETE.test(line)) return;
    if (NOT_AN_OFFER.test(line) || OFF_TOPIC.test(line)) return;
    if (!ABOUT_TRAINING.test(context) && !/[-–]\s?\d{1,2}\s?%/.test(line)) return;
    if (GROUP_DISCOUNT.test(line) && !/kampanj|tarjous|\bnyt\b/i.test(line)) return;
    // Three or more prices on one line = a price list ("Basic 36,90 €, Plus …"), not an offer.
    if ((line.match(/\d\s*€/g) ?? []).length >= 3) return;

    const numeric = datesIn(line, now);
    if (numeric === null) return;
    const dates = [...numeric, ...monthEnds(line, now)];
    if (dates.length && dates.every((d) => d < todayStr)) return;
    const validUntil = dates.length ? dates.sort().at(-1)! : null;

    // "tammikuun loppuun" is an end date, not a January offer: leave it out of the season check.
    const seasonText = context.replace(MONTH_END, " ");
    for (const [word, inSeason] of SEASONS) {
      if (word.test(seasonText) && !inSeason(now)) return;
    }

    const pct = line.match(/[-–]\s?(\d{1,2})\s?%/) ?? line.match(/(\d{1,2})\s?%\s*(?:alennu|alempi|edullisemm)/i);
    // Long marketing lines: keep only the sentences with the numbers.
    const short =
      line.length > 140
        ? line.split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9])/).filter((s) => CONCRETE.test(s)).join(" ") || line
        : line;
    const clean = short.replace(/^[\s+\-–•*]+/, "");
    const offer: FoundOffer = {
      title: titleFor(prev, clean),
      text: clean,
      priceEur: firstEuro(line),
      discountPct: pct ? Number(pct[1]) : null,
      validUntil,
    };
    const key = offerKey(line);
    if (!found.has(key)) found.set(key, offer);
  });

  return [...found.values()].slice(0, 5);
}
