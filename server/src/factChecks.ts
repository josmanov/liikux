import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { factChecks } from "../db/schema.js";

/**
 * Reads the results of the daily data check (see verify-data.ts).
 *
 * If the fact_checks table does not exist yet (before `npm run db:push`),
 * these return "no checks" instead of failing, so the site keeps working.
 */

type Row = typeof factChecks.$inferSelect;

export type CheckInfo = {
  status: string;
  checkedAt: string;
  verifiedAt: string | null;
  sourceUrl: string | null;
  note: string | null;
};

export type GymChecks = { price?: CheckInfo; hours?: CheckInfo };

function add(target: GymChecks, row: Row) {
  if (row.field !== "price" && row.field !== "hours") return;
  target[row.field] = {
    status: row.status,
    checkedAt: row.checkedAt,
    verifiedAt: row.verifiedAt,
    sourceUrl: row.sourceUrl,
    note: row.note,
  };
}

export async function checksForGym(gymId: string): Promise<GymChecks> {
  const out: GymChecks = {};
  try {
    const rows = await db.select().from(factChecks).where(eq(factChecks.gymId, gymId));
    for (const row of rows) add(out, row);
  } catch {
    /* table missing: no checks yet */
  }
  return out;
}

/** gym id → its checks, for the admin view. */
export async function allChecks(): Promise<Map<string, GymChecks>> {
  const byGym = new Map<string, GymChecks>();
  try {
    for (const row of await db.select().from(factChecks)) {
      const entry = byGym.get(row.gymId) ?? {};
      add(entry, row);
      byGym.set(row.gymId, entry);
    }
  } catch {
    /* table missing: no checks yet */
  }
  return byGym;
}
