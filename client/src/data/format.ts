export function formatDistanceKm(km: number) {
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export function formatPriceFrom(eur: number | null | undefined) {
  if (eur == null || !Number.isFinite(eur)) return null;
  const text = Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(2))).replace(".", ",");
  return `alk. ${text} €/kk`;
}

export function formatPricePill(eur: number | null | undefined) {
  if (eur == null || !Number.isFinite(eur)) return null;
  const text = Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(1))).replace(".", ",");
  return `${text}€/kk`;
}

export function cleanGymDisplayName(name: string) {
  return name
    .replace(/\s*\/\s*kuntokeskus\b/gi, "")
    .replace(/\s*\/\s*kuntosalit?\b.*$/gi, "")
    .replace(/\s*-\s*kuntokeskus\b/gi, "")
    .replace(/\s*-\s*kuntosali\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
