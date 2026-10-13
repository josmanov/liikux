import type { Chain } from "../../../data/types";

export const OTHER_CHAIN_FILTER_ID = "yksityiset";

export const chainFilterOptionIds = [
  "elixia",
  "easyfit",
  "fressi",
  "fitness24",
  "olefit",
  "liikku",
  "forever",
  "ladyline",
  "esport",
  "unisport",
  "mm",
  OTHER_CHAIN_FILTER_ID,
] as const;

export const chainFilterBrandLabels: Record<string, string> = {
  elixia: "Elixia",
  easyfit: "EasyFit",
  fressi: "Fressi",
  fitness24: "Fitness24Seven",
  olefit: "Ole.Fit",
  liikku: "Liikku",
  forever: "Forever",
  ladyline: "LadyLine",
  esport: "Esport",
  unisport: "UniSport",
  mm: "M&M",
};

export const chainFilterOptions = chainFilterOptionIds.map((id) => ({
  id,
  label: id === OTHER_CHAIN_FILTER_ID ? "Yksityiset / muut" : chainFilterBrandLabels[id],
}));

export const allChainFilterIds = chainFilterOptions.map((o) => o.id);

export function chainMatchesFilterKey(chain: { slug: string }, key: string) {
  const slug = chain.slug.replace(/-/g, "").toLowerCase();
  const k = key.replace(/-/g, "").toLowerCase();
  return slug === k || slug.startsWith(k) || k.startsWith(slug);
}

export function isListedBrandChain(chain: { slug: string }) {
  return chainFilterOptions.some(
    (opt) =>
      opt.id !== OTHER_CHAIN_FILTER_ID && chainMatchesFilterKey(chain, opt.id),
  );
}

export function filterIdFromChainSlug(slug: string, chains: Chain[]) {
  const fromOptions = chainFilterOptions.find(
    (opt) =>
      opt.id !== OTHER_CHAIN_FILTER_ID &&
      chainMatchesFilterKey({ slug }, opt.id),
  );
  if (fromOptions) return fromOptions.id;

  const chain = chains.find((c) => c.slug === slug);
  if (!chain) return null;
  if (!isListedBrandChain(chain)) return OTHER_CHAIN_FILTER_ID;

  return (
    chainFilterOptions.find(
      (opt) =>
        opt.id !== OTHER_CHAIN_FILTER_ID &&
        chainMatchesFilterKey(chain, opt.id),
    )?.id ?? null
  );
}

export function filterChainVisual(id: string, list: Chain[]) {
  if (id === OTHER_CHAIN_FILTER_ID) {
    return { image: "/pins/gym-pin.png", logo: true, logoClass: "is-other" };
  }
  const chain = list.find((c) => chainMatchesFilterKey(c, id));
  const image =
    chain?.image && !chain.image.includes("/pins/")
      ? chain.image
      : "/pins/gym-pin.png";
  return {
    image,
    logo: chain?.logoFit === "contain" || image.includes("/pins/"),
    logoClass: chain?.logoClass || "",
  };
}
