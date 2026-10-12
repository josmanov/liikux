export type CityCenter = { name: string; slug: string; lat: number; lng: number };

export const CITY_CENTERS: CityCenter[] = [
  { name: "Helsinki", slug: "helsinki", lat: 60.1699, lng: 24.9384 },
  { name: "Espoo", slug: "espoo", lat: 60.2055, lng: 24.6559 },
  { name: "Vantaa", slug: "vantaa", lat: 60.2934, lng: 25.0378 },
  { name: "Tampere", slug: "tampere", lat: 61.4978, lng: 23.761 },
  { name: "Turku", slug: "turku", lat: 60.4518, lng: 22.2666 },
  { name: "Oulu", slug: "oulu", lat: 65.0121, lng: 25.4651 },
  { name: "Jyväskylä", slug: "jyvaskyla", lat: 62.2426, lng: 25.7473 },
  { name: "Kuopio", slug: "kuopio", lat: 62.8924, lng: 27.677 },
  { name: "Lahti", slug: "lahti", lat: 60.9827, lng: 25.6612 },
  { name: "Kouvola", slug: "kouvola", lat: 60.8679, lng: 26.7041 },
  { name: "Pori", slug: "pori", lat: 61.4851, lng: 21.7974 },
  { name: "Joensuu", slug: "joensuu", lat: 62.601, lng: 29.7636 },
  { name: "Lappeenranta", slug: "lappeenranta", lat: 61.0583, lng: 28.1887 },
  { name: "Hämeenlinna", slug: "hameenlinna", lat: 60.9959, lng: 24.4643 },
  { name: "Vaasa", slug: "vaasa", lat: 63.096, lng: 21.6158 },
  { name: "Seinäjoki", slug: "seinajoki", lat: 62.7903, lng: 22.8403 },
  { name: "Rovaniemi", slug: "rovaniemi", lat: 66.5039, lng: 25.7294 },
  { name: "Mikkeli", slug: "mikkeli", lat: 61.6886, lng: 27.2725 },
  { name: "Kotka", slug: "kotka", lat: 60.4664, lng: 26.9458 },
  { name: "Salo", slug: "salo", lat: 60.3833, lng: 23.1333 },
  { name: "Porvoo", slug: "porvoo", lat: 60.3925, lng: 25.665 },
  { name: "Lohja", slug: "lohja", lat: 60.2485, lng: 24.065 },
  { name: "Hyvinkää", slug: "hyvinkaa", lat: 60.6333, lng: 24.8667 },
  { name: "Nurmijärvi", slug: "nurmijarvi", lat: 60.4641, lng: 24.8073 },
  { name: "Järvenpää", slug: "jarvenpaa", lat: 60.4737, lng: 25.0899 },
  { name: "Tuusula", slug: "tuusula", lat: 60.4037, lng: 25.0265 },
  { name: "Kerava", slug: "kerava", lat: 60.4037, lng: 25.105 },
  { name: "Kirkkonummi", slug: "kirkkonummi", lat: 60.1236, lng: 24.4385 },
  { name: "Riihimäki", slug: "riihimaki", lat: 60.737, lng: 24.7773 },
  { name: "Kauniainen", slug: "kauniainen", lat: 60.2098, lng: 24.728 },
];

const bySlug = new Map<string, CityCenter>();
const byName = new Map<string, CityCenter>();
for (const c of CITY_CENTERS) {
  if (!bySlug.has(c.slug)) bySlug.set(c.slug, c);
  byName.set(c.name.toLowerCase(), c);
}

export function toCitySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cityFromLabel(label: string): string | null {
  const raw = label.trim();
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const cleaned = parts[i].replace(/^\d{5}\s+/, "").trim();
    if (!cleaned) continue;
    if (byName.has(cleaned.toLowerCase())) return cleaned;
    const fromSlug = bySlug.get(toCitySlug(cleaned));
    if (fromSlug) return fromSlug.name;
  }
  if (parts.length === 1) {
    const only = parts[0];
    if (byName.has(only.toLowerCase())) return only;
    if (
      /^[A-Za-zÀ-ÿÄÖÅäöå\s-]+$/.test(only) &&
      only.length >= 3 &&
      !/\d/.test(only)
    ) {
      return only;
    }
  }
  return null;
}

export function nearestCityCenter(
  lat: number,
  lng: number,
  maxKm = 100,
): CityCenter | null {
  let best: CityCenter | null = null;
  let bestKm = Infinity;
  const cos = Math.cos((lat * Math.PI) / 180);
  for (const c of CITY_CENTERS) {
    const dLat = (c.lat - lat) * 111.32;
    const dLng = (c.lng - lng) * 111.32 * cos;
    const km = Math.hypot(dLat, dLng);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return best && bestKm <= maxKm ? best : null;
}

export function cityCenterForName(name: string): CityCenter | null {
  const key = name.trim().toLowerCase();
  if (byName.has(key)) return byName.get(key)!;
  const slug = toCitySlug(name);
  return bySlug.get(slug) ?? null;
}

export function cityCenterForSlug(slug: string): CityCenter | null {
  return bySlug.get(slug.trim().toLowerCase()) ?? null;
}

export function displayCityName(slugOrName: string): string {
  const fromSlug = cityCenterForSlug(slugOrName);
  if (fromSlug) return fromSlug.name;
  const fromName = cityCenterForName(slugOrName);
  if (fromName) return fromName.name;
  if (!slugOrName) return "";
  return slugOrName.charAt(0).toUpperCase() + slugOrName.slice(1);
}

export const SEO_CITY_SLUGS = [
  ...new Set(CITY_CENTERS.map((c) => c.slug)),
];
