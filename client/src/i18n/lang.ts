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
    const gymsMatch = pathname.match(/^\/(fi|en)\/(kuntosalit|gyms)$/);
    if (gymsMatch) path = pathGyms(next);
    else {
      const chainMatch = pathname.match(/^\/(fi|en)\/(ketju|chain)\/([^/]+)$/);
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
  if (!search || search === "?") return path;
  return path + (search.startsWith("?") ? search : `?${search}`);
}
