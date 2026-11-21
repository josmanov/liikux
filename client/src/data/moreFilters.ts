import type { Chain, ChainSummary, Gym } from "./types";
import { parseMembershipsJson } from "./types";

/**
 * The extra filters that only live in "Kaikki suodattimet" (the all-filters
 * panel). They are not shortcuts of anything else on the page.
 */
export type MoreFilters = {
  /** Open at this moment (Finnish time), from the opening hours. */
  openNow: boolean;
  /** A membership with no binding period exists. */
  noContract: boolean;
  /** The gym or its chain has a campaign right now. */
  hasOffer: boolean;
  /** Price checked against the gym's own page in the last 30 days. */
  verified: boolean;
};

export const NO_MORE_FILTERS: MoreFilters = {
  openNow: false,
  noContract: false,
  hasOffer: false,
  verified: false,
};

export function countMoreFilters(m: MoreFilters): number {
  return (
    (m.openNow ? 1 : 0) +
    (m.noContract ? 1 : 0) +
    (m.hasOffer ? 1 : 0) +
    (m.verified ? 1 : 0)
  );
}

type AnyChain = Chain | ChainSummary | null | undefined;

/** Some membership has no binding period (0 months). */
export function gymHasNoContract(gym: Gym, chain: AnyChain): boolean {
  const own = parseMembershipsJson(gym.membershipsJson);
  const list = own.length > 0 ? own : parseMembershipsJson((chain as Chain | null)?.membershipsJson);
  return list.some((m) => m.commitmentMonths === 0);
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function gymIsRecentlyChecked(gym: Gym, now: number): boolean {
  const at = gym.checkedAt ?? gym.offerCheckedAt ?? null;
  if (!at) return false;
  const ms = Date.parse(at);
  return Number.isFinite(ms) && now - ms <= MONTH_MS;
}

/** "06:30–22:00", "6-22", "6.30 - 22.00" -> minutes from midnight, or null. */
function parseRange(text: string): { from: number; to: number } | null {
  const m = text.match(/(\d{1,2})(?:[:.](\d{2}))?\s*[–-]\s*(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const from = Number(m[1]) * 60 + Number(m[2] ?? 0);
  let to = Number(m[3]) * 60 + Number(m[4] ?? 0);
  if (to === 0) to = 24 * 60;
  return { from, to };
}

function helsinkiNow(now: number): { weekend: boolean; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday");
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return { weekend: day === "Sat" || day === "Sun", minutes };
}

/**
 * Open right now? true / false when the hours can be read, null when they are
 * missing or in a form we do not understand (those gyms are not shown by the
 * filter, because we cannot promise they are open).
 */
export function gymIsOpenNow(gym: Gym, chain: AnyChain, now: number): boolean | null {
  const c = chain as Chain | null | undefined;
  const weekdayText = gym.hoursWeekday?.trim() || c?.hoursWeekday?.trim() || "";
  const weekendText = gym.hoursWeekend?.trim() || c?.hoursWeekend?.trim() || "";
  if (gym.is247 === true || (gym.is247 == null && c?.is247 === true)) return true;
  if (/24\s*\/\s*7/.test(weekdayText)) return true;

  const { weekend, minutes } = helsinkiNow(now);
  const text = weekend && weekendText ? weekendText : weekdayText;
  if (!text) return null;
  if (/suljettu|closed/i.test(text)) return false;
  const range = parseRange(text);
  if (!range) return null;
  return minutes >= range.from && minutes < range.to;
}

export function gymMatchesMore(
  gym: Gym,
  chain: AnyChain,
  more: MoreFilters,
  now: number,
): boolean {
  if (more.openNow && gymIsOpenNow(gym, chain, now) !== true) return false;
  if (more.noContract && !gymHasNoContract(gym, chain)) return false;
  if (more.hasOffer && gym.hasOffer !== true) return false;
  if (more.verified && !gymIsRecentlyChecked(gym, now)) return false;
  return true;
}
