const STORAGE_KEY = "liikux-favorites";

export function readFavoriteSlugs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function writeFavoriteSlugs(slugs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}

export function toggleFavoriteSlug(slug: string): string[] {
  const current = readFavoriteSlugs();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug];
  writeFavoriteSlugs(next);
  return next;
}

export function isFavoriteSlug(slug: string): boolean {
  return readFavoriteSlugs().includes(slug);
}
