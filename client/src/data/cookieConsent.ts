export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  functional: boolean;
  decided: boolean;
};

const STORAGE_KEY = "liikux-cookie-consent";
const OLD_KEY = "liikux-cookies-ok";
export const COOKIE_SETTINGS_EVENT = "liikux:open-cookie-settings";

const DEFAULT: CookieConsent = {
  necessary: true,
  analytics: false,
  functional: false,
  decided: false,
};

type Listener = (consent: CookieConsent) => void;
const listeners = new Set<Listener>();

function notify(consent: CookieConsent) {
  for (const fn of listeners) fn(consent);
}

export function readCookieConsent(): CookieConsent {
  try {
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<CookieConsent> & {
      marketing?: boolean;
    };
    const functional =
      typeof parsed.functional === "boolean"
        ? parsed.functional
        : typeof parsed.marketing === "boolean"
          ? parsed.marketing
          : null;
    if (
      typeof parsed.analytics !== "boolean" ||
      functional == null ||
      parsed.decided !== true
    ) {
      return { ...DEFAULT };
    }
    return {
      necessary: true,
      analytics: parsed.analytics,
      functional,
      decided: true,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeCookieConsent(next: {
  analytics: boolean;
  functional: boolean;
}): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    analytics: next.analytics,
    functional: next.functional,
    decided: true,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    /* ignore */
  }
  notify(consent);
  return consent;
}

export function subscribeCookieConsent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}

export function hasAnalyticsConsent(consent = readCookieConsent()) {
  return consent.decided && consent.analytics === true;
}

export function hasFunctionalConsent(consent = readCookieConsent()) {
  return consent.decided && consent.functional === true;
}
