const chainWebsites: Record<string, string> = {
  easyfit: "https://www.easyfit.fi",
  elixia: "https://www.elixia.fi",
  fressi: "https://www.fressi.fi",
  fitness24seven: "https://fi.fitness24seven.com",
  "go-fitness": "https://mmkuntotalo.fi",
  liikku: "https://www.liikku.fi",
  forever: "https://www.foreverclub.fi",
  ladyline: "https://ladyline.fi",
  olefit: "https://ole.fit",
  esport: "https://esport.fi",
  unisport: "https://www.unisport.fi",
  mm: "https://mmkuntotalo.fi",
};

export function getChainWebsite(chainSlug: string | undefined | null) {
  if (!chainSlug) return null;
  return chainWebsites[chainSlug] ?? null;
}
