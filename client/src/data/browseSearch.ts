export const PRICE_MIN = 0;
export const PRICE_MAX = 100;
export const PRICE_STEP = 5;

export function snapPrice(n: number) {
  const snapped = Math.round(n / PRICE_STEP) * PRICE_STEP;
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, snapped));
}

const SORT_IDS = [
  "nearest",
  "price-asc",
  "price-desc",
  "name-asc",
  "name-desc",
];

const KM_IDS = ["1", "3", "5", "10", "20", "50", "all"];

export type BrowseQuery = {
  chains: string[];
  women: boolean;
  km: string;
  priceMin: number;
  priceMax: number;
  only247: boolean;
  freeTrial: boolean;
  dayPass: boolean;
  sort: string;
  q: string;
  page: number;
};

export function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function clampPrice(n: number) {
  return snapPrice(n);
}

function idsFromParam(raw: string | null, allowed: Set<string>) {
  if (raw == null || raw === "") return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => allowed.has(id));
}

export function parseBrowseSearch(
  search: string,
  allChainIds: string[],
): BrowseQuery {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const sp = new URLSearchParams(raw);
  const allowed = new Set(allChainIds);

  let chains = [...allChainIds];
  if (sp.has("chain")) {
    chains = idsFromParam(sp.get("chain"), allowed);
  }

  const kmRaw = sp.get("km") ?? "all";
  const km = KM_IDS.includes(kmRaw) ? kmRaw : "all";

  let priceMin = PRICE_MIN;
  let priceMax = PRICE_MAX;
  const fromRaw = sp.get("price_from");
  const toRaw = sp.get("price_to");
  if (fromRaw != null && fromRaw !== "") {
    const from = Number(fromRaw);
    if (Number.isFinite(from)) priceMin = clampPrice(from);
  }
  if (toRaw != null && toRaw !== "") {
    const to = Number(toRaw);
    if (Number.isFinite(to)) priceMax = clampPrice(to);
  }
  if (priceMin > priceMax) {
    const swap = priceMin;
    priceMin = priceMax;
    priceMax = swap;
  }

  const sortRaw = sp.get("sort") ?? "nearest";
  const sort = SORT_IDS.includes(sortRaw) ? sortRaw : "nearest";
  const pageN = Number(sp.get("page") ?? "1");
  const page = Number.isFinite(pageN) && pageN >= 1 ? Math.floor(pageN) : 1;

  return {
    chains,
    women: sp.get("for") === "women",
    km,
    priceMin,
    priceMax,
    only247: sp.get("247") === "1",
    freeTrial: sp.get("trial") === "1",
    dayPass: sp.get("daypass") === "1",
    sort,
    q: sp.get("q") ?? "",
    page,
  };
}

export function buildBrowseSearch(
  query: BrowseQuery,
  allChainIds: string[],
  skipChain = false,
) {
  const sp = new URLSearchParams();
  const q = query.q.trim();
  if (q) sp.set("q", q);
  if (!skipChain) {
    const allOn = sameIds(query.chains, allChainIds);
    if (!allOn) {
      sp.set(
        "chain",
        allChainIds.filter((id) => query.chains.includes(id)).join(","),
      );
    }
  }
  if (query.women) sp.set("for", "women");
  if (query.km !== "all") sp.set("km", query.km);
  const priceFrom = snapPrice(query.priceMin);
  const priceTo = snapPrice(query.priceMax);
  if (priceFrom > PRICE_MIN) {
    sp.set("price_from", String(priceFrom));
  }
  if (priceTo < PRICE_MAX) {
    sp.set("price_to", String(priceTo));
  }
  if (query.only247) sp.set("247", "1");
  if (query.freeTrial) sp.set("trial", "1");
  if (query.dayPass) sp.set("daypass", "1");
  if (query.sort !== "nearest") sp.set("sort", query.sort);
  if (query.page > 1) sp.set("page", String(query.page));
  return sp.toString();
}
