const FORCE_KEY = "liikux-force-app";

function parseReleaseAt(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : null;
}

export function getReleaseAtMs(): number | null {
  return parseReleaseAt(import.meta.env.VITE_RELEASE_AT as string | undefined);
}

export function shouldShowComingSoon(now = Date.now()): boolean {
  if (import.meta.env.DEV) return false;

  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return false;
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search);
    if (q.get("app") === "1") return false;
  }

  const at = getReleaseAtMs();
  if (at == null) return false;
  return now < at;
}
