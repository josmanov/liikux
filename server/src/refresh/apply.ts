import { normHours } from "./text.js";
import type { Membership } from "./chainSources.js";

/**
 * Decides which found values may be written automatically.
 *
 *   - Nothing is ever cleared: a value the page did not give is left alone.
 *   - A price must be 10–200 € and within ±40 % of the old one. A bigger
 *     jump is "held": logged, not written, shown in the admin view to approve.
 *   - Hours, yes/no facts and the membership list are written when they differ.
 */

export type Facts = {
  priceFrom?: number | null;
  hoursWeekday?: string | null;
  hoursWeekend?: string | null;
  is247?: boolean | null;
  dayPass?: boolean | null;
  freeTrial?: boolean | null;
  memberships?: Membership[] | null;
};

export type Current = {
  priceFrom: number | null;
  hoursWeekday: string | null;
  hoursWeekend: string | null;
  is247: boolean | null;
  dayPass: boolean | null;
  freeTrial: boolean | null;
  membershipsJson: string | null;
};

export type Field = keyof Current;

export type Change = {
  field: Field;
  oldValue: string | null;
  newValue: string;
  status: "applied" | "held";
  reason?: string | undefined;
};

export const MAX_JUMP = 0.4;

/** "06:00–22:00" → 16 */
function openHours(range: string) {
  const [a, b] = range.split("–").map((t) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) + (m ?? 0) / 60;
  });
  if (a == null || b == null) return 0;
  return b > a ? b - a : b + 24 - a;
}

const str = (v: unknown) => (v == null ? null : typeof v === "string" ? v : JSON.stringify(v));

/** Turns a logged value back into the column's type (used by undo / approve). */
export function fromLogged(field: Field, value: string | null): unknown {
  if (value == null) return null;
  if (field === "priceFrom") return Number(value);
  if (field === "is247" || field === "dayPass" || field === "freeTrial") return value === "true";
  return value;
}

export function planChanges(current: Current, found: Facts, opts: { acceptBig?: boolean } = {}) {
  const set: Partial<Record<Field, unknown>> = {};
  const changes: Change[] = [];

  const p = found.priceFrom;
  if (p != null) {
    const old = current.priceFrom;
    if (old == null || Math.abs(old - p) >= 0.005) {
      let reason: string | undefined;
      if (p < 15 || p > 200) reason = "hinta ei ole välillä 15–200 €";
      else if (old != null && Math.abs(p - old) / old > MAX_JUMP && !opts.acceptBig) {
        reason = `muutos yli ${MAX_JUMP * 100} %`;
      }
      changes.push({ field: "priceFrom", oldValue: str(old), newValue: String(p), status: reason ? "held" : "applied", reason });
      if (!reason) set.priceFrom = p;
    }
  }

  for (const field of ["hoursWeekday", "hoursWeekend"] as const) {
    const next = normHours(found[field]);
    if (!next || !/^(24\/7|\d{2}:\d{2}–\d{2}:\d{2})$/.test(next)) continue;
    // A gym open less than 8 hours a day is almost always a misread
    // (staffed desk hours, a class time): keep the old value.
    if (next !== "24/7" && openHours(next) < 8) continue;
    if (normHours(current[field]) === next) continue;
    changes.push({ field, oldValue: current[field], newValue: next, status: "applied" });
    set[field] = next;
  }

  for (const field of ["is247", "dayPass", "freeTrial"] as const) {
    const next = found[field];
    if (next == null || current[field] === next) continue;
    changes.push({ field, oldValue: str(current[field]), newValue: String(next), status: "applied" });
    set[field] = next;
  }

  const list = found.memberships;
  if (list && list.length) {
    const next = JSON.stringify(list);
    if (next !== current.membershipsJson) {
      // The price list follows the price: if the price is held, so is the list.
      const priceHeld = changes.some((c) => c.field === "priceFrom" && c.status === "held");
      changes.push({
        field: "membershipsJson",
        oldValue: current.membershipsJson,
        newValue: next,
        status: priceHeld ? "held" : "applied",
        reason: priceHeld ? "odottaa hinnan hyväksyntää" : undefined,
      });
      if (!priceHeld) set.membershipsJson = next;
    }
  }

  return { set, changes };
}
