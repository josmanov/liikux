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
      }
    }
  }
  if (!search || search === "?") return path;
  return path + (search.startsWith("?") ? search : `?${search}`);
}
