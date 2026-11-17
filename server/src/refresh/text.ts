import { createHash } from "node:crypto";

/**
 * Small text helpers for the daily refresh. Pages arrive as text from
 * politeFetch (verify/politeFetch.ts); some sites still leave HTML codes such
 * as "&#xE4;" (ä) or "&#x20AC;" (€) in it.
 */

const NAMED: Record<string, string> = {
  amp: "&", nbsp: " ", euro: "€", auml: "ä", ouml: "ö", aring: "å", Auml: "Ä",
  Ouml: "Ö", Aring: "Å", ndash: "–", mdash: "—", shy: "", quot: '"', apos: "'",
  trade: "™", lt: "<", gt: ">",
};

export function decode(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (all, name) => NAMED[name] ?? all)
    .replace(/­/g, "")
    .replace(/ /g, " ")
    // "32 90 €" → "32,90 €"
    .replace(/(\d{1,3})\s+(\d{2})\s*€/g, "$1,$2 €");
}

/** The page as trimmed, non-empty lines. */
export function linesOf(text: string) {
  return decode(text)
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** "36,90" / "36.90" / "429" → number. */
export function euro(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** First euro amount in a line ("32,90 €", "17€/kk", "29,90 €:n") or null. */
export function firstEuro(line: string): number | null {
  const m = line.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*€/);
  return m ? euro(m[1]) : null;
}

/** Page fingerprint, to see whether a page changed since the last run. */
export function hashOf(text: string) {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

/** Opening hours in one form: "06:00–23:00" or "24/7"; "05:00–00:00" → "05:00–24:00". */
export function normHours(h: string | null | undefined): string | null {
  if (!h) return null;
  const t = h.trim();
  if (/^24\s*\/\s*7$/.test(t)) return "24/7";
  const m = t.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m?.[1] || !m[2] || !m[3] || !m[4]) return t;
  const end = m[3] === "00" || m[3] === "0" ? (m[4] === "00" ? "24" : m[3]) : m[3];
  return `${m[1].padStart(2, "0")}:${m[2]}–${end.padStart(2, "0")}:${m[4]}`;
}
