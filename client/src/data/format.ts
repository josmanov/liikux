import type { Lang } from "../i18n/lang";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatDistanceKm(km: number) {
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export function formatPriceFrom(
  eur: number | null | undefined,
  lang: Lang = "fi",
) {
  if (eur == null || !Number.isFinite(eur)) return null;
  const text = Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(2))).replace(".", ",");
  return lang === "en" ? `from ${text} €/mo` : `alk. ${text} €/kk`;
}

export function formatPricePill(
  eur: number | null | undefined,
  lang: Lang = "fi",
) {
  if (eur == null || !Number.isFinite(eur)) return null;
  const text = Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(1))).replace(".", ",");
  return lang === "en" ? `${text}€/mo` : `${text}€/kk`;
}

export function formatPriceCard(
  eur: number | null | undefined,
  lang: Lang = "fi",
) {
  if (eur == null || !Number.isFinite(eur)) return null;
  const text = Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(1))).replace(".", ",");
  return lang === "en" ? `From ${text} €/mo` : `Alk. ${text} €/kk`;
}

function priceNumberText(eur: number) {
  return Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(1))).replace(".", ",");
}

export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  lang: Lang = "fi",
) {
  if (min == null || !Number.isFinite(min)) return null;
  const lo = min;
  const hi = max != null && Number.isFinite(max) ? max : min;
  const unit = lang === "en" ? "€/mo" : "€/kk";
  if (Math.abs(hi - lo) < 0.05) {
    return `${priceNumberText(lo)} ${unit}`;
  }
  return `${priceNumberText(lo)} – ${priceNumberText(hi)} ${unit}`;
}

export function formatGymStreetLine(gym: {
  address?: string | null;
  city?: string | null;
}) {
  let street = (gym.address || "").trim();
  const city = (gym.city || "").trim();
  if (city && street) {
    street = street
      .replace(new RegExp(`,?\\s*\\d{5}\\s+${escapeRe(city)}\\s*$`, "i"), "")
      .replace(new RegExp(`,\\s*${escapeRe(city)}\\s*$`, "i"), "")
      .trim();
  }
  return street;
}

export function formatGymAddressLine(gym: {
  address?: string | null;
  city?: string | null;
}) {
  const street = formatGymStreetLine(gym);
  const city = (gym.city || "").trim();
  if (street && city) return `${street}, ${city}`;
  return street || city;
}

export function cleanGymDisplayName(
  name: string,
  opts?: { chainName?: string | null; city?: string | null },
) {
  const base = name
    .replace(/\s*\/\s*kuntokeskus\b/gi, "")
    .replace(/\s*\/\s*kuntosalit?\b.*$/gi, "")
    .replace(/\s*-\s*kuntokeskus\b/gi, "")
    .replace(/\s*-\s*kuntosali\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  let out = base;
  const chainName = opts?.chainName?.trim();
  if (chainName) {
    out = out.replace(new RegExp(`^${escapeRe(chainName)}\\s+`, "i"), "").trim();
  }
  const city = opts?.city?.trim();
  if (city) {
    out = out.replace(new RegExp(`^${escapeRe(city)}\\s+`, "i"), "").trim();
    out = out
      .replace(new RegExp(`\\s+${escapeRe(city)}(?=\\s|$)`, "i"), "")
      .trim();
  }
  out = out
    .replace(/\s+Group\b/gi, "")
    .replace(/^[\s\-–—:/]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out || base;
}
