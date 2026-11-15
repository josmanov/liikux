/**
 * Address search ("geocoding") for the whole app.
 *
 * 1. If DIGITRANSIT_API_KEY is set → ask Digitransit (best for Finnish addresses).
 * 2. Otherwise, or if Digitransit fails → ask Photon (free OpenStreetMap search).
 * 3. Clean up: remove duplicates, drop hits that don't fit what was typed,
 *    and sort so the most likely address near the user comes first.
 */
import { digitransitEnabled, digitransitSearch } from "./digitransit.js";
import {
  dedupeHits,
  hitFitsQuery,
  parseStreetQuery,
  photonSearch,
  rankHits,
  type GeocodeHit,
} from "./photon.js";

export { reverseAddress } from "./photon.js";
export type { GeocodeHit };

async function rawSearch(q: string, bias?: { lat: number; lng: number }) {
  if (digitransitEnabled()) {
    try {
      const hits = await digitransitSearch(q, bias);
      if (hits.length > 0) return hits;
    } catch {
      // fall through to Photon
    }
  }
  return photonSearch(q, bias);
}

export async function searchAddress(
  q: string,
  bias?: { lat: number; lng: number },
): Promise<GeocodeHit[]> {
  const { street, number } = parseStreetQuery(q);
  const raw = dedupeHits(await rawSearch(q, bias));
  const matched = raw.filter((h) => hitFitsQuery(h, q, street, number));
  const picked = matched.length > 0 ? matched : raw;
  return rankHits(picked, q, number, bias).slice(0, 6);
}
