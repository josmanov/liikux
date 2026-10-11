import {
  cityCenterForName,
  cityFromLabel,
} from "../data/citySlug";
import { regionForCitySlug, regionForLabel } from "../data/regionSlug";

export type Lang = "fi" | "en";

export function langFromPath(pathname: string): Lang {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  return "fi";
}

export function pathHome(lang: Lang) {
  return lang === "en" ? "/en" : "/";
}

export function pathGyms(lang: Lang) {
  return lang === "en" ? "/en/gyms" : "/fi/kuntosalit";
}

export function pathGymsBrowse(
  lang: Lang,
  regionSlug?: string | null,
  citySlug?: string | null,
) {
  const region = (regionSlug || "").trim().toLowerCase();
  const city = (citySlug || "").trim().toLowerCase();
  if (!region) return pathGyms(lang);
  if (city) {
    return lang === "en"
      ? `/en/gyms/${region}/${city}`
      : `/fi/kuntosalit/${region}/${city}`;
  }
  return lang === "en" ? `/en/gyms/${region}` : `/fi/kuntosalit/${region}`;
}

export function pathGymsCity(lang: Lang, citySlug: string) {
  const slug = citySlug.trim().toLowerCase();
  if (!slug) return pathGyms(lang);
  const region = regionForCitySlug(slug);
  if (!region) return pathGyms(lang);
  return pathGymsBrowse(lang, region.slug, slug);
}

export function pathGymsFromLocation(lang: Lang, locationLabel: string) {
  const cityName = cityFromLabel(locationLabel);
  const center = cityName ? cityCenterForName(cityName) : null;
  if (center) {
    const region = regionForCitySlug(center.slug);
    if (region) return pathGymsBrowse(lang, region.slug, center.slug);
  }
  const region = regionForLabel(locationLabel);
  if (region) return pathGymsBrowse(lang, region.slug);
  return pathGyms(lang);
}

export function pathGym(lang: Lang, slug: string) {
  return lang === "en" ? `/en/gym/${slug}` : `/fi/sali/${slug}`;
}

export function pathChain(lang: Lang, slug: string) {
  return lang === "en" ? `/en/chain/${slug}` : `/fi/ketju/${slug}`;
}

export type LegalPageId = "terms" | "privacy" | "cookies";

export function pathLegal(lang: Lang, page: LegalPageId) {
  if (lang === "en") {
    if (page === "terms") return "/en/terms";
    if (page === "privacy") return "/en/privacy";
    return "/en/cookies";
  }
  if (page === "terms") return "/fi/kayttoehdot";
  if (page === "privacy") return "/fi/tietosuoja";
  return "/fi/evasteet";
}

export function switchLangPath(
  pathname: string,
  next: Lang,
  search = "",
): string {
  let path = pathHome(next);
  if (pathname === "/" || pathname === "/en") {
    path = pathHome(next);
  } else {
    const gymsNested = pathname.match(
      /^\/(fi|en)\/(kuntosalit|gyms)\/([^/]+)\/([^/]+)$/,
    );
    if (gymsNested) {
      path = pathGymsBrowse(next, gymsNested[3], gymsNested[4]);
    } else {
      const gymsRegion = pathname.match(
        /^\/(fi|en)\/(kuntosalit|gyms)\/([^/]+)$/,
      );
      if (gymsRegion) path = pathGymsBrowse(next, gymsRegion[3]);
      else {
        const gymsMatch = pathname.match(/^\/(fi|en)\/(kuntosalit|gyms)$/);
        if (gymsMatch) path = pathGyms(next);
        else {
          const chainMatch = pathname.match(
            /^\/(fi|en)\/(ketju|chain)\/([^/]+)$/,
          );
          if (chainMatch) path = pathChain(next, chainMatch[3]);
          else {
            const gymMatch = pathname.match(/^\/(fi|en)\/(sali|gym)\/([^/]+)$/);
            if (gymMatch) path = pathGym(next, gymMatch[3]);
            else {
              const legalMatch = pathname.match(
                /^\/(fi|en)\/(kayttoehdot|tietosuoja|evasteet|terms|privacy|cookies)$/,
              );
              if (legalMatch) {
                const raw = legalMatch[2];
                const id: LegalPageId =
                  raw === "kayttoehdot" || raw === "terms"
                    ? "terms"
                    : raw === "tietosuoja" || raw === "privacy"
                      ? "privacy"
                      : "cookies";
                path = pathLegal(next, id);
              }
            }
          }
        }
      }
    }
  }
  if (!search || search === "?") return path;
  return path + (search.startsWith("?") ? search : `?${search}`);
}
