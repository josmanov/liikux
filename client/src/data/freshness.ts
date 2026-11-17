import type { FactCheck } from "./types";

/** Whole days since an ISO date (0 = today), or null if there is no valid date. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000));
}

/** After this many days without a new confirmation we stop saying "confirmed". */
const MAX_AGE_DAYS = 30;

/**
 * How many whole days ago the daily robot last found this value on the gym's
 * own page (0 = today). Returns null when it was never confirmed, the last
 * check did not confirm it, or the confirmation is older than 30 days.
 */
export function confirmedDaysAgo(check: FactCheck | null | undefined): number | null {
  if (!check || check.status !== "confirmed" || !check.verifiedAt) return null;
  const then = new Date(check.verifiedAt);
  if (Number.isNaN(then.getTime())) return null;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days < 0 || days > MAX_AGE_DAYS) return null;
  return days;
}
