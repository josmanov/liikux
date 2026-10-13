import type { Chain, Gym } from "../../../data/types";
import { resolveGymOffer } from "../../../data/types";
import {
  chainForGym,
  gymHasDayPass,
  gymHasFreeTrial,
  gymIs247,
  gymMatchesAudience,
} from "../../../data/audience";
import { PRICE_MAX } from "../../../data/browseSearch";
import { toCitySlug } from "../../../data/citySlug";
import { distanceKm } from "./distanceKm";
import { isListedBrandChain } from "./chainFilters";
import { MAAKUNTA_MAP_ACTIVE } from "./mapConstants";

export type SelectedChainFilter =
  | { mode: "all" }
  | { mode: "none" }
  | { mode: "some"; ids: Set<string>; includeOther: boolean };

export type FilterAndSortBrowseGymsArgs = {
  gyms: Gym[];
  chains: Chain[];
  query: string;
  sortId: string;
  selectedChainFilter: SelectedChainFilter;
  womenOnly: boolean;
  priceMin: number;
  priceMax: number;
  priceFilterOn: boolean;
  extraOnly247: boolean;
  extraFreeTrial: boolean;
  extraDayPass: boolean;
  maxDistanceKm: number | null;
  origin: { lat: number; lng: number };
  selectedMaakunta: string | null;
  gymMaakuntaMap: Record<string, string>;
  activeCitySlug: string | null;
};

export function filterAndSortBrowseGyms(args: FilterAndSortBrowseGymsArgs) {
  const {
    gyms,
    chains,
    query,
    sortId,
    selectedChainFilter,
    womenOnly,
    priceMin,
    priceMax,
    priceFilterOn,
    extraOnly247,
    extraFreeTrial,
    extraDayPass,
    maxDistanceKm,
    origin,
    selectedMaakunta,
    gymMaakuntaMap,
    activeCitySlug,
  } = args;
  const q = query.trim().toLowerCase();

  let list = gyms.filter((gym) => {
    if (selectedChainFilter.mode === "none") return false;
    if (selectedChainFilter.mode === "some") {
      const matchesBrand = selectedChainFilter.ids.has(gym.chainId);
      const chain = chains.find((c) => c.id === gym.chainId);
      const isOther = !chain || !isListedBrandChain(chain);
      if (
        !matchesBrand &&
        !(selectedChainFilter.includeOther && isOther)
      ) {
        return false;
      }
    }
    if (womenOnly) {
      const chain = chainForGym(gym, chains);
      if (!gymMatchesAudience(gym, chain, ["women"])) return false;
    }
    if (priceFilterOn) {
      const chain = chainForGym(gym, chains);
      const priceFrom =
        gym.priceFrom != null ? gym.priceFrom : (chain?.priceFrom ?? null);
      if (priceFrom == null) return false;
      if (priceFrom < priceMin) return false;
      if (priceMax < PRICE_MAX && priceFrom > priceMax) return false;
    }
    if (extraOnly247) {
      const chain = chainForGym(gym, chains);
      if (!gymIs247(gym, chain)) return false;
    }
    if (extraFreeTrial) {
      const chain = chainForGym(gym, chains);
      if (!gymHasFreeTrial(gym, chain)) return false;
    }
    if (extraDayPass) {
      const chain = chainForGym(gym, chains);
      if (!gymHasDayPass(gym, chain)) return false;
    }
    if (maxDistanceKm != null) {
      if (gym.lat == null || gym.lng == null) return false;
      const km = distanceKm(origin.lat, origin.lng, gym.lat, gym.lng);
      if (km > maxDistanceKm) return false;
    }
    if (MAAKUNTA_MAP_ACTIVE && selectedMaakunta) {
      if (gymMaakuntaMap[gym.id] !== selectedMaakunta) return false;
    }
    if (activeCitySlug) {
      if (toCitySlug(gym.city) !== activeCitySlug) return false;
    }
    if (!q) return true;
    return (
      gym.name.toLowerCase().includes(q) ||
      gym.city.toLowerCase().includes(q) ||
      gym.address.toLowerCase().includes(q)
    );
  });

  if (sortId === "name-asc") {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name, "fi"));
  } else if (sortId === "name-desc") {
    list = [...list].sort((a, b) => b.name.localeCompare(a.name, "fi"));
  } else if (sortId === "price-asc" || sortId === "price-desc") {
    const dir = sortId === "price-asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const chainA = chainForGym(a, chains);
      const chainB = chainForGym(b, chains);
      const pa = resolveGymOffer(a, chainA as Chain | null).priceFrom;
      const pb = resolveGymOffer(b, chainB as Chain | null).priceFrom;
      if (pa == null && pb == null) return a.name.localeCompare(b.name, "fi");
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pa !== pb) return (pa - pb) * dir;
      return a.name.localeCompare(b.name, "fi");
    });
  } else if (sortId === "nearest") {
    list = [...list].sort((a, b) => {
      const da =
        a.lat == null || a.lng == null
          ? Number.POSITIVE_INFINITY
          : distanceKm(origin.lat, origin.lng, a.lat, a.lng);
      const db =
        b.lat == null || b.lng == null
          ? Number.POSITIVE_INFINITY
          : distanceKm(origin.lat, origin.lng, b.lat, b.lng);
      return da - db;
    });
  }

  return list;
}
