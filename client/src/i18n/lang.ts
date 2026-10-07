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

export function switchLangPath(pathname: string, next: Lang): string {
  if (pathname === "/" || pathname === "/en") {
    return pathHome(next);
  }

  const gymsMatch = pathname.match(/^\/(fi|en)\/(kuntosalit|gyms)$/);
  if (gymsMatch) return pathGyms(next);

  const chainMatch = pathname.match(/^\/(fi|en)\/(ketju|chain)\/([^/]+)$/);
  if (chainMatch) return pathChain(next, chainMatch[3]);

  const gymMatch = pathname.match(/^\/(fi|en)\/(sali|gym)\/([^/]+)$/);
  if (gymMatch) return pathGym(next, gymMatch[3]);

  return pathHome(next);
}
