type Entry = {
  expires: number;
  value: unknown;
};

const store = new Map<string, Entry>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<{ data: T; hit: boolean }> {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expires > now) {
    return { data: existing.value as T, hit: true };
  }

  const data = await load();
  store.set(key, { value: data, expires: now + ttlMs });
  return { data, hit: false };
}
