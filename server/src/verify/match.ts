/**
 * "Is the value we show still on the gym's page?"
 *
 * These functions only answer yes or no. They never invent a value:
 * the daily check confirms what is already in the database.
 */

const DASH = "[-–—]";

/** Joins prices that sites split into pieces, e.g. "32 90 €" → "32,90 €". */
function tidy(text: string) {
  return text
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/(\d{1,3})\s+(\d{2})\s*€/g, "$1,$2 €")
    .replace(/ /g, " ");
}

/** True when the price (e.g. 32.9 or 66) is written somewhere in the text. */
export function priceOnPage(text: string, price: number): boolean {
  const cents = Math.round(price * 100);
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  const page = tidy(text);

  if (rest === 0) {
    // A bare "66" is too common, so it must stand next to a euro mark.
    const after = new RegExp(`(?<![\\d.,])${euros}(?:[.,]00|[.,]-)?\\s*(?:€|eur\\b|e\\b)`, "i");
    const before = new RegExp(`€\\s*${euros}(?:[.,]00)?(?![\\d.,]\\d)`);
    return after.test(page) || before.test(page);
  }

  const two = String(rest).padStart(2, "0"); // 32.9 → "90"
  const short = rest % 10 === 0 ? `|${rest / 10}(?!\\d)` : ""; // also "32,9"
  return new RegExp(`(?<!\\d)${euros}[.,](?:${two}(?!\\d)${short})`).test(page);
}

function timePattern(time: string) {
  const [h = "0", m = "00"] = time.split(":");
  const hour = String(Number(h));
  const hours = hour === "24" || hour === "0" ? "(?:24|00|0)" : `0?${hour}`;
  const minutes = m === "00" ? "(?:[.:]00)?" : `[.:]${m}`;
  return `(?<!\\d)${hours}${minutes}(?![\\d])`;
}

/**
 * True when the opening hours are written in the text.
 * "24/7" matches "24/7", "24h" and "ympäri vuorokauden";
 * "06:00–23:00" matches "6-23", "06.00 – 23.00", "klo 6:00–23:00"…
 */
export function hoursOnPage(text: string, hours: string): boolean {
  const page = tidy(text);
  if (/24\s*\/\s*7/.test(hours)) {
    return /24\s*\/\s*7|\b24\s*h\b|ympäri vuorokauden|24 tuntia|kellon ympäri/i.test(page);
  }
  const parts = hours.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (!parts) return false;
  const [, from = "", to = ""] = parts;
  return new RegExp(`${timePattern(from)}\\s*${DASH}\\s*${timePattern(to)}`).test(page);
}

/**
 * Some monthly prices are worked out from a longer card: 380 € per year is
 * shown as 31,67 € per month. Returns the card that matches (months + total),
 * or null. Used only when the monthly price itself is not on the page.
 */
export function longerCardOnPage(text: string, monthly: number) {
  for (const months of [12, 6, 3]) {
    const total = monthly * months;
    const rounded = Math.round(total * 2) / 2; // totals end in ,00 or ,50
    if (Math.abs(total - rounded) > 0.07) continue;
    if (priceOnPage(text, rounded)) return { months, total: rounded };
  }
  return null;
}

/** Monthly-looking prices on the page: shown to the admin when ours is missing. */
export function pricesSeen(text: string, max = 6): number[] {
  const page = tidy(text);
  const seen = new Set<number>();
  const re = /(?<![\d.,])(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|eur\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(page))) {
    const n = Number((m[1] ?? "").replace(",", "."));
    if (Number.isFinite(n) && n >= 10 && n <= 200) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b).slice(0, max);
}
