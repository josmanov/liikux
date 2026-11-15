/**
 * Tiny in-memory cache with "stale-while-revalidate".
 *
 * - Fresh (younger than ttlMs): return the cached value.
 * - Stale (older than ttlMs but younger than staleMs): return the cached
 *   value immediately AND refresh it in the background.
 * - Missing or too old: load it now (the caller waits).
 *
 * Why: the Neon database sleeps when idle and takes a few seconds to wake up.
 * With this, only the very first request after a server restart waits for it;
 * everyone else gets an instant answer while the refresh happens behind the scenes.
 */
type Entry = {
  storedAt: number;
  value: unknown;
};

const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;

const store = new Map<string, Entry>();
const refreshing = new Map<string, Promise<unknown>>();

function loadAndStore<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = refreshing.get(key);
  if (running) return running as Promise<T>;

  const p = load()
    .then((value) => {
      store.set(key, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => refreshing.delete(key));
  refreshing.set(key, p);
  return p;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  staleMs = DEFAULT_STALE_MS,
): Promise<{ data: T; hit: boolean }> {
  const existing = store.get(key);
  const age = existing ? Date.now() - existing.storedAt : Infinity;

  if (existing && age < ttlMs) {
    return { data: existing.value as T, hit: true };
  }

  if (existing && age < staleMs) {
    // Serve the old value now, refresh quietly. Errors keep the old value.
    loadAndStore(key, load).catch(() => {});
    return { data: existing.value as T, hit: true };
  }

  const data = await loadAndStore(key, load);
  return { data, hit: false };
}
