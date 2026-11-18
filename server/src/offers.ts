import { isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { offers } from "../db/schema.js";

/**
 * Offers found by the daily refresh (see refresh-data.ts).
 *
 * An offer is shown while:
 *   - a person approved it in the review page (status "approved"),
 *   - it was seen on the chain's or gym's page in the last 2 days,
 *   - its end date (if any) has not passed,
 *   - nobody hid it in the admin view.
 * So an offer that disappears from the chain's site disappears here too.
 *
 * Before `npm run db:push` the table does not exist; then there are no offers.
 */

export type PublicOffer = {
  id: string;
  title: string;
  text: string;
  priceEur: number | null;
  discountPct: number | null;
  validUntil: string | null;
  sourceUrl: string;
  chainWide: boolean;
};

type Row = typeof offers.$inferSelect;

const SEEN_WITHIN_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_PER_GYM = 3;

export function isActive(row: Row, now = new Date()) {
  if (row.status !== "approved" || row.hiddenAt) return false;
  if (now.getTime() - new Date(row.lastSeenAt).getTime() > SEEN_WITHIN_MS) return false;
  const today = now.toISOString().slice(0, 10);
  return !row.validUntil || row.validUntil >= today;
}

/** All offers on the site right now. */
export async function activeOffers(): Promise<Row[]> {
  try {
    const rows = await db.select().from(offers).where(isNull(offers.hiddenAt));
    return rows.filter((r) => isActive(r));
  } catch {
    return []; // table missing
  }
}

/** Offers with an end date or a concrete discount first; gym's own before the chain's. */
function rank(r: Row) {
  return (r.gymId ? 4 : 0) + (r.validUntil ? 2 : 0) + (r.discountPct != null || r.priceEur != null ? 1 : 0);
}

function toPublic(r: Row): PublicOffer {
  return {
    id: r.id,
    title: r.title,
    text: r.text,
    priceEur: r.priceEur,
    discountPct: r.discountPct,
    validUntil: r.validUntil,
    sourceUrl: r.sourceUrl,
    chainWide: !r.gymId,
  };
}

export function offersFor(all: Row[], gym: { id: string; chainId: string }): PublicOffer[] {
  return all
    .filter((r) => r.chainId === gym.chainId && (!r.gymId || r.gymId === gym.id))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, MAX_PER_GYM)
    .map(toPublic);
}

/** For the gym list: does this gym have at least one offer? */
export function offerLookup(all: Row[]) {
  const chainsWithOffer = new Set(all.filter((r) => !r.gymId).map((r) => r.chainId));
  const gymsWithOffer = new Set(all.filter((r) => r.gymId).map((r) => r.gymId!));
  return (gym: { id: string; chainId: string }) => chainsWithOffer.has(gym.chainId) || gymsWithOffer.has(gym.id);
}
