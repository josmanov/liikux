import {
  CITY_CENTERS,
  cityCenterForName,
  cityCenterForSlug,
  cityFromLabel,
  toCitySlug,
} from "./citySlug";

export type RegionInfo = { name: string; slug: string };

export const REGIONS: RegionInfo[] = [
  { name: "Uusimaa", slug: "uusimaa" },
  { name: "Varsinais-Suomi", slug: "varsinaissuomi" },
  { name: "Satakunta", slug: "satakunta" },
  { name: "Kanta-Häme", slug: "kanta-hame" },
  { name: "Pirkanmaa", slug: "pirkanmaa" },
  { name: "Päijät-Häme", slug: "paijat-hame" },
  { name: "Kymenlaakso", slug: "kymenlaakso" },
  { name: "Etelä-Karjala", slug: "etela-karjala" },
  { name: "Etelä-Savo", slug: "etela-savo" },
  { name: "Pohjois-Savo", slug: "pohjois-savo" },
  { name: "Pohjois-Karjala", slug: "pohjois-karjala" },
  { name: "Keski-Suomi", slug: "keski-suomi" },
  { name: "Etelä-Pohjanmaa", slug: "etela-pohjanmaa" },
  { name: "Pohjanmaa", slug: "pohjanmaa" },
  { name: "Keski-Pohjanmaa", slug: "keski-pohjanmaa" },
  { name: "Pohjois-Pohjanmaa", slug: "pohjois-pohjanmaa" },
  { name: "Kainuu", slug: "kainuu" },
  { name: "Lappi", slug: "lappi" },
  { name: "Ahvenanmaa", slug: "ahvenanmaa" },
];

const regionBySlug = new Map(REGIONS.map((r) => [r.slug, r]));
const regionByName = new Map(
  REGIONS.map((r) => [r.name.toLowerCase(), r]),
);

export function toRegionSlug(name: string): string {
  return toCitySlug(name);
}

export function regionFromSlug(slug: string): RegionInfo | null {
  return regionBySlug.get(slug.trim().toLowerCase()) ?? null;
}

export function regionFromName(name: string): RegionInfo | null {
  return regionByName.get(name.trim().toLowerCase()) ?? null;
}

const CITY_REGION_NAME: Record<string, string> = {
  helsinki: "Uusimaa",
  espoo: "Uusimaa",
  vantaa: "Uusimaa",
  kauniainen: "Uusimaa",
  porvoo: "Uusimaa",
  lohja: "Uusimaa",
  hyvinkaa: "Uusimaa",
  nurmijarvi: "Uusimaa",
  jarvenpaa: "Uusimaa",
  tuusula: "Uusimaa",
  kerava: "Uusimaa",
  kirkkonummi: "Uusimaa",
  riihimaki: "Kanta-Häme",
  hameenlinna: "Kanta-Häme",
  tampere: "Pirkanmaa",
  turku: "Varsinais-Suomi",
  salo: "Varsinais-Suomi",
  oulu: "Pohjois-Pohjanmaa",
  jyvaskyla: "Keski-Suomi",
  kuopio: "Pohjois-Savo",
  lahti: "Päijät-Häme",
  kouvola: "Kymenlaakso",
  kotka: "Kymenlaakso",
  pori: "Satakunta",
  joensuu: "Pohjois-Karjala",
  lappeenranta: "Etelä-Karjala",
  vaasa: "Pohjanmaa",
  seinajoki: "Etelä-Pohjanmaa",
  rovaniemi: "Lappi",
  mikkeli: "Etelä-Savo",
};

export function regionForCitySlug(citySlug: string): RegionInfo | null {
  const regionName = CITY_REGION_NAME[citySlug.trim().toLowerCase()];
  return regionName ? regionFromName(regionName) : null;
}

export function regionForCityName(cityName: string): RegionInfo | null {
  const center = cityCenterForName(cityName);
  const slug = center?.slug || toCitySlug(cityName);
  return regionForCitySlug(slug);
}

export function regionForLabel(label: string): RegionInfo | null {
  const city = cityFromLabel(label);
  if (!city) return null;
  return regionForCityName(city);
}

export function resolveCitySlug(citySlug: string) {
  return cityCenterForSlug(citySlug);
}

export { CITY_CENTERS, cityFromLabel, toCitySlug, cityCenterForName };
