const FORCE_KEY = "liikux-force-app";
const MAINTENANCE_BYPASS_KEY = "liikux-maintenance-bypass";

function parseReleaseAt(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : null;
}

function forceAppOpen(): boolean {
  try {
    if (localStorage.getItem(FORCE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search);
    if (q.get("app") === "1") return true;
  }

  return false;
}

function envFlagOn(raw: string | undefined): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function maintenanceBypassOk(): boolean {
  const secret = String(
    import.meta.env.VITE_MAINTENANCE_BYPASS ?? "",
  ).trim();
  if (!secret) return false;

  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search);
    const app = q.get("app") ?? "";
    if (app === secret) {
      try {
        localStorage.setItem(MAINTENANCE_BYPASS_KEY, secret);
      } catch {
        /* ignore */
      }
      return true;
    }
  }

  try {
    if (localStorage.getItem(MAINTENANCE_BYPASS_KEY) === secret) return true;
  } catch {
    /* ignore */
  }

  return false;
}

export function getReleaseAtMs(): number | null {
  return parseReleaseAt(import.meta.env.VITE_RELEASE_AT as string | undefined);
}

export function shouldShowMaintenance(): boolean {
  if (!envFlagOn(import.meta.env.VITE_MAINTENANCE as string | undefined)) {
    return false;
  }
  if (maintenanceBypassOk()) return false;
  return true;
}

export function shouldShowComingSoon(now = Date.now()): boolean {
  if (import.meta.env.DEV) return false;
  if (forceAppOpen()) return false;

  const at = getReleaseAtMs();
  if (at == null) return false;
  return now < at;
}
