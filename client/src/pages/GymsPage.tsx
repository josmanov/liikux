import "./GymsPage.css";
import "../components/ChainPopup.css";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { List, Map as MapIcon } from "lucide-react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { useAddressSuggest } from "../data/geocode";
import { useLockPageScroll } from "../hooks/useLockPageScroll";
import { chainForGym } from "../data/audience";
import {
  cleanGymDisplayName,
  formatGymStreetLine,
  formatPricePill,
} from "../data/format";
import { useAppLocation } from "../context/LocationContext";
import {
  PRICE_MAX,
  PRICE_MIN,
  buildBrowseSearch,
  parseBrowseSearch,
  sameIds,
} from "../data/browseSearch";
import { toggleFavoriteSlug, readFavoriteSlugs } from "../data/favorites";
import { pathGyms, pathGymsBrowse } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import {
  CITY_CENTERS,
  cityCenterForName,
  cityCenterForSlug,
  cityFromLabel,
  displayCityName,
  nearestCityCenter,
  toCitySlug,
  type CityCenter,
} from "../data/citySlug";
import {
  regionForCitySlug,
  regionFromName,
  regionFromSlug,
} from "../data/regionSlug";
import LoadSpin from "../components/LoadSpin";

import {
  filterIdFromChainSlug,
  chainFilterOptionIds,
  chainFilterBrandLabels,
  allChainFilterIds,
  OTHER_CHAIN_FILTER_ID,
  isListedBrandChain,
  chainMatchesFilterKey,
} from "../features/browse/utils/chainFilters";
import { distanceKm } from "../features/browse/utils/distanceKm";
import { filterAndSortBrowseGyms } from "../features/browse/utils/filterAndSortBrowseGyms";
import {
  applyFinlandMinZoom,
  applyPinsMinZoom,
  expandBoundsByKm,
  frameOriginAndGym,
  framePadForOverlays,
  boundsFromPins,
} from "../features/browse/utils/mapBounds";
import {
  ADDRESS_ZOOM,
  BROWSE_MOBILE_MQ,
  MAAKUNTA_MAP_ACTIVE,
  ORIGIN_ZOOM,
  PAGE_SIZE_MOBILE,
  PAGE_SIZE_START,
  distancePresetMeta,
  type FilterKey,
} from "../features/browse/utils/mapConstants";
import {
  geomBBox,
  pointInPolygon,
  type MaakuntaGeom,
} from "../features/browse/utils/maakuntaGeom";
import { BrowseChainsMenu } from "../features/browse/components/BrowseChainsMenu";
import { BrowseExtrasMenu } from "../features/browse/components/BrowseExtrasMenu";
import { BrowseListHead } from "../features/browse/components/BrowseListHead";
import { BrowseMapChrome } from "../features/browse/components/BrowseMapChrome";
import { BrowseMapSheet } from "../features/browse/components/BrowseMapSheet";
import { BrowseResultsList } from "../features/browse/components/BrowseResultsList";
import { BrowseSearchChrome } from "../features/browse/components/BrowseSearchChrome";
import { BrowseSuggestChips } from "../features/browse/components/BrowseSuggestChips";
import { BrowseFilters } from "../features/browse/components/BrowseFilters";
import { BrowseSelectedCard } from "../features/browse/components/BrowseSelectedCard";
import { useBrowseData, type MaakuntaFeature } from "../features/browse/hooks/useBrowseData";
import { useBrowseMapInit } from "../features/browse/hooks/useBrowseMapInit";
import { useBrowseMapMarkers } from "../features/browse/hooks/useBrowseMapMarkers";
function GymsPage() {
  const {
    slug: chainSlug,
    regionSlug: regionSlugParam,
    citySlug: citySlugParam,
  } = useParams();
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const browseStart = parseBrowseSearch(
    routeLocation.search,
    allChainFilterIds,
  );
  const { lang, t } = useLang();
  const routeSegA = (regionSlugParam || "").trim().toLowerCase();
  const routeSegB = (citySlugParam || "").trim().toLowerCase();
  const routeBrowse = useMemo(() => {
    if (!routeSegA) {
      return {
        regionSlug: "",
        citySlug: "",
        regionName: "",
        cityName: "",
        legacyCityOnly: false,
      };
    }
    if (routeSegB) {
      const region = regionFromSlug(routeSegA);
      return {
        regionSlug: region?.slug || routeSegA,
        citySlug: routeSegB,
        regionName: region?.name || routeSegA,
        cityName: displayCityName(routeSegB),
        legacyCityOnly: false,
      };
    }
    const asRegion = regionFromSlug(routeSegA);
    if (asRegion) {
      return {
        regionSlug: asRegion.slug,
        citySlug: "",
        regionName: asRegion.name,
        cityName: "",
        legacyCityOnly: false,
      };
    }
    const asCity = cityCenterForSlug(routeSegA);
    if (asCity) {
      const region = regionForCitySlug(asCity.slug);
      return {
        regionSlug: region?.slug || "",
        citySlug: asCity.slug,
        regionName: region?.name || "",
        cityName: asCity.name,
        legacyCityOnly: true,
      };
    }
    return {
      regionSlug: routeSegA,
      citySlug: "",
      regionName: routeSegA,
      cityName: "",
      legacyCityOnly: false,
    };
  }, [routeSegA, routeSegB]);
  const routeRegionSlug = routeBrowse.regionSlug;
  const routeCitySlug = routeBrowse.citySlug;
  const routeRegionName = routeBrowse.regionName;
  const routeCityName = routeBrowse.cityName;
  const metaTitle = routeCityName
    ? lang === "fi"
      ? `Kuntosalit ${routeCityName} – etsi sali lähelläsi | Liikux`
      : `Gyms in ${routeCityName} – find a gym near you | Liikux`
    : routeRegionName
      ? lang === "fi"
        ? `Kuntosalit ${routeRegionName} – selaa kartalla ja listalla | Liikux`
        : `Gyms in ${routeRegionName} – browse map and list | Liikux`
      : lang === "fi"
        ? "Yli 1000 kuntosalia Suomessa – selaa kartalla ja listalla | Liikux"
        : "Over 1000 gyms in Finland – browse map and list | Liikux";
  const metaDescription = routeCityName
    ? lang === "fi"
      ? `Löydä kuntosali kaupungissa ${routeCityName}${routeRegionName ? ` (${routeRegionName})` : ""}. Selaa saleja kartalla ja listalla, vertaa hintoja ja ketjuja – Liikux.`
      : `Find a gym in ${routeCityName}${routeRegionName ? ` (${routeRegionName})` : ""}. Browse map and list, compare prices and chains – Liikux.`
    : routeRegionName
      ? lang === "fi"
        ? `Selaa kuntosaleja alueella ${routeRegionName}. Kartta, lista, hinnat ja ketjut – Liikux.`
        : `Browse gyms in ${routeRegionName}. Map, list, prices and chains – Liikux.`
      : lang === "fi"
        ? "Yli 1000 kuntosalia Suomessa. Selaa saleja kartalla ja listalla, suodata alueen, ketjun, hinnan ja etäisyyden mukaan – Liikux."
        : "Over 1000 gyms in Finland. Browse map and list, filter by region, chain, price and distance – Liikux.";
  usePageMeta({
    title: metaTitle,
    description: metaDescription,
    path: pathGymsBrowse(lang, routeRegionSlug || null, routeCitySlug || null),
  });
  const sortOptions = [
    { id: "nearest", label: t("sortNearest"), icon: "map" as const },
    { id: "price-asc", label: t("sortCheap"), icon: "down" as const },
    { id: "price-desc", label: t("sortExpensive"), icon: "up" as const },
  ];
  const distancePresets = distancePresetMeta.map((opt) => ({
    ...opt,
    label:
      opt.id === "all"
        ? t("distanceAll")
        : `${opt.km} km`,
  }));
  const {
    label: locationLabel,
    lat: locationLat,
    lng: locationLng,
    setLocation,
    useMyLocation,
  } = useAppLocation();
  const [maakunnatReady, setMaakunnatReady] = useState(false);
  const maakuntaFeaturesRef = useRef<MaakuntaFeature[]>([]);
  const { gyms, chains, dataReady, gymMaakuntaMap } = useBrowseData({
    maakunnatReady,
    maakuntaFeaturesRef,
  });
  const localizedChainFilterOptions = useMemo(() => {
    return chainFilterOptionIds
      .filter((id) => {
        if (chains.length === 0) return true;
        if (id === OTHER_CHAIN_FILTER_ID) {
          return chains.some(
            (c) => !isListedBrandChain(c) && (c.gymCount ?? 0) > 0,
          );
        }
        const match = chains.find((c) => chainMatchesFilterKey(c, id));
        return !!match && (match.gymCount ?? 0) > 0;
      })
      .map((id) => ({
        id,
        label:
          id === OTHER_CHAIN_FILTER_ID
            ? t("otherChains")
            : chainFilterBrandLabels[id],
      }));
  }, [chains, t]);
  const visibleChainFilterIds = useMemo(
    () => localizedChainFilterOptions.map((o) => o.id),
    [localizedChainFilterOptions],
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() =>
    readFavoriteSlugs(),
  );
  const [query, setQuery] = useState(browseStart.q);
  const [sortId, setSortId] = useState(browseStart.sort);
  const [page, setPage] = useState(browseStart.page);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selectedChains, setSelectedChains] = useState<string[]>(
    browseStart.chains,
  );
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(
    browseStart.women ? ["women"] : [],
  );
  const [distanceFilter, setDistanceFilter] = useState(browseStart.km);
  const [priceMin, setPriceMin] = useState(browseStart.priceMin);
  const [priceMax, setPriceMax] = useState(browseStart.priceMax);
  const [extraOnly247, setExtraOnly247] = useState(browseStart.only247);
  const [extraFreeTrial, setExtraFreeTrial] = useState(browseStart.freeTrial);
  const [extraDayPass, setExtraDayPass] = useState(browseStart.dayPass);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [chainsOpen, setChainsOpen] = useState(false);
  const [chainQuery, setChainQuery] = useState("");
  const [addressDraft, setAddressDraft] = useState(locationLabel);
  const [addressSuggest, setAddressSuggest] = useState(false);
  const { hits: addressHits, loading: addressLoading } = useAddressSuggest(
    addressDraft,
    addressSuggest && addressDraft.trim() !== locationLabel,
    { lat: locationLat, lng: locationLng },
  );
  const [mapReady, setMapReady] = useState(false);
  const [selectedMaakunta, setSelectedMaakunta] = useState<string | null>(
    () => routeRegionName || null,
  );
  const [browseAllAreas, setBrowseAllAreas] = useState(false);
  const [regionNames, setRegionNames] = useState<string[]>([]);
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [browseCitySlug, setBrowseCitySlug] = useState<string | null>(
    () => routeCitySlug || null,
  );
  const [mapSheet, setMapSheet] = useState<null | "address" | "region">(null);
  const cityBounceLockRef = useRef(false);
  const cityFitDoneRef = useRef<string | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);
  const explodeClusterIdsRef = useRef<Set<string> | null>(null);
  const preCompareCameraRef = useRef<{
    lng: number;
    lat: number;
    zoom: number;
    minZoom: number;
  } | null>(null);
  const browseCitySlugRef = useRef(browseCitySlug);
  browseCitySlugRef.current = browseCitySlug;
  const gymsRef = useRef(gyms);
  gymsRef.current = gyms;
  const [mapBounds, setMapBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const listChromeRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_START);
  const [mobileList, setMobileList] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(BROWSE_MOBILE_MQ).matches,
  );
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [listAtEnd, setListAtEnd] = useState(false);
  const pageSizeRef = useRef(PAGE_SIZE_START);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const originMarkerRef = useRef<Marker | null>(null);
  const selectFromMapRef = useRef(false);
  const freezeListBoundsRef = useRef(false);
  const [mapSelectPending, setMapSelectPending] = useState(false);
  const [listRevealKey, setListRevealKey] = useState(0);
  const skipBoundsResetRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const favoriteSlugsRef = useRef(favoriteSlugs);
  const visibleGymsRef = useRef<Gym[]>([]);
  const inViewGymsRef = useRef<Gym[]>([]);
  const chainsByIdRef = useRef(new globalThis.Map<string, Chain>());
  const regionPickModeRef = useRef(true);
  const selectedMaakuntaRef = useRef<string | null>(null);
  const fitKeyRef = useRef("");
  const lastOriginKeyRef = useRef("");
  const mobileMapFitKeyRef = useRef("");
  const regionUserPickedRef = useRef(!!routeRegionName);
  const routeRegionNameRef = useRef(routeRegionName);
  routeRegionNameRef.current = routeRegionName;
  const mapPinchRef = useRef(false);
  const mapTouchCountRef = useRef(0);
  const afterPinchSyncRef = useRef<(() => void) | null>(null);
  const regionDropRef = useRef<HTMLDivElement>(null);
  const suggestChipsRef = useRef<HTMLDivElement>(null);
  const prevFilterKeyRef = useRef<string | null>(null);
  const originRef = useRef({ lat: 60.1699, lng: 24.9384 });
  const focusOriginRef = useRef(
    (routeLocation.state as { focusOrigin?: boolean } | null)?.focusOrigin ===
      true,
  );
  const pendingMyLocationRef = useRef<{
    lat: number;
    lng: number;
    citySlug: string | null;
  } | null>(null);
  const [myLocationTick, setMyLocationTick] = useState(0);

  const regionPickMode =
    MAAKUNTA_MAP_ACTIVE && selectedMaakunta == null && !browseAllAreas;

  useEffect(() => {
    setAddressDraft(locationLabel);
  }, [locationLabel]);

  useEffect(() => {
    function syncFavs() {
      setFavoriteSlugs(readFavoriteSlugs());
    }
    window.addEventListener("favorites-changed", syncFavs);
    return () => window.removeEventListener("favorites-changed", syncFavs);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("browse-no-scrollbar");
    return () => {
      document.documentElement.classList.remove("browse-no-scrollbar");
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(BROWSE_MOBILE_MQ);

    function fitRows() {
      const box = listScrollRef.current;
      if (!box) return;
      const list = box.querySelector<HTMLElement>(".browse-rows");
      if (!list) return;
      if (mq.matches) {
        list.style.removeProperty("--browse-row-count");
        box.style.removeProperty("--browse-row-count");
        setMobileList(true);
        setPageSize((cur) =>
          cur === PAGE_SIZE_MOBILE ? cur : PAGE_SIZE_MOBILE,
        );
        return;
      }
      setMobileList(false);
      setMobileMapOpen(false);
      const raw = getComputedStyle(list).getPropertyValue("--row-min").trim();
      const rowMin = Number.parseFloat(raw) || 70;
      const pagebar = box.querySelector<HTMLElement>(".browse-pagebar");
      const pagebarH = pagebar?.getBoundingClientRect().height ?? 40;
      const avail = Math.max(0, box.clientHeight - pagebarH);
      const gymRows = Math.max(3, Math.floor((avail + 2) / rowMin));
      list.style.setProperty("--browse-row-count", String(gymRows));
      box.style.setProperty("--browse-row-count", String(gymRows));
      const next = Math.max(2, gymRows * 2);
      setPageSize((cur) => (cur === next ? cur : next));
    }

    fitRows();
    const watch = new ResizeObserver(fitRows);
    const box = listScrollRef.current;
    if (box) watch.observe(box);
    mq.addEventListener("change", fitRows);
    return () => {
      watch.disconnect();
      mq.removeEventListener("change", fitRows);
    };
  }, []);

  useEffect(() => {
    const chrome = listChromeRef.current;
    if (!chrome) return;

    function onScroll() {
      if (window.matchMedia("(min-width: 901px)").matches) {
        chrome?.classList.remove("is-scrolled");
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
        return;
      }
      chrome?.classList.toggle("is-scrolled", window.scrollY > 6);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const parsed = parseBrowseSearch(routeLocation.search, allChainFilterIds);
    if (chainSlug) {
      const filterId = filterIdFromChainSlug(chainSlug, chains);
      if (filterId) {
        setSelectedChains((cur) =>
          cur.length === 1 && cur[0] === filterId ? cur : [filterId],
        );
      }
    } else {
      setSelectedChains((cur) =>
        sameIds(cur, parsed.chains) ? cur : parsed.chains,
      );
    }
    setQuery((cur) => (cur === parsed.q ? cur : parsed.q));
    setSortId((cur) => (cur === parsed.sort ? cur : parsed.sort));
    setPage((cur) => (cur === parsed.page ? cur : parsed.page));
    setSelectedAudiences((cur) => {
      const next = parsed.women ? ["women"] : [];
      return sameIds(cur, next) ? cur : next;
    });
    setDistanceFilter((cur) => (cur === parsed.km ? cur : parsed.km));
    setPriceMin((cur) => (cur === parsed.priceMin ? cur : parsed.priceMin));
    setPriceMax((cur) => (cur === parsed.priceMax ? cur : parsed.priceMax));
    setExtraOnly247((cur) => (cur === parsed.only247 ? cur : parsed.only247));
    setExtraFreeTrial((cur) =>
      cur === parsed.freeTrial ? cur : parsed.freeTrial,
    );
    setExtraDayPass((cur) => (cur === parsed.dayPass ? cur : parsed.dayPass));
  }, [routeLocation.search, chainSlug, chains]);

  useEffect(() => {
    const search = buildBrowseSearch(
      {
        chains: selectedChains,
        women: selectedAudiences.includes("women"),
        km: distanceFilter,
        priceMin,
        priceMax,
        only247: extraOnly247,
        freeTrial: extraFreeTrial,
        dayPass: extraDayPass,
        sort: sortId,
        q: query,
        page,
      },
      allChainFilterIds,
      Boolean(chainSlug),
    );
    const current = routeLocation.search.startsWith("?")
      ? routeLocation.search.slice(1)
      : routeLocation.search;
    if (search === current) return;
    navigate(
      {
        pathname: routeLocation.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true, state: routeLocation.state },
    );
  }, [
    selectedChains,
    selectedAudiences,
    distanceFilter,
    priceMin,
    priceMax,
    extraOnly247,
    extraFreeTrial,
    extraDayPass,
    sortId,
    query,
    page,
    chainSlug,
    navigate,
    routeLocation.pathname,
    routeLocation.state,
  ]);

  const sortLabel =
    sortOptions.find((o) => o.id === sortId)?.label ?? t("sortNearest");
  useEffect(() => {
    if (sortOptions.some((o) => o.id === sortId)) return;
    setSortId("nearest");
  }, [sortId, sortOptions]);
  useEffect(() => {
    if (visibleChainFilterIds.length === 0) return;
    setSelectedChains((cur) => {
      const allowed = new Set<string>(visibleChainFilterIds);
      const next = cur.filter((id) => allowed.has(id));
      if (next.length === cur.length) return cur;
      if (next.length === 0) return [...visibleChainFilterIds];
      return next;
    });
  }, [visibleChainFilterIds]);

  const chainFilterActive =
    selectedChains.length < visibleChainFilterIds.length;
  const womenOnly = selectedAudiences.includes("women");
  const distancePresetIndex = Math.max(
    0,
    distancePresets.findIndex((o) => o.id === distanceFilter),
  );
  const maxDistanceKm =
    distancePresets[distancePresetIndex]?.km ?? null;
  const priceFilterOn = priceMin > PRICE_MIN || priceMax < PRICE_MAX;
  const priceInfo = priceFilterOn ? `· ${priceMin}–${priceMax} €` : "";

  const origin = useMemo(() => {
    if (locationLat != null && locationLng != null) {
      return { lat: locationLat, lng: locationLng };
    }
    const fromLabel = cityCenterForName(locationLabel);
    if (fromLabel) return { lat: fromLabel.lat, lng: fromLabel.lng };
    const cityBit = cityFromLabel(locationLabel);
    const fromBit = cityBit ? cityCenterForName(cityBit) : null;
    if (fromBit) return { lat: fromBit.lat, lng: fromBit.lng };
    return { lat: 60.1699, lng: 24.9384 };
  }, [locationLabel, locationLat, locationLng]);
  originRef.current = origin;

  const applyingBrowseUrlRef = useRef(false);

  useEffect(() => {
    if (chainSlug || !routeBrowse.legacyCityOnly) return;
    if (!routeRegionSlug || !routeCitySlug) return;
    if (selectedMaakunta && selectedMaakunta !== routeRegionName) return;
    const currentPath = routeLocation.pathname.replace(/\/$/, "") || "/";
    const shortPath = `${pathGyms(lang)}/${routeSegA}`;
    if (currentPath !== shortPath) return;
    navigate(
      {
        pathname: pathGymsBrowse(lang, routeRegionSlug, routeCitySlug),
        search: routeLocation.search,
      },
      { replace: true },
    );
  }, [
    chainSlug,
    lang,
    navigate,
    routeBrowse.legacyCityOnly,
    routeCitySlug,
    routeLocation.pathname,
    routeLocation.search,
    routeRegionName,
    routeRegionSlug,
    routeSegA,
    selectedMaakunta,
  ]);

  useEffect(() => {
    if (chainSlug || !routeCitySlug) return;
    const locCity = cityFromLabel(locationLabel);
    if (locCity && cityCenterForName(locCity)) return;
    if (locationLabel.trim() && locationLat != null && locationLng != null) {
      return;
    }
    const known = cityCenterForSlug(routeCitySlug);
    const name = known?.name || displayCityName(routeCitySlug);
    setLocation({
      label: name,
      lat: known?.lat ?? null,
      lng: known?.lng ?? null,
    });
  }, [chainSlug, routeCitySlug]);

  useEffect(() => {
    if (chainSlug || !routeRegionName) return;
    if (selectedMaakunta === routeRegionName) return;
    applyingBrowseUrlRef.current = true;
    setBrowseAllAreas(false);
    setSelectedMaakunta(routeRegionName);
    selectedMaakuntaRef.current = routeRegionName;
    regionPickModeRef.current = false;
    regionUserPickedRef.current = true;
  }, [chainSlug, routeRegionName]);

  useEffect(() => {
    if (chainSlug) return;
    const currentPath = routeLocation.pathname.replace(/\/$/, "") || "/";
    const onGymsBrowse = /^\/(fi|en)\/(kuntosalit|gyms)/.test(currentPath);
    if (!onGymsBrowse) return;

    const region =
      selectedMaakunta != null ? regionFromName(selectedMaakunta) : null;
    const locCity = cityFromLabel(locationLabel);
    const locCenter = locCity ? cityCenterForName(locCity) : null;
    const locCityInRegion =
      !!region &&
      !!locCenter &&
      regionForCitySlug(locCenter.slug)?.slug === region.slug;
    const locationCityDiffers =
      locCityInRegion && locCenter!.slug !== routeCitySlug;

    if (applyingBrowseUrlRef.current && !locationCityDiffers) {
      applyingBrowseUrlRef.current = false;
      return;
    }
    applyingBrowseUrlRef.current = false;

    if (selectedMaakunta == null) {
      if (!browseAllAreas && routeRegionName) return;
      const base = pathGyms(lang);
      if (currentPath !== base && (routeRegionSlug || routeCitySlug)) {
        navigate(
          { pathname: base, search: routeLocation.search },
          { replace: true },
        );
      }
      return;
    }

    if (!region) return;
    let citySlug = "";
    if (locCityInRegion && locCenter) citySlug = locCenter.slug;
    else if (routeCitySlug) {
      const cityRegion = regionForCitySlug(routeCitySlug);
      if (cityRegion && cityRegion.slug === region.slug) {
        citySlug = routeCitySlug;
      }
    }
    const next = pathGymsBrowse(lang, region.slug, citySlug || null);
    if (currentPath === next) return;
    navigate(
      { pathname: next, search: routeLocation.search },
      { replace: true },
    );
  }, [
    browseAllAreas,
    chainSlug,
    lang,
    locationLabel,
    locationLat,
    locationLng,
    navigate,
    routeCitySlug,
    routeLocation.pathname,
    routeLocation.search,
    routeRegionName,
    routeRegionSlug,
    selectedMaakunta,
  ]);

  useEffect(() => {
    if (!MAAKUNTA_MAP_ACTIVE) return;
    if (chainSlug || !routeRegionName || !mapReady || !maakunnatReady) return;
    if (selectedMaakunta !== routeRegionName) return;
    if (browseCitySlugRef.current) return;
    const map = mapInstanceRef.current;
    const full = maakuntaFeaturesRef.current.find(
      (x) => x.nimi === routeRegionName,
    );
    if (!map || !full) return;
    const bbox = geomBBox(full.geometry);
    const mobile = window.matchMedia(BROWSE_MOBILE_MQ).matches;
    const pad = mobile
      ? { top: 24, bottom: 28, left: 24, right: 24 }
      : { top: 72, bottom: 72, left: 72, right: 72 };
    map.fitBounds(bbox, {
      padding: pad,
      duration: 650,
      maxZoom: mobile ? 10.5 : 9.5,
    });
  }, [
    chainSlug,
    mapReady,
    maakunnatReady,
    routeRegionName,
    selectedMaakunta,
  ]);

  const extrasActive = extraOnly247 || extraFreeTrial || extraDayPass;
  const filtersMoreActive =
    extrasActive ||
    womenOnly ||
    priceFilterOn ||
    distanceFilter !== "all" ||
    (mobileList && chainFilterActive);
  const filtersMoreBadge =
    (extraOnly247 ? 1 : 0) +
    (extraFreeTrial ? 1 : 0) +
    (extraDayPass ? 1 : 0) +
    (womenOnly ? 1 : 0) +
    (mobileList && chainFilterActive ? 1 : 0) +
    (priceFilterOn ? 1 : 0) +
    (distanceFilter !== "all" ? 1 : 0);
  const extrasLabel = t("filtersAll");

  const selectedChainFilter = useMemo(() => {
    if (selectedChains.length === 0) {
      return { mode: "none" as const };
    }
    if (!chainFilterActive) {
      return { mode: "all" as const };
    }

    const ids = new Set<string>();
    let includeOther = false;
    for (const key of selectedChains) {
      if (key === OTHER_CHAIN_FILTER_ID) {
        includeOther = true;
        continue;
      }
      const match = chains.find((c) => chainMatchesFilterKey(c, key));
      if (match) ids.add(match.id);
    }
    return { mode: "some" as const, ids, includeOther };
  }, [chains, selectedChains, chainFilterActive]);

  const activeCitySlug = browseCitySlug;

  const cityOptions = useMemo(() => {
    const bySlug = new globalThis.Map<string, CityCenter>();
    for (const c of CITY_CENTERS) bySlug.set(c.slug, c);
    for (const g of gyms) {
      const name = g.city?.trim();
      if (!name) continue;
      const known = cityCenterForName(name);
      if (known) {
        bySlug.set(known.slug, known);
        continue;
      }
      const slug = toCitySlug(name);
      if (bySlug.has(slug)) continue;
      if (g.lat == null || g.lng == null) continue;
      bySlug.set(slug, { name, slug, lat: g.lat, lng: g.lng });
    }
    return [...bySlug.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fi"),
    );
  }, [gyms]);

  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cityOptions;
    return cityOptions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.includes(toCitySlug(q)),
    );
  }, [cityOptions, cityQuery]);

  useEffect(() => {
    if (routeCitySlug) setBrowseCitySlug(routeCitySlug.trim().toLowerCase());
  }, [routeCitySlug]);

  useEffect(() => {
    const fromLabel = cityFromLabel(locationLabel);
    if (!fromLabel) return;
    const known = cityCenterForName(fromLabel);
    if (known) setBrowseCitySlug(known.slug);
  }, [locationLabel, locationLat, locationLng]);

  const visibleGyms = useMemo(() => {
    return filterAndSortBrowseGyms({
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
    });
  }, [
    gyms,
    chains,
    query,
    sortId,
    selectedChainFilter,
    selectedAudiences,
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
  ]);

  visibleGymsRef.current = visibleGyms;
  selectedMaakuntaRef.current = selectedMaakunta;
  regionPickModeRef.current = regionPickMode;
  favoriteSlugsRef.current = favoriteSlugs;
  chainsByIdRef.current = new globalThis.Map(chains.map((c) => [c.id, c]));

  useEffect(() => {
    if (!regionMenuOpen) return;
    function close(e: MouseEvent) {
      if (regionDropRef.current?.contains(e.target as Node)) return;
      setRegionMenuOpen(false);
    }
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", close);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", close);
    };
  }, [regionMenuOpen]);

  const inViewGyms = useMemo(() => {
    if (regionPickMode) return [];
    return visibleGyms;
  }, [visibleGyms, regionPickMode]);

  inViewGymsRef.current = inViewGyms;

  pageSizeRef.current = pageSize;

  const pageCount = Math.max(1, Math.ceil(inViewGyms.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const pageGyms = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return inViewGyms.slice(start, start + pageSize);
  }, [inViewGyms, safePage, pageSize]);
  const pageGymsRef = useRef(pageGyms);
  pageGymsRef.current = pageGyms;

  const selectedMapGym = useMemo(() => {
    if (!selectedId) return null;
    const gym =
      gyms.find((g) => g.id === selectedId) ||
      inViewGyms.find((g) => g.id === selectedId);
    if (!gym) return null;
    const chain = chainForGym(gym, chains);
    const offer = resolveGymOffer(gym, chain as Chain | null);
    const isBrandChain = Boolean(chain && isListedBrandChain(chain));
    const siteName = isBrandChain
      ? cleanGymDisplayName(gym.name, {
          chainName: chain?.name,
          city: gym.city,
        })
      : cleanGymDisplayName(gym.name);
    const street = formatGymStreetLine(gym);
    const pricePill = formatPricePill(offer.priceFrom, lang);
    const priceLabel = pricePill
      ? pricePill.replace("€/kk", " €/kk").replace("€/mo", " €/mo")
      : null;
    const distKm =
      gym.lat != null && gym.lng != null
        ? distanceKm(origin.lat, origin.lng, gym.lat, gym.lng)
        : null;
    return { gym, chain, siteName, street, priceLabel, distKm };
  }, [selectedId, gyms, inViewGyms, chains, lang, origin.lat, origin.lng]);
  const listLoading =
    !dataReady ||
    !mapReady ||
    (!regionPickMode && gyms.length > 0 && inViewGyms.length === 0 && !mapBounds);
  const pageJumpLoading =
    mapSelectPending &&
    !!selectedId &&
    !pageGyms.some((g) => g.id === selectedId);
  const listFillTarget = mobileList ? PAGE_SIZE_MOBILE : pageSize;
  const showMissing =
    !listLoading &&
    !pageJumpLoading &&
    !regionPickMode &&
    pageGyms.length < listFillTarget &&
    (inViewGyms.length > 0 || gyms.length === 0);

  const filterKey = [
    query,
    sortId,
    selectedChains.join(","),
    selectedAudiences.join(","),
    distanceFilter,
    String(priceMin),
    String(priceMax),
    String(extraOnly247),
    String(extraFreeTrial),
    String(extraDayPass),
  ].join("|");

  useEffect(() => {
    if (prevFilterKeyRef.current == null) {
      prevFilterKeyRef.current = filterKey;
      return;
    }
    if (prevFilterKeyRef.current === filterKey) return;
    prevFilterKeyRef.current = filterKey;
    setPage(1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [filterKey]);

  useEffect(() => {
    if (!mobileList) return;
    const rows = listScrollRef.current?.querySelector<HTMLElement>(".browse-rows");
    if (rows) rows.scrollTop = 0;
  }, [safePage, mobileList, listRevealKey]);

  useEffect(() => {
    if (!mobileList || mobileMapOpen) {
      setListAtEnd(true);
      return;
    }
    const box = listScrollRef.current;
    if (!box) return;
    function check() {
      const el = listScrollRef.current;
      if (!el) return;
      const canScroll = el.scrollHeight > el.clientHeight + 2;
      const atEnd =
        !canScroll ||
        el.scrollTop + el.clientHeight >= el.scrollHeight - 3;
      setListAtEnd(atEnd);
    }
    check();
    box.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(box);
    return () => {
      box.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [
    mobileList,
    mobileMapOpen,
    pageGyms.length,
    safePage,
    listRevealKey,
    showMissing,
  ]);

  useLayoutEffect(() => {
    if (skipBoundsResetRef.current) {
      skipBoundsResetRef.current = false;
      return;
    }
    setPage(1);
    const id = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [mapBounds]);

  useEffect(() => {
    if (inViewGyms.length > 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [inViewGyms.length]);

  useEffect(() => {
    if (!selectedId || !selectFromMapRef.current) return;
    const idx = inViewGyms.findIndex((g) => g.id === selectedId);
    if (idx < 0) {
      selectFromMapRef.current = false;
      setMapSelectPending(false);
      return;
    }
    const needPage = Math.floor(idx / pageSize) + 1;
    if (safePage !== needPage) {
      setPage(needPage);
      return;
    }

    const el = document.querySelector<HTMLElement>(
      `.browse-row[data-gym-id="${selectedId}"]`,
    );
    if (!el) {
      selectFromMapRef.current = false;
      setMapSelectPending(false);
      return;
    }

    let cancelled = false;
    const mobile = window.matchMedia(BROWSE_MOBILE_MQ).matches;
    const run = () => {
      if (cancelled) return;
      const scroller = listScrollRef.current;
      if (scroller) {
        const scRect = scroller.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const pad = mobile ? 14 : 10;
        let delta = 0;
        if (elRect.bottom > scRect.bottom - pad) {
          delta = elRect.bottom - scRect.bottom + pad;
        } else if (elRect.top < scRect.top + pad) {
          delta = elRect.top - scRect.top - pad;
        }
        if (delta !== 0) {
          scroller.scrollBy({ top: delta, behavior: "smooth" });
        }
      }
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      selectFromMapRef.current = false;
      setMapSelectPending(false);
    };
    const id = window.setTimeout(run, mobile ? 120 : 32);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selectedId, pageGyms, inViewGyms, pageSize, safePage, listRevealKey]);

  useEffect(() => {
    if (!selectedId) return;
    if (visibleGyms.some((g) => g.id === selectedId)) return;
    setSelectedId(null);
  }, [visibleGyms, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setRegionMenuOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!openFilter) return;
    function close() {
      setOpenFilter(null);
    }
    const id = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", close);
    };
  }, [openFilter]);

  useLockPageScroll(extrasOpen || chainsOpen || mapSheet != null);

  useEffect(() => {
    if (mapSheet !== "address") return;
    setAddressDraft(locationLabel);
    setAddressSuggest(false);
  }, [mapSheet, locationLabel]);

  useEffect(() => {
    if (!chainsOpen) {
      setChainQuery("");
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setChainsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [chainsOpen]);

  function toggleFilter(key: FilterKey) {
    setExtrasOpen(false);
    setOpenFilter((cur) => (cur === key ? null : key));
  }

  useBrowseMapInit({
    mapRef,
    mapInstanceRef,
    originRef,
    mapPinchRef,
    mapTouchCountRef,
    afterPinchSyncRef,
    browseCitySlugRef,
    selectedIdRef,
    gymsRef,
    routeRegionNameRef,
    regionUserPickedRef,
    selectedMaakuntaRef,
    maakuntaFeaturesRef,
    fitKeyRef,
    regionPickModeRef,
    setMapReady,
    setMaakunnatReady,
    setBrowseAllAreas,
    setSelectedMaakunta,
    setRegionNames,
    markersRef,
    originMarkerRef,
  });

  useBrowseMapMarkers({
    mapInstanceRef,
    mapReady,
    visibleGyms,
    origin,
    locationLabel,
    selectedMaakunta,
    chains,
    lang,
    t,
    markersRef,
    originMarkerRef,
    chainsByIdRef,
    visibleGymsRef,
    regionPickModeRef,
    explodeClusterIdsRef,
    favoriteSlugsRef,
    selectedIdRef,
    hoveredIdRef,
    inViewGymsRef,
    pageGymsRef,
    pageSizeRef,
    originRef,
    cityBounceLockRef,
    preCompareCameraRef,
    freezeListBoundsRef,
    selectFromMapRef,
    mapPinchRef,
    mapTouchCountRef,
    afterPinchSyncRef,
    setHoveredId,
    setSelectedId,
    setPage,
    setMapSelectPending,
    setListRevealKey,
    setMapBounds,
  });

  useEffect(() => {
    const state = routeLocation.state as { fitChainGyms?: boolean } | null;
    if (!state?.fitChainGyms) return;
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const pins = visibleGyms.filter((g) => g.lat != null && g.lng != null);
    if (pins.length === 0) return;

    setBrowseAllAreas(true);
    setSelectedMaakunta(null);
    selectedMaakuntaRef.current = null;
    regionPickModeRef.current = false;
    regionUserPickedRef.current = true;

    const bounds = new LngLatBounds();
    for (const g of pins) {
      bounds.extend([g.lng!, g.lat!]);
    }
    map.fitBounds(bounds, {
      padding: 56,
      maxZoom: 9,
      duration: 700,
    });

    navigate(
      {
        pathname: routeLocation.pathname,
        search: routeLocation.search,
      },
      { replace: true, state: null },
    );
  }, [
    mapReady,
    visibleGyms,
    routeLocation.state,
    routeLocation.pathname,
    routeLocation.search,
    navigate,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !maakunnatReady) return;

    const vis = MAAKUNTA_MAP_ACTIVE ? "visible" : "none";
    for (const id of ["maakunnat-fill", "maakunnat-line", "maakunnat-label"]) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, "visibility", vis);
    }

    if (!MAAKUNTA_MAP_ACTIVE) return;

    const hideOpen =
      selectedMaakunta != null
        ? (["!=", ["get", "nimi"], selectedMaakunta] as [
            "!=",
            ["get", string],
            string,
          ])
        : null;

    for (const id of ["maakunnat-fill", "maakunnat-line", "maakunnat-label"]) {
      if (!map.getLayer(id)) continue;
      map.setFilter(id, hideOpen);
    }
  }, [selectedMaakunta, mapReady, maakunnatReady]);

  useEffect(() => {
    if (!mapReady || !maakunnatReady) return;
    if (!MAAKUNTA_MAP_ACTIVE) return;

    let hoveredFeatureId: string | number | null = null;

    function onEnter(e: MapLayerMouseEvent) {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f || f.id == null) return;
      if (hoveredFeatureId != null) {
        map.setFeatureState(
          { source: "maakunnat", id: hoveredFeatureId },
          { hover: false },
        );
      }
      hoveredFeatureId = f.id;
      map.setFeatureState(
        { source: "maakunnat", id: hoveredFeatureId },
        { hover: true },
      );
    }

    function onLeave() {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.getCanvas().style.cursor = "";
      if (hoveredFeatureId != null) {
        map.setFeatureState(
          { source: "maakunnat", id: hoveredFeatureId },
          { hover: false },
        );
        hoveredFeatureId = null;
      }
    }

    function onClick(e: MapLayerMouseEvent) {
      const map = mapInstanceRef.current;
      if (!map) return;
      const f = e.features?.[0];
      const nimi = f?.properties?.nimi as string | undefined;
      if (!nimi || !f?.geometry) return;
      if (nimi === selectedMaakuntaRef.current) return;
      selectedMaakuntaRef.current = nimi;
      regionPickModeRef.current = false;
      regionUserPickedRef.current = true;
      setBrowseAllAreas(false);
      setSelectedMaakunta(nimi);
      const full = maakuntaFeaturesRef.current.find((x) => x.nimi === nimi);
      const bbox = geomBBox(
        (full?.geometry ?? f.geometry) as MaakuntaGeom,
      );
      const mobile = window.matchMedia(BROWSE_MOBILE_MQ).matches;
      const pad = mobile
        ? { top: 24, bottom: 28, left: 24, right: 24 }
        : { top: 72, bottom: 72, left: 72, right: 72 };
      map.fitBounds(bbox, {
        padding: pad,
        duration: 750,
        maxZoom: mobile ? 10.5 : 9.5,
      });
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    map.on("mousemove", "maakunnat-fill", onEnter);
    map.on("mouseleave", "maakunnat-fill", onLeave);
    map.on("click", "maakunnat-fill", onClick);

    return () => {
      map.off("mousemove", "maakunnat-fill", onEnter);
      map.off("mouseleave", "maakunnat-fill", onLeave);
      map.off("click", "maakunnat-fill", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [mapReady, maakunnatReady]);

  useEffect(() => {
    const wantFocus =
      (routeLocation.state as { focusOrigin?: boolean } | null)?.focusOrigin ===
      true;
    if (wantFocus) {
      focusOriginRef.current = true;
      fitKeyRef.current = "";
      regionUserPickedRef.current = false;
    }

    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    if (origin.lat == null || origin.lng == null) return;
    if (!maakunnatReady || maakuntaFeaturesRef.current.length === 0) return;

    const key = `origin:${origin.lat}:${origin.lng}`;
    const originChanged = key !== lastOriginKeyRef.current;
    if (originChanged) {
      lastOriginKeyRef.current = key;
      if (wantFocus || focusOriginRef.current) {
        regionUserPickedRef.current = false;
      }
    }

    let nimi: string | null = null;
    for (const f of maakuntaFeaturesRef.current) {
      if (pointInPolygon(origin.lng, origin.lat, f.geometry)) {
        nimi = f.nimi;
        break;
      }
    }

    const browseFromUrl = !!routeRegionName;
    const followOriginRegion =
      wantFocus ||
      focusOriginRef.current ||
      (!browseFromUrl && !regionUserPickedRef.current);

    if (followOriginRegion) {
      selectedMaakuntaRef.current = nimi;
      regionPickModeRef.current =
        MAAKUNTA_MAP_ACTIVE && nimi == null;
      setBrowseAllAreas(!MAAKUNTA_MAP_ACTIVE);
      setSelectedMaakunta(nimi);
    }

    const shouldZoom =
      focusOriginRef.current ||
      wantFocus ||
      (originChanged && followOriginRegion) ||
      (followOriginRegion && key !== fitKeyRef.current);
    if (!shouldZoom) {
      if (wantFocus) {
        navigate(
          {
            pathname: routeLocation.pathname,
            search: routeLocation.search,
          },
          { replace: true, state: null },
        );
      }
      return;
    }

    const goOrigin = focusOriginRef.current || wantFocus;
    fitKeyRef.current = key;
    focusOriginRef.current = false;

    const citySlug = browseCitySlugRef.current;
    if (citySlug && !goOrigin) {
      cityFitDoneRef.current = null;
      const city =
        cityCenterForSlug(citySlug) ||
        cityOptions.find((c) => c.slug === citySlug);
      if (city) {
        fitToCityGyms(city);
      } else {
        map.easeTo({
          center: [origin.lng, origin.lat],
          zoom: ORIGIN_ZOOM,
          duration: 700,
        });
      }
    } else {
      mobileMapFitKeyRef.current = `origin:${origin.lat}:${origin.lng}`;
      map.easeTo({
        center: [origin.lng, origin.lat],
        zoom: ORIGIN_ZOOM,
        duration: 700,
      });
    }

    if (wantFocus) {
      navigate(
        {
          pathname: routeLocation.pathname,
          search: routeLocation.search,
        },
        { replace: true, state: null },
      );
    }
  }, [
    mapReady,
    maakunnatReady,
    origin.lat,
    origin.lng,
    routeLocation.state,
    routeLocation.pathname,
    routeLocation.search,
    routeRegionName,
    navigate,
    cityOptions,
  ]);
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const hit = el.querySelector(".gym-pin-hit");
      if (!hit) return;
      const front = id === selectedId || id === hoveredId;
      hit.classList.toggle("is-hovered", id === hoveredId);
      hit.classList.toggle("is-selected", id === selectedId);
      el.classList.toggle("is-front", front);
      const base = Number(el.dataset.stackZ) || 1;
      if (id === selectedId) el.style.zIndex = "12000";
      else if (id === hoveredId) el.style.zIndex = "11000";
      else el.style.zIndex = String(base);
    });
    hoveredIdRef.current = hoveredId;
    selectedIdRef.current = selectedId;
  }, [hoveredId, selectedId]);

  useEffect(() => {
    const favs = new Set(favoriteSlugs);
    markersRef.current.forEach((marker) => {
      const el = marker.getElement();
      const slug = el.dataset.gymSlug;
      el.classList.toggle("is-fav", !!slug && favs.has(slug));
    });
  }, [favoriteSlugs]);

  const browseReady = dataReady && mapReady;

  useLayoutEffect(() => {
    const row = suggestChipsRef.current;
    if (!row) return;

    function fitChips() {
      if (!row) return;
      const chips = [
        ...row.querySelectorAll<HTMLElement>(".browse-search-suggest-chip"),
      ];
      for (const chip of chips) chip.classList.remove("is-overflow");
      const limit = row.getBoundingClientRect().right - 1;
      let hideRest = false;
      for (const chip of chips) {
        if (hideRest || chip.getBoundingClientRect().right > limit) {
          chip.classList.add("is-overflow");
          hideRest = true;
        }
      }
    }

    fitChips();
    const ro = new ResizeObserver(fitChips);
    ro.observe(row);
    window.addEventListener("resize", fitChips);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fitChips);
    };
  }, [
    lang,
    query,
    extraFreeTrial,
    extraOnly247,
    extraDayPass,
    browseReady,
  ]);

  useEffect(() => {
    if (!mobileList || !mobileMapOpen || !mapReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const id = window.requestAnimationFrame(() => {
      map.resize();
      if (activeCitySlug) {
        const key = `city:${activeCitySlug}`;
        if (mobileMapFitKeyRef.current === key) return;
        mobileMapFitKeyRef.current = key;
        const city =
          cityCenterForSlug(activeCitySlug) ||
          cityOptions.find((c) => c.slug === activeCitySlug);
        if (city) fitToCityGyms(city);
        return;
      }
      if (origin.lat == null || origin.lng == null) return;
      const key = `origin:${origin.lat}:${origin.lng}`;
      if (mobileMapFitKeyRef.current === key) return;
      mobileMapFitKeyRef.current = key;
      map.jumpTo({
        center: [origin.lng, origin.lat],
        zoom: ADDRESS_ZOOM,
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [
    mobileList,
    mobileMapOpen,
    mapReady,
    origin.lat,
    origin.lng,
    activeCitySlug,
    cityOptions,
  ]);

  useEffect(() => {
    const pending = pendingMyLocationRef.current;
    if (!pending || !mapReady || !browseReady) return;
    if (pending.citySlug && browseCitySlug !== pending.citySlug) return;
    if (pending.citySlug && routeCitySlug && routeCitySlug !== pending.citySlug) {
      return;
    }
    const id = window.setTimeout(() => {
      if (!pendingMyLocationRef.current) return;
      const next = pendingMyLocationRef.current;
      pendingMyLocationRef.current = null;
      easeToMyLocation(next.lat, next.lng);
    }, 320);
    return () => window.clearTimeout(id);
  }, [
    browseCitySlug,
    mapReady,
    browseReady,
    gyms,
    routeCitySlug,
    myLocationTick,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    if (!browseCitySlug) {
      cityFitDoneRef.current = null;
      applyFinlandMinZoom(map);
      return;
    }
    if (pendingMyLocationRef.current) {
      cityFitDoneRef.current = browseCitySlug;
      return;
    }
    if (cityBounceLockRef.current) return;
    const pins = gyms.filter(
      (g) =>
        g.lat != null &&
        g.lng != null &&
        toCitySlug(g.city) === browseCitySlug,
    );
    if (pins.length === 0) return;
    if (cityFitDoneRef.current === browseCitySlug) {
      if (selectedIdRef.current) return;
      applyPinsMinZoom(
        map,
        pins.map((g) => ({ lat: g.lat!, lng: g.lng! })),
        framePadForOverlays(map, { labelTop: 36 }),
      );
      return;
    }
    const city =
      cityCenterForSlug(browseCitySlug) ||
      cityOptions.find((c) => c.slug === browseCitySlug);
    if (!city) return;
    fitToCityGyms(city);
  }, [mapReady, browseCitySlug, gyms, cityOptions]);

  useEffect(() => {
    if (!mapReady || !browseCitySlug) return;
    const citySlug = browseCitySlug;

    function bounceIfLost() {
      const map = mapInstanceRef.current;
      if (!map) return;
      if (cityBounceLockRef.current) return;
      if (selectedIdRef.current) return;
      const pins = gyms.filter(
        (g) =>
          g.lat != null &&
          g.lng != null &&
          toCitySlug(g.city) === citySlug,
      );
      if (pins.length === 0) return;
      const bounds = map.getBounds();
      const anyInView = pins.some(
        (g) => g.lng != null && g.lat != null && bounds.contains([g.lng, g.lat]),
      );
      if (anyInView) return;
      const city =
        cityCenterForSlug(citySlug) ||
        cityOptions.find((c) => c.slug === citySlug);
      if (!city) return;
      map.stop();
      fitToCityGyms(city);
    }

    function onDrag() {
      bounceIfLost();
    }

    function onMoveEnd() {
      bounceIfLost();
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    map.on("drag", onDrag);
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("drag", onDrag);
      map.off("moveend", onMoveEnd);
    };
  }, [mapReady, browseCitySlug, gyms, cityOptions]);

  useEffect(() => {
    const prev = prevSelectedIdRef.current;
    prevSelectedIdRef.current = selectedId;
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (selectedId) return;
    if (!prev) return;

    const saved = preCompareCameraRef.current;
    preCompareCameraRef.current = null;
    cityBounceLockRef.current = true;

    if (saved) {
      map.stop();
      map.easeTo({
        center: [saved.lng, saved.lat],
        zoom: saved.zoom,
        duration: 700,
        easing: (t) => 1 - (1 - t) ** 3,
      });
      window.setTimeout(() => {
        map.setMinZoom(saved.minZoom);
        if (map.getZoom() < saved.minZoom) {
          map.setZoom(saved.minZoom);
        }
        cityBounceLockRef.current = false;
      }, 750);
      return;
    }

    if (!browseCitySlug) {
      applyFinlandMinZoom(map);
      cityBounceLockRef.current = false;
      return;
    }
    const city =
      cityCenterForSlug(browseCitySlug) ||
      cityOptions.find((c) => c.slug === browseCitySlug);
    if (city) fitToCityGyms(city);
    else cityBounceLockRef.current = false;
  }, [selectedId, mapReady, browseCitySlug, cityOptions]);

  function focusGymFromList(gym: Gym) {
    if (gym.lat == null || gym.lng == null) return;
    selectFromMapRef.current = false;
    skipBoundsResetRef.current = true;
    freezeListBoundsRef.current = true;
    selectedIdRef.current = gym.id;
    flushSync(() => {
      setSelectedId(gym.id);
    });
    const map = mapInstanceRef.current;
    if (!map) return;
    const here = originRef.current;
    const lat = gym.lat;
    const lng = gym.lng;
    window.requestAnimationFrame(() => {
      frameOriginAndGym(
        map,
        here.lng,
        here.lat,
        lng,
        lat,
        cityBounceLockRef,
        preCompareCameraRef,
      );
    });
  }

  function fitToCityGyms(city: CityCenter) {
    const map = mapInstanceRef.current;
    if (!map) return;
    const pinList = gyms
      .filter(
        (g) =>
          g.lat != null &&
          g.lng != null &&
          toCitySlug(g.city) === city.slug,
      )
      .map((g) => ({ lat: g.lat!, lng: g.lng! }));
    cityFitDoneRef.current = city.slug;
    mobileMapFitKeyRef.current = `city:${city.slug}`;
    explodeClusterIdsRef.current = null;
    preCompareCameraRef.current = null;
    cityBounceLockRef.current = true;
    requestAnimationFrame(() => {
      map.stop();
      map.resize();
      const pad = framePadForOverlays(map, {
        labelTop: 44,
        labelBottom: 24,
      });
      map.setMinZoom(1);
      if (pinList.length === 0) {
        map.easeTo({
          center: [city.lng, city.lat],
          zoom: ADDRESS_ZOOM,
          duration: 650,
        });
        applyFinlandMinZoom(map);
      } else {
        const bounds =
          pinList.length === 1
            ? expandBoundsByKm(boundsFromPins(pinList), 2.5)
            : boundsFromPins(pinList);
        map.fitBounds(bounds, {
          padding: pad,
          duration: 700,
          maxZoom: 14,
        });
        applyPinsMinZoom(map, pinList, pad);
      }
      window.setTimeout(() => {
        cityBounceLockRef.current = false;
      }, 850);
    });
  }

  function focusCity(city: CityCenter) {
    setBrowseCitySlug(city.slug);
    cityFitDoneRef.current = null;
    setCityQuery("");
    setRegionMenuOpen(false);
    setMapSheet(null);
    const region = regionForCitySlug(city.slug);
    if (region) {
      selectedMaakuntaRef.current = region.name;
      regionPickModeRef.current = false;
      regionUserPickedRef.current = true;
      setBrowseAllAreas(false);
      setSelectedMaakunta(region.name);
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        fitToCityGyms(city);
      });
    });
  }

  function easeToMyLocation(lat: number, lng: number) {
    const map = mapInstanceRef.current;
    if (!map) return;
    selectedIdRef.current = null;
    preCompareCameraRef.current = null;
    prevSelectedIdRef.current = null;
    setSelectedId(null);
    cityBounceLockRef.current = true;
    if (browseCitySlugRef.current) {
      cityFitDoneRef.current = browseCitySlugRef.current;
    }
    mobileMapFitKeyRef.current = `origin:${lat}:${lng}`;
    map.stop();
    map.easeTo({
      center: [lng, lat],
      zoom: ORIGIN_ZOOM,
      duration: 550,
    });
    window.setTimeout(() => {
      cityBounceLockRef.current = false;
    }, 850);
  }

  function resolveCityFromPlace(next: {
    label: string;
    lat: number;
    lng: number;
  }) {
    const fromLabel = cityFromLabel(next.label);
    return (
      (fromLabel ? cityCenterForName(fromLabel) : null) ||
      nearestCityCenter(next.lat, next.lng)
    );
  }

  function applyCityForMyLocation(city: CityCenter) {
    setBrowseCitySlug(city.slug);
    cityFitDoneRef.current = city.slug;
    setCityQuery("");
    setRegionMenuOpen(false);
    setMapSheet(null);
    const region = regionForCitySlug(city.slug);
    if (!region) return;
    selectedMaakuntaRef.current = region.name;
    regionPickModeRef.current = false;
    regionUserPickedRef.current = true;
    setBrowseAllAreas(false);
    setSelectedMaakunta(region.name);
    const nextPath = pathGymsBrowse(lang, region.slug, city.slug);
    const cur = routeLocation.pathname.replace(/\/$/, "") || "/";
    if (cur !== nextPath) {
      navigate(
        { pathname: nextPath, search: routeLocation.search },
        { replace: true },
      );
    }
  }

  function goMyLocation() {
    void useMyLocation().then((place) => {
      if (!place) return;
      const city = resolveCityFromPlace(place);
      pendingMyLocationRef.current = {
        lat: place.lat,
        lng: place.lng,
        citySlug: city?.slug ?? browseCitySlugRef.current,
      };
      cityBounceLockRef.current = true;
      if (city && browseCitySlugRef.current !== city.slug) {
        applyCityForMyLocation(city);
      }
      setMyLocationTick((n) => n + 1);
    });
  }

  function focusRegion(nimi: string) {
    const map = mapInstanceRef.current;
    const full = maakuntaFeaturesRef.current.find((x) => x.nimi === nimi);
    setRegionMenuOpen(false);
    setMapSheet(null);
    if (!map || !full) return;
    selectedMaakuntaRef.current = nimi;
    regionPickModeRef.current = false;
    regionUserPickedRef.current = true;
    setBrowseAllAreas(false);
    setSelectedMaakunta(nimi);
    const bbox = geomBBox(full.geometry);
    const mobile = window.matchMedia(BROWSE_MOBILE_MQ).matches;
    const pad = mobile
      ? { top: 24, bottom: 28, left: 24, right: 24 }
      : { top: 72, bottom: 72, left: 72, right: 72 };
    requestAnimationFrame(() => {
      map.resize();
      map.fitBounds(bbox, {
        padding: pad,
        duration: 750,
        maxZoom: mobile ? 10.5 : 9.5,
      });
    });
  }

  return (
    <>
    {!browseReady ? (
      <div className="load-cover">
        <LoadSpin />
      </div>
    ) : null}
    <main
      className={
        "browse" +
        (browseReady ? " load-reveal" : "") +
        (selectedId ? " is-pin-selected" : "") +
        (mobileMapOpen ? " is-mobile-map" : "")
      }
    >
      <div
        className="browse-chrome"
        ref={listChromeRef}
        onClick={(e) => e.stopPropagation()}
      >
      <BrowseSearchChrome
        t={t}
        query={query}
        onQuery={setQuery}
        extrasOpen={extrasOpen}
        filtersMoreActive={filtersMoreActive}
        filtersMoreBadge={filtersMoreBadge}
        extrasLabel={extrasLabel}
        onOpenExtras={() => {
          setOpenFilter(null);
          setExtrasOpen(true);
        }}
      />
      </div>
      <div className="browse-tools">
      <BrowseSuggestChips
        t={t}
        query={query}
        extraOnly247={extraOnly247}
        extraFreeTrial={extraFreeTrial}
        extraDayPass={extraDayPass}
        onToggleExtra247={() => {
          setExtraOnly247((v) => !v);
          setPage(1);
        }}
        onToggleFreeTrial={() => {
          setExtraFreeTrial((v) => !v);
          setPage(1);
        }}
        onToggleDayPass={() => {
          setExtraDayPass((v) => !v);
          setPage(1);
        }}
        onPickQuery={(q) => {
          setQuery(q);
          setPage(1);
        }}
        chipsRef={suggestChipsRef}
      />
      <BrowseFilters
        t={t}
        chainFilterActive={chainFilterActive}
        selectedChainsCount={selectedChains.length}
        priceFilterOn={priceFilterOn}
        priceInfo={priceInfo}
        openFilter={openFilter}
        onToggleFilter={toggleFilter}
        priceMin={priceMin}
        priceMax={priceMax}
        onPriceMin={setPriceMin}
        onPriceMax={setPriceMax}
        maxDistanceKm={maxDistanceKm}
        distancePresetIndex={distancePresetIndex}
        distancePresets={distancePresets}
        distanceFilter={distanceFilter}
        onDistanceFilter={setDistanceFilter}
        filtersMoreActive={filtersMoreActive}
        filtersMoreBadge={filtersMoreBadge}
        extrasLabel={extrasLabel}
        extrasOpen={extrasOpen}
        onOpenChains={() => {
          setOpenFilter(null);
          setExtrasOpen(false);
          setChainsOpen(true);
        }}
        onOpenExtras={() => {
          setOpenFilter(null);
          setExtrasOpen(true);
        }}
        onClear={() => {
          setSelectedChains([...visibleChainFilterIds]);
          setSelectedAudiences([]);
          setDistanceFilter("all");
          setPriceMin(PRICE_MIN);
          setPriceMax(PRICE_MAX);
          setExtraOnly247(false);
          setExtraFreeTrial(false);
          setExtraDayPass(false);
          setOpenFilter(null);
          setExtrasOpen(false);
        }}
      />
      </div>
      <div className="browse-body">
        <section
          className={
            listAtEnd ? "browse-list-frame is-list-end" : "browse-list-frame"
          }
        >
          <BrowseListHead
            t={t}
            regionPickMode={regionPickMode}
            regionDropRef={regionDropRef}
            regionMenuOpen={regionMenuOpen}
            regionSheetOpen={mapSheet === "region"}
            mobileList={mobileList}
            regionLabel={
              browseCitySlug ? displayCityName(browseCitySlug) : t("regions")
            }
            cityQuery={cityQuery}
            onCityQuery={setCityQuery}
            cityOptions={filteredCityOptions}
            activeCitySlug={browseCitySlug}
            onFocusCity={focusCity}
            onRegionClick={() => {
              if (mobileList) {
                setCityQuery("");
                setRegionMenuOpen(false);
                setMapSheet((cur) => (cur === "region" ? null : "region"));
                return;
              }
              setRegionMenuOpen((v) => !v);
              setCityQuery("");
            }}
            inViewCount={inViewGyms.length}
            safePage={safePage}
            pageCount={pageCount}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            sortLabel={sortLabel}
            sortId={sortId}
            sortOptions={sortOptions}
            sortMenuOpen={openFilter === "sort"}
            onToggleSort={() => toggleFilter("sort")}
            onSelectSort={(id) => {
              setSortId(id);
              setOpenFilter(null);
            }}
          />
          <BrowseResultsList
            t={t}
            lang={lang}
            origin={origin}
            chains={chains}
            listScrollRef={listScrollRef}
            regionPickMode={regionPickMode}
            listLoading={listLoading}
            pageJumpLoading={pageJumpLoading}
            showMissing={showMissing}
            browseReady={browseReady}
            mobileList={mobileList}
            pageGyms={pageGyms}
            inViewCount={inViewGyms.length}
            visibleCount={visibleGyms.length}
            gymsCount={gyms.length}
            hoveredId={hoveredId}
            selectedId={selectedId}
            favoriteSlugs={favoriteSlugs}
            onHover={setHoveredId}
            onToggleFavorite={(slug) =>
              setFavoriteSlugs(toggleFavoriteSlug(slug))
            }
            onFocusGym={focusGymFromList}
            safePage={safePage}
            pageCount={pageCount}
            onPage={setPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
          />
        </section>
        <section
          className={
            "browse-map-col"
          }
        >
          <div className="browse-map-frame">
            <BrowseMapChrome
              t={t}
              cityLabel={browseCitySlug ? displayCityName(browseCitySlug) : null}
              addressDraft={addressDraft}
              locationLabel={locationLabel}
              addressSuggest={addressSuggest}
              addressHits={addressHits}
              addressLoading={addressLoading}
              onAddressDraft={setAddressDraft}
              onAddressSuggest={setAddressSuggest}
              onPickAddress={(item) => {
                setAddressSuggest(false);
                flushSync(() => {
                  setLocation({
                    label: item.label,
                    lat: item.lat,
                    lng: item.lng,
                  });
                });
              }}
              onLocate={goMyLocation}
              onZoomIn={() => mapInstanceRef.current?.zoomIn({ duration: 280 })}
              onZoomOut={() => {
                const map = mapInstanceRef.current;
                if (!map) return;
                if (map.getZoom() <= map.getMinZoom() + 0.01) return;
                map.zoomOut({ duration: 280 });
              }}
              locateDisabled={origin.lat == null || origin.lng == null}
              onLocateFab={() => {
                if (origin.lat == null || origin.lng == null) return;
                const place = {
                  label: locationLabel,
                  lat: origin.lat,
                  lng: origin.lng,
                };
                const city = resolveCityFromPlace(place);
                pendingMyLocationRef.current = {
                  lat: place.lat,
                  lng: place.lng,
                  citySlug: city?.slug ?? browseCitySlugRef.current,
                };
                cityBounceLockRef.current = true;
                if (city && browseCitySlugRef.current !== city.slug) {
                  applyCityForMyLocation(city);
                }
                setMyLocationTick((n) => n + 1);
              }}
            />
            <div className="browse-map" aria-label={t("map")} ref={mapRef} />
            {selectedMapGym ? (
              <BrowseSelectedCard
                selected={selectedMapGym}
                lang={lang}
                t={t}
                origin={origin}
                isFav={favoriteSlugs.includes(selectedMapGym.gym.slug)}
                onToggleFavorite={() =>
                  setFavoriteSlugs(toggleFavoriteSlug(selectedMapGym.gym.slug))
                }
              />
            ) : null}
          </div>
        </section>

        {mobileList ? (
          <button
            type="button"
            className="browse-map-open-btn"
            onClick={() => setMobileMapOpen((v) => !v)}
          >
            {mobileMapOpen ? (
              <>
                <List size={18} strokeWidth={2.3} />
                {t("list")}
              </>
            ) : (
              <>
                <MapIcon size={18} strokeWidth={2.3} />
                {t("map")}
              </>
            )}
          </button>
        ) : null}
      </div>

      {mapSheet
        ? createPortal(
            <BrowseMapSheet
              t={t}
              mode={mapSheet}
              onClose={() => setMapSheet(null)}
              addressDraft={addressDraft}
              onAddressChange={(value) => {
                setAddressDraft(value);
                setAddressSuggest(true);
              }}
              addressHits={addressHits}
              addressLoading={addressLoading}
              locationLabel={locationLabel}
              onPickAddress={(item) => {
                setAddressSuggest(false);
                flushSync(() => {
                  setLocation({
                    label: item.label,
                    lat: item.lat,
                    lng: item.lng,
                  });
                });
                setMapSheet(null);
              }}
              onLocate={() => {
                goMyLocation();
                setMapSheet(null);
              }}
              cityQuery={cityQuery}
              onCityQuery={setCityQuery}
              cityOptions={filteredCityOptions}
              activeCitySlug={browseCitySlug}
              onFocusCity={focusCity}
            />,
            document.body,
          )
        : null}

      {extrasOpen
        ? createPortal(
            <BrowseExtrasMenu
              t={t}
              chainFilterActive={chainFilterActive}
              selectedChainsCount={selectedChains.length}
              priceMin={priceMin}
              priceMax={priceMax}
              onPriceMin={setPriceMin}
              onPriceMax={setPriceMax}
              maxDistanceKm={maxDistanceKm}
              distancePresetIndex={distancePresetIndex}
              distancePresets={distancePresets}
              distanceFilter={distanceFilter}
              onDistanceFilter={setDistanceFilter}
              womenOnly={womenOnly}
              onWomenOnly={(on) => setSelectedAudiences(on ? ["women"] : [])}
              extraOnly247={extraOnly247}
              onExtraOnly247={setExtraOnly247}
              extraFreeTrial={extraFreeTrial}
              onExtraFreeTrial={setExtraFreeTrial}
              extraDayPass={extraDayPass}
              onExtraDayPass={setExtraDayPass}
              onClose={() => setExtrasOpen(false)}
              onOpenChains={() => {
                setExtrasOpen(false);
                setChainsOpen(true);
              }}
              onClearOptions={() => {
                setSelectedAudiences([]);
                setExtraOnly247(false);
                setExtraFreeTrial(false);
                setExtraDayPass(false);
              }}
              onClearAll={() => {
                setSelectedChains([...visibleChainFilterIds]);
                setSelectedAudiences([]);
                setDistanceFilter("all");
                setPriceMin(PRICE_MIN);
                setPriceMax(PRICE_MAX);
                setExtraOnly247(false);
                setExtraFreeTrial(false);
                setExtraDayPass(false);
              }}
            />,
            document.body,
          )
        : null}

      {chainsOpen
        ? createPortal(
            <BrowseChainsMenu
              t={t}
              chains={chains}
              options={localizedChainFilterOptions}
              selectedChains={selectedChains}
              visibleChainFilterIds={visibleChainFilterIds}
              chainQuery={chainQuery}
              onChainQuery={setChainQuery}
              onToggleChain={(id) => {
                setSelectedChains((cur) =>
                  cur.includes(id)
                    ? cur.filter((x) => x !== id)
                    : [...cur, id],
                );
              }}
              onSelectAll={() => setSelectedChains([...visibleChainFilterIds])}
              onClearAll={() => setSelectedChains([])}
              onClose={() => setChainsOpen(false)}
            />,
            document.body,
          )
        : null}

    </main>
    </>
  );
}

export default GymsPage;
