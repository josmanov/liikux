import {
  hasAnalyticsConsent,
  readCookieConsent,
} from "./data/cookieConsent";

const GA_SCRIPT_ID = "liikux-ga-script";
const GA_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function clearGaCookies() {
  const cookies = document.cookie.split(";");
  for (const part of cookies) {
    const name = part.split("=")[0]?.trim();
    if (!name) continue;
    if (
      name === "_ga" ||
      name.startsWith("_ga_") ||
      name === "_gid" ||
      name === "_gat"
    ) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `${name}=; Path=/; Max-Age=0; Domain=${window.location.hostname}; SameSite=Lax`;
    }
  }
}

function removeGaScript() {
  const el = document.getElementById(GA_SCRIPT_ID);
  if (el) el.remove();
  delete window.gtag;
  window.dataLayer = [];
  clearGaCookies();
}

function injectGaScript() {
  if (!GA_ID) return;
  if (document.getElementById(GA_SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
}

export function syncAnalyticsFromConsent() {
  if (hasAnalyticsConsent(readCookieConsent())) {
    injectGaScript();
  } else {
    removeGaScript();
  }
}

export function trackPageView(path: string) {
  if (!hasAnalyticsConsent() || !GA_ID || !window.gtag) return;
  window.gtag("event", "page_view", { page_path: path });
}

export function isAnalyticsConfigured() {
  return GA_ID.length > 0;
}

export function isAnalyticsRunning() {
  return (
    hasAnalyticsConsent() &&
    Boolean(GA_ID) &&
    Boolean(document.getElementById(GA_SCRIPT_ID))
  );
}
