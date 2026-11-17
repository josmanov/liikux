import {
  cityCenterForName,
  cityFromLabel,
  nearestCityCenter,
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

/**
 * Browse page for a place. A place that is not a known city (e.g. "Asikkala",
 * or a street address) uses the nearest city when its position is known,
 * instead of showing all of Finland.
 */
export function pathGymsFromLocation(
  lang: Lang,
  locationLabel: string,
  position?: { lat: number | null; lng: number | null } | null,
) {
  const cityName = cityFromLabel(locationLabel);
  const center =
    (cityName ? cityCenterForName(cityName) : null) ||
    (position?.lat != null && position.lng != null ? nearestCityCenter(position.lat, position.lng) : null);
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

/** The page that lists every chain. */
export function pathChains(lang: Lang) {
  return lang === "en" ? "/en/chains" : "/fi/ketjut";
}

/** About page: where the data comes from, common questions. */
export function pathAbout(lang: Lang) {
  return lang === "en" ? "/en/about" : "/fi/tietoa";
}

/** Page for gym owners and chains. */
export function pathBusiness(lang: Lang) {
  return lang === "en" ? "/en/for-gyms" : "/fi/yrityksille";
}

/** Favorites + compare page. Pass slugs to make a share link. */
export function pathFavorites(lang: Lang, sharedSlugs?: string[]) {
  const base = lang === "en" ? "/en/favorites" : "/fi/suosikit";
  return sharedSlugs?.length ? `${base}?salit=${sharedSlugs.map(encodeURIComponent).join(",")}` : base;
}

export type FeedbackType = "suggest" | "error" | "feedback" | "business";

/** Feedback page: suggest a gym, report an error, or general feedback. */
export function pathFeedback(lang: Lang, type: FeedbackType = "feedback", gymSlug?: string) {
  const base = lang === "en" ? "/en/feedback" : "/fi/palaute";
  const q = new URLSearchParams({ type });
  if (gymSlug) q.set("gym", gymSlug);
  return `${base}?${q}`;
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
    if (pathname === "/fi/ketjut" || pathname === "/en/chains") return pathChains(next);
    if (pathname === "/fi/tietoa" || pathname === "/en/about") return pathAbout(next);
    if (pathname === "/fi/yrityksille" || pathname === "/en/for-gyms") return pathBusiness(next);
    if (pathname === "/fi/suosikit" || pathname === "/en/favorites") return pathFavorites(next) + search;
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
              } else if (/^\/(fi\/palaute|en\/feedback)$/.test(pathname)) {
                path = next === "en" ? "/en/feedback" : "/fi/palaute";
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
