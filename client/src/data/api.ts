import type { Chain, Gym } from "./types";

const API = "http://localhost:3001";
const CLIENT_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  at: number;
  promise: Promise<T>;
};

let gymsCache: CacheEntry<Gym[]> | null = null;
let chainsCache: CacheEntry<Chain[]> | null = null;
let statsCache: CacheEntry<HomeStats> | null = null;

export type HomeStats = {
  gymCount: number;
  cityCount: number;
  chainCount: number;
};

function stillFresh(at: number) {
  return Date.now() - at < CLIENT_TTL_MS;
}

export function fetchGyms(): Promise<Gym[]> {
  if (gymsCache && stillFresh(gymsCache.at)) return gymsCache.promise;

  const promise = fetch(`${API}/api/gyms`)
    .then((r) => r.json())
    .then((data) => (Array.isArray(data) ? (data as Gym[]) : []))
    .catch(() => {
      gymsCache = null;
      return [] as Gym[];
    });

  gymsCache = { at: Date.now(), promise };
  return promise;
}

export function fetchChains(): Promise<Chain[]> {
  if (chainsCache && stillFresh(chainsCache.at)) return chainsCache.promise;

  const promise = fetch(`${API}/api/chains`)
    .then((r) => r.json())
    .then((data) => (Array.isArray(data) ? (data as Chain[]) : []))
    .catch(() => {
      chainsCache = null;
      return [] as Chain[];
    });

  chainsCache = { at: Date.now(), promise };
  return promise;
}

export function fetchHomeStats(): Promise<HomeStats> {
  if (statsCache && stillFresh(statsCache.at)) return statsCache.promise;

  const promise = fetch(`${API}/api/stats`)
    .then((r) => r.json())
    .then((data) => ({
      gymCount: Number(data?.gymCount) || 0,
      cityCount: Number(data?.cityCount) || 0,
      chainCount: Number(data?.chainCount) || 0,
    }))
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

  const promise = fetch(`${API}/api/chains/${encodeURIComponent(key)}/gyms`)
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
