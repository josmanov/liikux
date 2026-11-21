import type { Chain, Gym } from "./types";
import { API, previewHeaders } from "./apiBase";
import { DISABLED_CHAIN_SLUGS } from "../features/browse/utils/mapConstants";
const CLIENT_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  at: number;
  promise: Promise<T>;
};

let gymsCache: CacheEntry<Gym[]> | null = null;
let chainsCache: CacheEntry<Chain[]> | null = null;

export function clearChainsCache() {
  chainsCache = null;
}
let statsCache: CacheEntry<HomeStats> | null = null;

export type HomeStats = {
  gymCount: number;
  cityCount: number;
  chainCount: number;
};

/**
 * GET JSON, and try once more after a short pause if the first try fails
 * (e.g. a network hiccup on mobile). Without this, one failed request
 * showed an empty gym list until the page was reloaded.
 */
async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  init = { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), ...previewHeaders() } };
  try {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    await new Promise((ok) => setTimeout(ok, 700));
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
}

function stillFresh(at: number) {
  return Date.now() - at < CLIENT_TTL_MS;
}

/**
 * Gyms and chains are kept in memory for the whole visit. A page that asks for
 * them again gets what was loaded before AT ONCE; if it is older than 2
 * minutes, a fresh copy is fetched quietly in the background for next time.
 * (Before, an old copy made every page wait for the 1 MB download again.)
 */
export function fetchGyms(): Promise<Gym[]> {
  if (gymsCache) {
    if (!stillFresh(gymsCache.at)) refreshGyms();
    return gymsCache.promise;
  }
  return refreshGyms();
}

let gymsRefreshing: Promise<Gym[]> | null = null;

function refreshGyms(): Promise<Gym[]> {
  if (gymsRefreshing) return gymsRefreshing;
  const promise = getJson(`${API}/api/gyms`)
    .then((data) => (Array.isArray(data) ? (data as Gym[]) : null))
    .catch(() => null)
    .then((list) => {
      gymsRefreshing = null;
      if (list) {
        const done = Promise.resolve(list);
        gymsCache = { at: Date.now(), promise: done };
        return list;
      }
      // Failed: keep showing what we have; with nothing, answer empty and try again next time.
      if (gymsCache) return gymsCache.promise;
      gymsCache = null;
      return [] as Gym[];
    });
  gymsRefreshing = promise;
  if (!gymsCache) gymsCache = { at: Date.now(), promise };
  return promise;
}

export function fetchChains(): Promise<Chain[]> {
  if (chainsCache) {
    if (!stillFresh(chainsCache.at)) refreshChains();
    return chainsCache.promise;
  }
  return refreshChains();
}

let chainsRefreshing: Promise<Chain[]> | null = null;

function refreshChains(): Promise<Chain[]> {
  if (chainsRefreshing) return chainsRefreshing;
  const promise = getJson(`${API}/api/chains`)
    .then((data) => (Array.isArray(data) ? (data as Chain[]) : null))
    // Hide chains that are switched off or have no gyms yet (see DISABLED_CHAIN_SLUGS).
    .then((chains) =>
      chains
        ? chains.filter((c) => !DISABLED_CHAIN_SLUGS.includes(c.slug) && (c.gymCount ?? 1) > 0)
        : null,
    )
    .catch(() => null)
    .then((list) => {
      chainsRefreshing = null;
      if (list) {
        chainsCache = { at: Date.now(), promise: Promise.resolve(list) };
        return list;
      }
      if (chainsCache) return chainsCache.promise;
      chainsCache = null;
      return [] as Chain[];
    });
  chainsRefreshing = promise;
  if (!chainsCache) chainsCache = { at: Date.now(), promise };
  return promise;
}

export function fetchHomeStats(): Promise<HomeStats> {
  if (statsCache && stillFresh(statsCache.at)) return statsCache.promise;

  const promise = getJson(`${API}/api/stats`)
    .then((raw) => {
      const data = raw as Partial<HomeStats> | null;
      return {
      gymCount: Number(data?.gymCount) || 0,
      cityCount: Number(data?.cityCount) || 0,
      chainCount: Number(data?.chainCount) || 0,
      };
    })
    .catch(() => {
      statsCache = null;
      return { gymCount: 0, cityCount: 0, chainCount: 0 };
    });

  statsCache = { at: Date.now(), promise };
  return promise;
}

export function fetchGymsAndChains(): Promise<[Gym[], Chain[]]> {
  return Promise.all([fetchGyms(), fetchChains()]);
}

export type ChainGymsResponse = {
  chain: Chain;
  gyms: Gym[];
};

const chainGymsCache = new Map<string, CacheEntry<ChainGymsResponse | null>>();

export function fetchChainGyms(
  slug: string,
): Promise<ChainGymsResponse | null> {
  const key = slug.trim();
  if (!key) return Promise.resolve(null);

  const existing = chainGymsCache.get(key);
  if (existing && stillFresh(existing.at)) return existing.promise;

  const promise = fetch(`${API}/api/chains/${encodeURIComponent(key)}/gyms`, { headers: previewHeaders() })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = await r.json();
      if (!data?.chain || !Array.isArray(data.gyms)) return null;
      return data as ChainGymsResponse;
    })
    .catch(() => {
      chainGymsCache.delete(key);
      return null;
    });

  chainGymsCache.set(key, { at: Date.now(), promise });
  return promise;
}
