import "./GymsPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { LngLatBounds, Map, Marker, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import {
  chainForGym,
  gymHasDayPass,
  gymHasFreeTrial,
  gymIs247,
  gymMatchesAudience,
} from "../data/audience";
import {
  cleanGymDisplayName,
  formatDistanceKm,
  formatPriceFrom,
  formatPricePill,
} from "../data/format";
import { useAppLocation } from "../context/LocationContext";
import { pathGym } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import UxSwitch from "../components/UxSwitch";
import LoadSpin from "../components/LoadSpin";

function markerScaleForZoom(zoom: number) {
  const t = Math.min(1, Math.max(0, (zoom - 4.2) / 8));
  return 0.42 + t * 0.58;
}

function pinTouchPx(scale: number) {
  return 36 * scale;
}

function clusterGymsByScreenTouch(gyms: Gym[], map: Map, touchPx: number) {
  const n = gyms.length;
  if (n === 0) return [] as Gym[][];

  const pts = [...gyms]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((g) => {
      const p = map.project([g.lng, g.lat]);
      return { g, x: p.x, y: p.y };
    });

  const limit = touchPx * touchPx;
  const used = new Array(n).fill(false);
  const groups: Gym[][] = [];

  function dist2(a: number, b: number) {
    const dx = pts[a].x - pts[b].x;
    const dy = pts[a].y - pts[b].y;
    return dx * dx + dy * dy;
  }

  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const members = [i];
    used[i] = true;
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        const touchesAll = members.every((m) => dist2(m, j) <= limit);
        if (!touchesAll) continue;
        members.push(j);
        used[j] = true;
        grew = true;
      }
    }
    groups.push(members.map((idx) => pts[idx].g));
  }

  return groups;
}
const HANGO: [number, number] = [22.968, 59.824];
const NUORGAM: [number, number] = [27.879, 70.086];
const FINLAND_VIEW: [[number, number], [number, number]] = [
  [18.8, HANGO[1] - 0.35],
  [31.8, NUORGAM[1] + 0.25],
];
const FINLAND_CENTER: [number, number] = [
  (HANGO[0] + NUORGAM[0]) / 2,
  (HANGO[1] + NUORGAM[1]) / 2,
];
const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 53.5],
  [44.0, 73.0],
];

type MaakuntaGeom = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

function pointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, geom: MaakuntaGeom) {
  const polys =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  for (const poly of polys) {
    if (!pointInRing(lng, lat, poly[0])) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) {
      if (pointInRing(lng, lat, poly[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

function geomBBox(geom: MaakuntaGeom): [[number, number], [number, number]] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  function walk(coords: unknown) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number") {
      const lng = coords[0] as number;
      const lat = coords[1] as number;
      minX = Math.min(minX, lng);
      maxX = Math.max(maxX, lng);
      minY = Math.min(minY, lat);
      maxY = Math.max(maxY, lat);
      return;
    }
    for (const c of coords) walk(c);
  }
  walk(geom.coordinates);
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function geomCentroid(geom: MaakuntaGeom): [number, number] {
  const [[minX, minY], [maxX, maxY]] = geomBBox(geom);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function applyFinlandMinZoom(map: Map) {
  const cam = map.cameraForBounds(FINLAND_VIEW, { padding: 36 });
  if (cam?.zoom == null) return;
  map.setMinZoom(Math.max(1, cam.zoom - 0.65));
}

function centerFinlandIfMaxOut(map: Map) {
  if (map.getZoom() > map.getMinZoom() + 0.12) return;
  const c = map.getCenter();
  if (
    Math.abs(c.lng - FINLAND_CENTER[0]) < 0.08 &&
    Math.abs(c.lat - FINLAND_CENTER[1]) < 0.08
  ) {
    return;
  }
  map.easeTo({ center: FINLAND_CENTER, duration: 280 });
}

const OTHER_CHAIN_FILTER_ID = "yksityiset";

const chainFilterOptionIds = [
  "elixia",
  "easyfit",
  "fressi",
  "fitness24",
  "gofitness",
  "olefit",
  "liikku",
  "forever",
  "ladyline",
  "esport",
  "unisport",
  "mm",
  OTHER_CHAIN_FILTER_ID,
] as const;

const chainFilterBrandLabels: Record<string, string> = {
  elixia: "Elixia",
  easyfit: "EasyFit",
  fressi: "Fressi",
  fitness24: "Fitness24Seven",
  gofitness: "GoFitness",
  olefit: "Ole.Fit",
  liikku: "Liikku",
  forever: "Forever",
  ladyline: "LadyLine",
  esport: "Esport",
  unisport: "UniSport",
  mm: "M&M",
};

const chainFilterOptions = chainFilterOptionIds.map((id) => ({
  id,
  label: id === OTHER_CHAIN_FILTER_ID ? "Yksityiset / muut" : chainFilterBrandLabels[id],
}));

const allChainFilterIds = chainFilterOptions.map((o) => o.id);

function chainMatchesFilterKey(chain: { slug: string }, key: string) {
  const slug = chain.slug.replace(/-/g, "").toLowerCase();
  const k = key.replace(/-/g, "").toLowerCase();
  return slug === k || slug.startsWith(k) || k.startsWith(slug);
}

function isListedBrandChain(chain: { slug: string }) {
  return chainFilterOptions.some(
    (opt) =>
      opt.id !== OTHER_CHAIN_FILTER_ID && chainMatchesFilterKey(chain, opt.id),
  );
}

function filterIdFromChainSlug(slug: string, chains: Chain[]) {
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

type AddressHit = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

const distancePresetMeta = [
  { id: "1", km: 1 },
  { id: "3", km: 3 },
  { id: "5", km: 5 },
  { id: "10", km: 10 },
  { id: "20", km: 20 },
  { id: "50", km: 50 },
  { id: "all", km: null as number | null },
];

const pricePresetMeta = [
  { id: "30", max: 30 },
  { id: "40", max: 40 },
  { id: "50", max: 50 },
  { id: "70", max: 70 },
  { id: "max", max: null as number | null },
];

const cityCenters: Record<string, { lat: number; lng: number }> = {
  Helsinki: { lat: 60.1699, lng: 24.9384 },
  Espoo: { lat: 60.2055, lng: 24.6559 },
  Vantaa: { lat: 60.2934, lng: 25.0378 },
};

function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

type FilterKey = "chains" | "sort" | "price" | "distance";

const PAGE_SIZE = 24;

function GymsPage() {
  const { slug: chainSlug } = useParams();
  const routeLocation = useLocation();
  const { lang, t } = useLang();
  const sortOptions = [
    { id: "nearest", label: t("sortNearest") },
    { id: "name-asc", label: t("sortNameAsc") },
    { id: "name-desc", label: t("sortNameDesc") },
  ];
  const distancePresets = distancePresetMeta.map((opt) => ({
    ...opt,
    label:
      opt.id === "all"
        ? t("distanceAll")
        : `${opt.km} km`,
  }));
  const pricePresets = pricePresetMeta.map((opt) => ({
    ...opt,
    label: opt.max == null ? "Max" : `${opt.max}€`,
  }));
  const localizedChainFilterOptions = chainFilterOptionIds.map((id) => ({
    id,
    label:
      id === OTHER_CHAIN_FILTER_ID
        ? t("otherChains")
        : chainFilterBrandLabels[id],
  }));
  const {
    label: locationLabel,
    lat: locationLat,
    lng: locationLng,
    setLocation,
  } = useAppLocation();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState("nearest");
  const [page, setPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selectedChains, setSelectedChains] = useState<string[]>([
    ...allChainFilterIds,
  ]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("max");
  const [priceDrag, setPriceDrag] = useState<number | null>(null);
  const priceDragging = useRef(false);
  const [extraOnly247, setExtraOnly247] = useState(false);
  const [extraFreeTrial, setExtraFreeTrial] = useState(false);
  const [extraDayPass, setExtraDayPass] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [addressDraft, setAddressDraft] = useState(locationLabel);
  const [addressHits, setAddressHits] = useState<AddressHit[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSuggest, setAddressSuggest] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [maakunnatReady, setMaakunnatReady] = useState(false);
  const [selectedMaakunta, setSelectedMaakunta] = useState<string | null>(null);
  const [gymMaakuntaMap, setGymMaakuntaMap] = useState<Record<string, string>>(
    {},
  );
  const [mapBounds, setMapBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const listChromeRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const originMarkerRef = useRef<Marker | null>(null);
  const selectFromMapRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const visibleGymsRef = useRef<Gym[]>([]);
  const inViewGymsRef = useRef<Gym[]>([]);
  const chainsByIdRef = useRef(new globalThis.Map<string, Chain>());
  const regionPickModeRef = useRef(true);
  const selectedMaakuntaRef = useRef<string | null>(null);
  const maakuntaFeaturesRef = useRef<
    { nimi: string; maakunta: string; geometry: MaakuntaGeom }[]
  >([]);
  const fitKeyRef = useRef("");
  const focusOriginRef = useRef(
    (routeLocation.state as { focusOrigin?: boolean } | null)?.focusOrigin ===
      true,
  );

  const regionPickMode = selectedMaakunta == null;

  useEffect(() => {
    setAddressDraft(locationLabel);
  }, [locationLabel]);

  useEffect(() => {
    const q = addressDraft.trim();
    if (!addressSuggest || q.length < 2 || q === locationLabel) {
      setAddressHits([]);
      setAddressLoading(false);
      return;
    }

    setAddressLoading(true);
    const t = window.setTimeout(() => {
      fetch(`http://localhost:3001/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: AddressHit[]) => {
          setAddressHits(Array.isArray(data) ? data : []);
        })
        .catch(() => setAddressHits([]))
        .finally(() => setAddressLoading(false));
    }, 120);

    return () => window.clearTimeout(t);
  }, [addressDraft, addressSuggest, locationLabel]);

  useEffect(() => {
    document.documentElement.classList.add("browse-no-scrollbar");
    return () => {
      document.documentElement.classList.remove("browse-no-scrollbar");
    };
  }, []);

  useEffect(() => {
    const chrome = listChromeRef.current;
    if (!chrome) return;

    function onScroll() {
      chrome?.classList.toggle("is-scrolled", window.scrollY > 6);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!chainSlug) return;
    const filterId = filterIdFromChainSlug(chainSlug, chains);
    if (filterId) setSelectedChains([filterId]);
  }, [chainSlug, chains]);

  useEffect(() => {
    if (chainSlug) return;
    setSelectedChains([...allChainFilterIds]);
  }, [chainSlug]);

  const sortLabel =
    sortOptions.find((o) => o.id === sortId)?.label ?? t("sortNearest");
  const chainFilterActive = selectedChains.length < allChainFilterIds.length;
  const pageTitle =
    selectedChains.length === 1
      ? (localizedChainFilterOptions.find((o) => o.id === selectedChains[0])
          ?.label ?? t("gymsTitle"))
      : t("gymsTitle");
  const chainLabel =
    selectedChains.length === 0
      ? t("chains")
      : !chainFilterActive
        ? t("chains")
        : selectedChains.length === 1
          ? (localizedChainFilterOptions.find((o) => o.id === selectedChains[0])
              ?.label ?? t("chains"))
          : t("chainsN", { n: selectedChains.length });
  const womenOnly = selectedAudiences.includes("women");
  const distancePresetIndex = Math.max(
    0,
    distancePresets.findIndex((o) => o.id === distanceFilter),
  );
  const maxDistanceKm =
    distancePresets[distancePresetIndex]?.km ?? null;
  const pricePresetIndex = Math.max(
    0,
    pricePresets.findIndex((o) => o.id === priceFilter),
  );
  const priceCap = pricePresets[pricePresetIndex]?.max ?? null;
  const priceShown = priceDrag ?? pricePresetIndex;
  const priceLockIndex = Math.max(
    0,
    Math.min(pricePresets.length - 1, Math.round(priceShown)),
  );

  function lockPrice(raw: number) {
    const i = Math.max(
      0,
      Math.min(pricePresets.length - 1, Math.round(raw)),
    );
    setPriceFilter(pricePresets[i]?.id ?? "max");
    setPriceDrag(null);
  }

  const origin = useMemo(() => {
    if (locationLat != null && locationLng != null) {
      return { lat: locationLat, lng: locationLng };
    }
    const key = Object.keys(cityCenters).find(
      (city) => locationLabel.toLowerCase() === city.toLowerCase(),
    );
    return cityCenters[key ?? "Helsinki"];
  }, [locationLabel, locationLat, locationLng]);

  const extrasActive = extraOnly247 || extraFreeTrial || extraDayPass;
  const extrasLabel = extrasActive ? t("filtersOn") : t("filters");

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

  const visibleGyms = useMemo(() => {
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
      if (priceCap != null) {
        const chain = chainForGym(gym, chains);
        const priceFrom =
          gym.priceFrom != null ? gym.priceFrom : (chain?.priceFrom ?? null);
        if (priceFrom == null || priceFrom > priceCap) return false;
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
      if (selectedMaakunta) {
        if (gymMaakuntaMap[gym.id] !== selectedMaakunta) return false;
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
  }, [
    gyms,
    chains,
    query,
    sortId,
    selectedChainFilter,
    selectedAudiences,
    priceFilter,
    extraOnly247,
    extraFreeTrial,
    extraDayPass,
    maxDistanceKm,
    origin,
    selectedMaakunta,
    gymMaakuntaMap,
  ]);

  visibleGymsRef.current = visibleGyms;
  selectedMaakuntaRef.current = selectedMaakunta;
  regionPickModeRef.current = regionPickMode;
  chainsByIdRef.current = new globalThis.Map(chains.map((c) => [c.id, c]));

  const inViewGyms = useMemo(() => {
    if (regionPickMode) return [];
    if (!mapBounds) return visibleGyms;
    return visibleGyms.filter((g) => {
      if (g.lat == null || g.lng == null) return false;
      return (
        g.lng >= mapBounds.west &&
        g.lng <= mapBounds.east &&
        g.lat >= mapBounds.south &&
        g.lat <= mapBounds.north
      );
    });
  }, [visibleGyms, mapBounds, regionPickMode]);

  inViewGymsRef.current = inViewGyms;

  const pageCount = Math.max(1, Math.ceil(inViewGyms.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const pageGyms = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return inViewGyms.slice(start, start + PAGE_SIZE);
  }, [inViewGyms, safePage]);

  const selectedGym = useMemo(() => {
    if (!selectedId) return null;
    return (
      gyms.find((g) => g.id === selectedId) ??
      visibleGyms.find((g) => g.id === selectedId) ??
      null
    );
  }, [gyms, visibleGyms, selectedId]);

  const selectedChain = useMemo(() => {
    if (!selectedGym) return null;
    return chainForGym(selectedGym, chains);
  }, [chains, selectedGym]);

  const selectedDistanceKm =
    selectedGym && selectedGym.lat != null && selectedGym.lng != null
      ? distanceKm(origin.lat, origin.lng, selectedGym.lat, selectedGym.lng)
      : null;

  useEffect(() => {
    setPage(1);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [
    query,
    sortId,
    selectedChains,
    selectedAudiences,
    distanceFilter,
    priceFilter,
    extraOnly247,
    extraFreeTrial,
    extraDayPass,
  ]);

  useEffect(() => {
    setPage(1);
    const id = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [mapBounds]);

  useEffect(() => {
    if (inViewGyms.length > 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [inViewGyms.length]);

  useEffect(() => {
    if (!selectedId || !selectFromMapRef.current) return;
    if (!pageGyms.some((g) => g.id === selectedId)) return;
    selectFromMapRef.current = false;

    const el = document.querySelector<HTMLElement>(
      `.browse-row[data-gym-id="${selectedId}"]`,
    );
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId, pageGyms]);

  useEffect(() => {
    if (!selectedId) return;
    if (visibleGyms.some((g) => g.id === selectedId)) return;
    setSelectedId(null);
  }, [visibleGyms, selectedId]);

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

  useEffect(() => {
    if (!extrasOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [extrasOpen]);

  function toggleFilter(key: FilterKey) {
    setExtrasOpen(false);
    setOpenFilter((cur) => (cur === key ? null : key));
  }

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: FINLAND_CENTER,
      zoom: 4,
      maxBounds: MAP_MAX_BOUNDS,
    });

    mapInstanceRef.current = map;

    function onResize() {
      applyFinlandMinZoom(map);
    }

    function onMaxOutView() {
      centerFinlandIfMaxOut(map);
    }

    map.on("load", () => {
      map.resize();
      applyFinlandMinZoom(map);
      map.fitBounds(FINLAND_VIEW, {
        padding: 36,
        duration: 0,
      });
      if (map.getZoom() < map.getMinZoom()) {
        map.setZoom(map.getMinZoom());
      }

      void (async () => {
        try {
          const maskRes = await fetch("/geo/finland-mask.json");
          const outlineRes = await fetch("/geo/finland.json");
          const maakuntaRes = await fetch("/geo/maakunnat.json");
          if (!maskRes.ok || !outlineRes.ok) return;
          const maskData = await maskRes.json();
          const outlineData = await outlineRes.json();

          if (!map.getSource("finland-mask")) {
            map.addSource("finland-mask", {
              type: "geojson",
              data: maskData,
            });
            map.addLayer({
              id: "finland-mask-fill",
              type: "fill",
              source: "finland-mask",
              paint: {
                "fill-color": "#0b1220",
                "fill-opacity": 0.55,
              },
            });
          }

          if (!map.getSource("finland-outline")) {
            map.addSource("finland-outline", {
              type: "geojson",
              data: outlineData,
            });
            map.addLayer({
              id: "finland-outline-line",
              type: "line",
              source: "finland-outline",
              paint: {
                "line-color": "#94a3b8",
                "line-width": 1.2,
                "line-opacity": 0.7,
              },
            });
          }

          if (maakuntaRes.ok && !map.getSource("maakunnat")) {
            const maakuntaData = await maakuntaRes.json();
            maakuntaFeaturesRef.current = (
              maakuntaData.features as {
                properties: { nimi: string; maakunta: string };
                geometry: MaakuntaGeom;
              }[]
            ).map((f) => ({
              nimi: f.properties.nimi,
              maakunta: f.properties.maakunta,
              geometry: f.geometry,
            }));

            map.addSource("maakunnat", {
              type: "geojson",
              data: maakuntaData,
              promoteId: "maakunta",
            });

            const labelPoints = {
              type: "FeatureCollection" as const,
              features: (
                maakuntaData.features as {
                  properties: { nimi: string; maakunta: string };
                  geometry: MaakuntaGeom;
                }[]
              ).map((f) => ({
                type: "Feature" as const,
                properties: {
                  nimi: f.properties.nimi,
                  maakunta: f.properties.maakunta,
                },
                geometry: {
                  type: "Point" as const,
                  coordinates: geomCentroid(f.geometry),
                },
              })),
            };
            map.addSource("maakunnat-labels", {
              type: "geojson",
              data: labelPoints,
              promoteId: "maakunta",
            });
            map.addLayer({
              id: "maakunnat-fill",
              type: "fill",
              source: "maakunnat",
              paint: {
                "fill-color": [
                  "match",
                  ["get", "maakunta"],
                  "01",
                  "#1e3a5f",
                  "02",
                  "#4a7fa8",
                  "04",
                  "#9ec5e0",
                  "05",
                  "#2c5282",
                  "06",
                  "#6b9fc4",
                  "07",
                  "#c5dceb",
                  "08",
                  "#254a73",
                  "09",
                  "#5a8fb5",
                  "10",
                  "#a8cfe3",
                  "11",
                  "#1b3554",
                  "12",
                  "#7eb0cc",
                  "13",
                  "#d6e8f2",
                  "14",
                  "#345f8a",
                  "15",
                  "#8ebfd6",
                  "16",
                  "#b8d7e8",
                  "17",
                  "#e8f2f8",
                  "18",
                  "#f0f6fa",
                  "19",
                  "#163049",
                  "21",
                  "#3d6f9c",
                  "#3b6e9e",
                ],
                "fill-opacity": [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  0.72,
                  0.42,
                ],
              },
            });
            map.addLayer({
              id: "maakunnat-line",
              type: "line",
              source: "maakunnat",
              paint: {
                "line-color": "#0f2744",
                "line-width": 1.4,
                "line-opacity": 0.85,
              },
            });
            try {
              map.addLayer({
                id: "maakunnat-label",
                type: "symbol",
                source: "maakunnat-labels",
                layout: {
                  "text-field": ["get", "nimi"],
                  "text-size": 11,
                  "text-transform": "uppercase",
                  "text-letter-spacing": 0.03,
                  "text-max-width": 8,
                  "text-allow-overlap": false,
                  "text-ignore-placement": false,
                },
                paint: {
                  "text-color": "#ffffff",
                  "text-halo-color": "rgba(15, 39, 68, 0.8)",
                  "text-halo-width": 1.5,
                },
              });
            } catch {
              /* fontti ei kaada alueita */
            }
            setMaakunnatReady(true);
          }
        } catch {
          /* peite ei kaada karttaa */
        }
      })();

      setMapReady(true);
    });

    map.on("zoomend", onMaxOutView);
    map.on("moveend", onMaxOutView);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      map.off("zoomend", onMaxOutView);
      map.off("moveend", onMaxOutView);
      setMapReady(false);
      setMaakunnatReady(false);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      mapInstanceRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGymsAndChains()
      .then(([gymData, chainData]) => {
        if (cancelled) return;
        setGyms(gymData);
        setChains(chainData);
      })
      .catch(() => {
        if (cancelled) return;
        setGyms([]);
        setChains([]);
      })
      .finally(() => {
        if (!cancelled) setDataReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mapRefCurrent = mapInstanceRef.current;
    if (!mapRefCurrent || !mapReady) return;
    const map = mapRefCurrent;

    function clearMarkers() {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
    }

    function readBounds() {
      const b = map.getBounds();
      return {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      };
    }

    function syncPins() {
      clearMarkers();

      if (regionPickModeRef.current) return;

      const gyms = visibleGymsRef.current.filter(
        (g) => g.lng != null && g.lat != null,
      );
      if (gyms.length === 0) return;

      const zoom = map.getZoom();
      const scale = markerScaleForZoom(zoom);
      const touchPx = pinTouchPx(scale);
      const groups = clusterGymsByScreenTouch(gyms, map, touchPx);

      groups.forEach((group, groupIndex) => {
        if (group.length === 1) {
          const g = group[0];
          const chain =
            g.chain ?? chainsByIdRef.current.get(g.chainId) ?? undefined;
          const brandImg =
            chain?.image && !chain.image.includes("/pins/")
              ? chain.image
              : null;
          const el = document.createElement("div");
          el.className = ["gym-pin", brandImg ? "is-brand-pin" : "is-plain-pin"]
            .filter(Boolean)
            .join(" ");
          el.dataset.gymId = g.id;
          el.style.setProperty("--pin-scale", String(scale));
          if (g.id === selectedIdRef.current) {
            el.classList.add("is-front");
            el.style.zIndex = "6";
          }

          const hit = document.createElement("button");
          hit.type = "button";
          hit.className = [
            "gym-pin-hit",
            brandImg ? "is-brand" : "",
            brandImg && chain?.logoFit === "contain" ? "is-logo" : "",
            brandImg && chain?.logoClass ? chain.logoClass : "",
          ]
            .filter(Boolean)
            .join(" ");
          if (g.id === selectedIdRef.current) hit.classList.add("is-selected");
          if (g.id === hoveredIdRef.current) hit.classList.add("is-hovered");
          hit.setAttribute("aria-label", g.name);

          const media = document.createElement("span");
          media.className = "gym-pin-media";
          const img = document.createElement("img");
          img.src = brandImg || "/pins/gym-pin.png";
          img.alt = "";
          img.decoding = "async";
          media.appendChild(img);
          hit.appendChild(media);

          if (g.priceFrom != null) {
            const priceText = formatPricePill(g.priceFrom);
            if (priceText) {
              const pill = document.createElement("span");
              pill.className = "gym-pin-price";
              pill.textContent = priceText;
              hit.appendChild(pill);
            }
          }

          el.appendChild(hit);

          hit.addEventListener("mouseenter", () => setHoveredId(g.id));
          hit.addEventListener("mouseleave", () => setHoveredId(null));
          hit.addEventListener("click", () => {
            markersRef.current.forEach((m, mid) => {
              const node = m.getElement();
              if (mid === g.id) {
                node.classList.add("is-front");
                node.style.zIndex = "8";
              } else if (mid !== hoveredIdRef.current) {
                node.classList.remove("is-front");
                node.style.zIndex = "";
              }
            });
            const idx = inViewGymsRef.current.findIndex((x) => x.id === g.id);
            if (idx >= 0) {
              setPage(Math.floor(idx / PAGE_SIZE) + 1);
            }
            selectFromMapRef.current = true;
            setSelectedId(g.id);
          });

          const marker = new Marker({ element: el })
            .setLngLat([g.lng, g.lat])
            .addTo(map);
          markersRef.current.set(g.id, marker);
          return;
        }

        let lng = 0;
        let lat = 0;
        group.forEach((g) => {
          lng += g.lng;
          lat += g.lat;
        });
        lng /= group.length;
        lat /= group.length;

        const el = document.createElement("button");
        el.type = "button";
        el.className = "gym-cluster";
        el.style.setProperty("--pin-scale", String(scale));
        el.textContent = String(group.length);
        el.setAttribute("aria-label", `${group.length} salia`);
        el.addEventListener("click", () => {
          const bounds = new LngLatBounds();
          group.forEach((g) => {
            bounds.extend([g.lng, g.lat]);
          });
          map.fitBounds(bounds, { padding: 72, maxZoom: 16 });
        });

        const marker = new Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(`cluster-${groupIndex}`, marker);
      });
    }

    function syncOriginPin() {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      if (origin.lat == null || origin.lng == null) return;
      const el = document.createElement("div");
      el.className = "gym-origin-pin";
      el.setAttribute("aria-label", "Lähtöosoite");
      originMarkerRef.current = new Marker({ element: el })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
    }

    function pushBounds() {
      const next = readBounds();
      setMapBounds((prev) => {
        if (
          prev &&
          Math.abs(prev.west - next.west) < 1e-7 &&
          Math.abs(prev.south - next.south) < 1e-7 &&
          Math.abs(prev.east - next.east) < 1e-7 &&
          Math.abs(prev.north - next.north) < 1e-7
        ) {
          return prev;
        }
        return next;
      });
    }

    let zoomRaf = 0;

    function onMapZoom() {
      if (regionPickModeRef.current) return;
      if (zoomRaf !== 0) return;
      zoomRaf = requestAnimationFrame(() => {
        zoomRaf = 0;
        syncPins();
      });
    }

    function onMoveEnd() {
      pushBounds();
    }

    function onZoomEnd() {
      if (zoomRaf !== 0) {
        cancelAnimationFrame(zoomRaf);
        zoomRaf = 0;
      }
      syncPins();
      pushBounds();
    }

    syncPins();
    syncOriginPin();
    setMapBounds(readBounds());
    map.resize();

    map.on("zoom", onMapZoom);
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onZoomEnd);

    return () => {
      if (zoomRaf !== 0) cancelAnimationFrame(zoomRaf);
      map.off("zoom", onMapZoom);
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onZoomEnd);
      clearMarkers();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    };
  }, [visibleGyms, mapReady, origin.lat, origin.lng, selectedMaakunta, chains]);

  useEffect(() => {
    if (!maakunnatReady || maakuntaFeaturesRef.current.length === 0) return;
    if (gyms.length === 0) {
      setGymMaakuntaMap({});
      return;
    }
    const next: Record<string, string> = {};
    for (const g of gyms) {
      if (g.lat == null || g.lng == null) continue;
      for (const f of maakuntaFeaturesRef.current) {
        if (pointInPolygon(g.lng, g.lat, f.geometry)) {
          next[g.id] = f.nimi;
          break;
        }
      }
    }
    setGymMaakuntaMap(next);
  }, [gyms, maakunnatReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !maakunnatReady) return;

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
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !maakunnatReady) return;

    let hoveredFeatureId: string | number | null = null;

    function onEnter(e: MapLayerMouseEvent) {
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
      const f = e.features?.[0];
      const nimi = f?.properties?.nimi as string | undefined;
      if (!nimi || !f?.geometry) return;
      if (nimi === selectedMaakuntaRef.current) return;
      selectedMaakuntaRef.current = nimi;
      regionPickModeRef.current = false;
      setSelectedMaakunta(nimi);
      const full = maakuntaFeaturesRef.current.find((x) => x.nimi === nimi);
      const bbox = geomBBox(
        (full?.geometry ?? f.geometry) as MaakuntaGeom,
      );
      map.fitBounds(bbox, {
        padding: { top: 72, bottom: 72, left: 72, right: 72 },
        duration: 750,
        maxZoom: 9.5,
      });
    }

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
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    if (origin.lat == null || origin.lng == null) return;
    if (!maakunnatReady || maakuntaFeaturesRef.current.length === 0) return;

    const key = `origin:${origin.lat}:${origin.lng}`;

    let nimi: string | null = null;
    for (const f of maakuntaFeaturesRef.current) {
      if (pointInPolygon(origin.lng, origin.lat, f.geometry)) {
        nimi = f.nimi;
        break;
      }
    }

    selectedMaakuntaRef.current = nimi;
    regionPickModeRef.current = nimi == null;
    setSelectedMaakunta(nimi);

    const shouldZoom =
      focusOriginRef.current ||
      key !== fitKeyRef.current ||
      map.getZoom() < 11.5;
    if (!shouldZoom) return;

    fitKeyRef.current = key;
    focusOriginRef.current = false;

    map.easeTo({
      center: [origin.lng, origin.lat],
      zoom: 12,
      duration: 650,
    });
  }, [mapReady, maakunnatReady, origin.lat, origin.lng]);
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const hit = el.querySelector(".gym-pin-hit");
      if (!hit) return;
      const front = id === selectedId || id === hoveredId;
      hit.classList.toggle("is-hovered", id === hoveredId);
      hit.classList.toggle("is-selected", id === selectedId);
      el.classList.toggle("is-front", front);
      if (id === selectedId) el.style.zIndex = "8";
      else if (id === hoveredId) el.style.zIndex = "5";
      else el.style.zIndex = "";
    });
    hoveredIdRef.current = hoveredId;
    selectedIdRef.current = selectedId;
  }, [hoveredId, selectedId]);

  const browseReady = dataReady && mapReady;

  return (
    <>
    {!browseReady ? (
      <div className="load-cover">
        <LoadSpin />
      </div>
    ) : null}
    <main className={browseReady ? "browse load-reveal" : "browse load-hold"}>
      <div className="browse-body">
        <section className="browse-list-col">
          <div className="browse-list-chrome" ref={listChromeRef}>
          <div
            className="browse-list-tools"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="browse-search">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="browse-search-icon"
              >
                <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
              </svg>
              <input
                className="browse-search-input"
                type="search"
                placeholder={t("searchNameOrAddress")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="browse-sort">
              <button
                type="button"
                className="browse-sort-btn"
                aria-expanded={openFilter === "sort"}
                aria-haspopup="listbox"
                onClick={() => toggleFilter("sort")}
              >
                <span className="browse-sort-label">{sortLabel}</span>
                <ChevronDown
                  className="browse-sort-chevron"
                  size={16}
                  strokeWidth={2.2}
                />
              </button>
              {openFilter === "sort" ? (
                <ul className="browse-sort-menu" role="listbox">
                  {sortOptions.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={opt.id === sortId ? "is-on" : ""}
                        role="option"
                        aria-selected={opt.id === sortId}
                        onClick={() => {
                          setSortId(opt.id);
                          setOpenFilter(null);
                        }}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <header className="browse-list-head">
            <h1>{pageTitle}</h1>
            <p className="browse-list-count">
              {regionPickMode
                ? t("pickRegion")
                : selectedMaakunta
                  ? t("placesInRegion", {
                      region: selectedMaakunta,
                      count: inViewGyms.length,
                    })
                  : t("placesCount", { count: inViewGyms.length })}
            </p>
          </header>
          </div>

          <div className="browse-list-scroll">
            {regionPickMode ? (
              <p className="browse-region-empty">{t("pickRegion")}</p>
            ) : null}
            <ul className="browse-rows">
              {pageGyms.map((gym) => {
                const chain = chainForGym(gym, chains);
                const offer = resolveGymOffer(gym, chain as Chain | null);
                const distKm =
                  gym.lat != null && gym.lng != null
                    ? distanceKm(origin.lat, origin.lng, gym.lat, gym.lng)
                    : null;
                const priceLabel = formatPriceFrom(offer.priceFrom);
                return (
                  <li key={gym.id}>
                    <Link
                      to={pathGym(lang, gym.slug)}
                      data-gym-id={gym.id}
                      className={[
                        "browse-row",
                        hoveredId === gym.id ? "is-hovered" : "",
                        selectedId === gym.id ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => setHoveredId(gym.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <span
                        className={[
                          "browse-row-media",
                          chain?.image && !chain.image.includes("/pins/")
                            ? chain.logoFit === "contain"
                              ? "is-logo"
                              : ""
                            : "is-pin",
                          chain?.image && !chain.image.includes("/pins/")
                            ? chain.logoClass || ""
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <img
                          src={
                            chain?.image && !chain.image.includes("/pins/")
                              ? chain.image
                              : "/pins/gym-pin.png"
                          }
                          alt=""
                        />
                      </span>
                      <div className="browse-row-text">
                        <div className="browse-row-top">
                          <strong>{cleanGymDisplayName(gym.name)}</strong>
                          {distKm != null ? (
                            <span className="browse-row-distance">
                              {formatDistanceKm(distKm)}
                            </span>
                          ) : null}
                        </div>
                        <span className="browse-row-city">{gym.city}</span>
                        <span className="browse-row-address">
                          {gym.address
                            .replace(
                              new RegExp(`,\\s*${gym.city}\\s*$`, "i"),
                              "",
                            )
                            .trim()}
                        </span>
                        <span className="browse-row-price">
                          {priceLabel ?? t("priceUnknown")}
                        </span>
                        <div className="browse-row-tags">
                          {offer.is247 === true ? (
                            <span className="browse-tag is-247">24/7</span>
                          ) : null}
                          {offer.freeTrial === true ? (
                            <span className="browse-tag is-trial">
                              Ilmainen kokeilu
                            </span>
                          ) : null}
                          {offer.dayPass === true ? (
                            <span className="browse-tag is-daypass">
                              Päivälippu
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {inViewGyms.length > PAGE_SIZE ? (
              <nav className="browse-pager" aria-label="Sivutus">
                <button
                  type="button"
                  className="browse-pager-btn"
                  disabled={safePage <= 1}
                  onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo(0, 0);
                }}
                >
                  <ChevronLeft size={18} strokeWidth={2.2} />
                  <span>Edellinen</span>
                </button>
                <p className="browse-pager-status">
                  Sivu {safePage} / {pageCount}
                </p>
                <button
                  type="button"
                  className="browse-pager-btn"
                  disabled={safePage >= pageCount}
                  onClick={() => {
                  setPage((p) => Math.min(pageCount, p + 1));
                  window.scrollTo(0, 0);
                }}
                >
                  <span>Seuraava</span>
                  <ChevronRight size={18} strokeWidth={2.2} />
                </button>
              </nav>
            ) : null}
          </div>
        </section>

        <section className="browse-map-col">
          <div
            className="browse-map-filters"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="browse-filter">
              <button
                type="button"
                className="browse-filter-btn"
                aria-expanded={openFilter === "chains"}
                aria-haspopup="listbox"
                onClick={() => toggleFilter("chains")}
              >
                <img
                  className="browse-filter-icon"
                  src="/icons/ketjut.png"
                  alt=""
                />
                <span className="browse-filter-label">{chainLabel}</span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "chains" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-chains"
                  role="group"
                  aria-label={t("chains")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-filter-menu-actions">
                    <button
                      type="button"
                      className="browse-filter-menu-action"
                      onClick={() => setSelectedChains([...allChainFilterIds])}
                    >
                      {t("all")}
                    </button>
                    <button
                      type="button"
                      className="browse-filter-menu-action"
                      onClick={() => setSelectedChains([])}
                    >
                      {t("clear")}
                    </button>
                  </div>
                  <ul className="browse-filter-check-list" role="listbox">
                    {localizedChainFilterOptions.map((opt) => {
                      const on = selectedChains.includes(opt.id);
                      return (
                        <li key={opt.id}>
                          <label className="browse-filter-check">
                            <UxSwitch
                              size="sm"
                              checked={on}
                              onChange={() => {
                                setSelectedChains((cur) =>
                                  cur.includes(opt.id)
                                    ? cur.filter((id) => id !== opt.id)
                                    : [...cur, opt.id],
                                );
                              }}
                            />
                            <span className="browse-filter-check-label">
                              {opt.label}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="browse-filter">
              <button
                type="button"
                className={[
                  "browse-filter-btn",
                  priceCap != null ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={openFilter === "price"}
                aria-haspopup="dialog"
                onClick={() => toggleFilter("price")}
              >
                <img className="browse-filter-icon" src="/icons/hinta.png" alt="" />
                <span className="browse-filter-label">
                  {priceCap == null ? "Hinta" : `${priceCap} €`}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "price" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-range"
                  role="dialog"
                  aria-label="Hinta"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-range">
                    <div className="browse-distance-head">
                      <span className="browse-slider-title">
                        <img src="/icons/hinta.png" alt="" />
                        Hinta
                      </span>
                      <strong>
                        {pricePresets[priceLockIndex]?.max == null
                          ? "Max"
                          : `${pricePresets[priceLockIndex].max} €`}
                      </strong>
                    </div>
                    <input
                      className="browse-distance-slider"
                      type="range"
                      min={0}
                      max={pricePresets.length - 1}
                      step="any"
                      value={priceShown}
                      aria-label="Hinta"
                      aria-valuetext={
                        pricePresets[priceLockIndex]?.max == null
                          ? "Max"
                          : `${pricePresets[priceLockIndex].max} euroa`
                      }
                      onPointerDown={() => {
                        priceDragging.current = true;
                      }}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (priceDragging.current) setPriceDrag(v);
                        else lockPrice(v);
                      }}
                      onPointerUp={(e) => {
                        priceDragging.current = false;
                        lockPrice(Number(e.currentTarget.value));
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        const dir = e.key === "ArrowRight" ? 1 : -1;
                        lockPrice(pricePresetIndex + dir);
                      }}
                    />
                    <div className="browse-distance-marks">
                      {pricePresets.map((opt, i) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={
                            i === priceLockIndex
                              ? "browse-distance-mark is-on"
                              : "browse-distance-mark"
                          }
                          onClick={() => lockPrice(i)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="browse-filter">
              <button
                type="button"
                className={[
                  "browse-filter-btn",
                  maxDistanceKm != null ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={openFilter === "distance"}
                aria-haspopup="dialog"
                onClick={() => toggleFilter("distance")}
              >
                <img
                  className="browse-filter-icon"
                  src="/icons/etaisyys.png"
                  alt=""
                />
                <span className="browse-filter-label">
                  {maxDistanceKm == null ? "Etäisyys" : `${maxDistanceKm} km`}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "distance" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-range is-wide"
                  role="dialog"
                  aria-label="Etäisyys"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-range">
                    <div className="browse-distance-head">
                      <span className="browse-slider-title">
                        <img src="/icons/etaisyys.png" alt="" />
                        Max etäisyys
                      </span>
                      <strong>
                        {maxDistanceKm == null ? "Kaikki" : `${maxDistanceKm} km`}
                      </strong>
                    </div>
                    <input
                      className="browse-distance-slider"
                      type="range"
                      min={0}
                      max={distancePresets.length - 1}
                      step={1}
                      value={distancePresetIndex}
                      aria-label="Max etäisyys"
                      aria-valuetext={
                        maxDistanceKm == null
                          ? "Kaikki"
                          : `${maxDistanceKm} kilometriä`
                      }
                      onChange={(e) => {
                        const next =
                          distancePresets[Number(e.target.value)] ??
                          distancePresets[0];
                        setDistanceFilter(next.id);
                      }}
                    />
                    <div className="browse-distance-marks">
                      {distancePresets.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={
                            opt.id === distanceFilter
                              ? "browse-distance-mark is-on"
                              : "browse-distance-mark"
                          }
                          onClick={() => setDistanceFilter(opt.id)}
                        >
                          {opt.id === "all" ? "Kaikki" : `${opt.km}km`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="browse-filters-actions">
              <label
                className={[
                  "browse-filter-btn",
                  "browse-women-pill",
                  womenOnly ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <UxSwitch
                  size="sm"
                  checked={womenOnly}
                  onChange={(on) => setSelectedAudiences(on ? ["women"] : [])}
                />
                <span className="browse-filter-label">{t("audienceWomen")}</span>
                <img
                  className="browse-filter-icon"
                  src="/icons/kenelle-women.png"
                  alt=""
                />
              </label>
              <button
                type="button"
                className={[
                  "browse-filters-more",
                  extrasActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-haspopup="dialog"
                aria-expanded={extrasOpen}
                onClick={() => {
                  setOpenFilter(null);
                  setExtrasOpen(true);
                }}
              >
                <SlidersHorizontal size={16} strokeWidth={2.2} />
                <span>{extrasLabel}</span>
              </button>
              <button
                type="button"
                className="browse-filters-clear"
                onClick={() => {
                  setSelectedChains([...allChainFilterIds]);
                  setSelectedAudiences([]);
                  setDistanceFilter("all");
                  setPriceFilter("max");
                  setPriceDrag(null);
                  setExtraOnly247(false);
                  setExtraFreeTrial(false);
                  setExtraDayPass(false);
                  setOpenFilter(null);
                  setExtrasOpen(false);
                }}
              >
                {t("clear")}
              </button>
            </div>
          </div>

          <div className="browse-map-frame">
            <div
              className="browse-map-side"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="browse-map-address-wrap">
                <label className="browse-map-address browse-glass">
                  <MapPin size={15} strokeWidth={2.3} />
                  <input
                    type="text"
                    placeholder={t("addressPlaceholder")}
                    aria-label={t("addressAria")}
                    value={addressDraft}
                    autoComplete="off"
                    onChange={(e) => {
                      setAddressDraft(e.target.value);
                      setAddressSuggest(true);
                    }}
                    onFocus={() => {
                      if (
                        addressDraft.trim().length >= 2 &&
                        addressDraft.trim() !== locationLabel
                      ) {
                        setAddressSuggest(true);
                      }
                    }}
                    onBlur={() => {
                      setAddressSuggest(false);
                      setAddressDraft(locationLabel);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAddressSuggest(false);
                    }}
                  />
                </label>
                {addressSuggest && addressDraft.trim().length >= 2 &&
                addressDraft.trim() !== locationLabel ? (
                  <ul className="browse-address-hits">
                    {addressLoading && addressHits.length === 0 ? (
                      <li className="browse-address-hint">
                        <LoadSpin size="sm" />
                      </li>
                    ) : null}
                    {!addressLoading && addressHits.length === 0 ? (
                      <li className="browse-address-hint">{t("noResults")}</li>
                    ) : null}
                    {addressHits.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setAddressSuggest(false);
                            setLocation({
                              label: item.label,
                              lat: item.lat,
                              lng: item.lng,
                            });
                          }}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="browse-map-controls">
              <button
                type="button"
                className="browse-map-ctrl browse-glass"
                aria-label={t("mapZoomIn")}
                onClick={() => mapInstanceRef.current?.zoomIn({ duration: 280 })}
              >
                <Plus size={18} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="browse-map-ctrl browse-glass"
                aria-label={t("mapZoomOut")}
                onClick={() =>
                  mapInstanceRef.current?.zoomOut({ duration: 280 })
                }
              >
                <Minus size={18} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="browse-map-ctrl browse-glass"
                aria-label={t("mapGoToLocation")}
                disabled={origin.lat == null || origin.lng == null}
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (!map || origin.lat == null || origin.lng == null) return;
                  map.easeTo({
                    center: [origin.lng, origin.lat],
                    zoom: Math.max(map.getZoom(), 12),
                    duration: 550,
                  });
                }}
              >
                <LocateFixed size={17} strokeWidth={2.4} />
              </button>
            </div>
            <div className="browse-map" aria-label="Kartta" ref={mapRef} />
            <p className="browse-region-hint">
              {selectedMaakunta ?? t("pickRegion")}
            </p>
            {selectedGym ? (
              <div className="browse-map-preview">
                <button
                  type="button"
                  className="browse-map-preview-close"
                  aria-label="Sulje"
                  onClick={() => setSelectedId(null)}
                >
                  <X size={16} strokeWidth={2.2} />
                </button>
                <Link
                  className="browse-map-preview-link"
                  to={pathGym(lang, selectedGym.slug)}
                >
                  <span
                    className={[
                      "browse-map-preview-media",
                      selectedChain?.image &&
                      !selectedChain.image.includes("/pins/")
                        ? selectedChain.logoFit === "contain"
                          ? "is-logo"
                          : ""
                        : "is-pin",
                      selectedChain?.image &&
                      !selectedChain.image.includes("/pins/")
                        ? selectedChain.logoClass || ""
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <img
                      src={
                        selectedChain?.image &&
                        !selectedChain.image.includes("/pins/")
                          ? selectedChain.image
                          : "/pins/gym-pin.png"
                      }
                      alt=""
                    />
                  </span>
                  <span className="browse-map-preview-meta">
                    <strong className="browse-map-preview-name">
                      {selectedGym.name}
                    </strong>
                    {selectedDistanceKm != null ? (
                      <span className="browse-map-preview-distance">
                        {formatDistanceKm(selectedDistanceKm)}
                      </span>
                    ) : null}
                  </span>
                  <span className="browse-map-preview-open">{t("open")}</span>
                </Link>
              </div>
            ) : null}
          </div>
        </section>

      </div>

      {extrasOpen ? (
        <div
          className="browse-extras-root"
          role="presentation"
          onClick={() => setExtrasOpen(false)}
        >
          <div
            className="browse-extras-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("filters")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="browse-extras-head">
              <h2 className="browse-extras-title">{t("filters")}</h2>
              <p className="browse-extras-text">
                Valitse lisäehdot. Voit ottaa useita päälle yhtä aikaa.
              </p>
            </div>

            <div className="browse-extras-options">
              <label className="browse-extras-row">
                <span>
                  <strong>24/7</strong>
                  <span className="browse-extras-desc">
                    Avoinna ympäri vuorokauden.
                  </span>
                </span>
                <UxSwitch
                  checked={extraOnly247}
                  onChange={setExtraOnly247}
                />
              </label>
              <label className="browse-extras-row">
                <span>
                  <strong>Ilmainen kokeilu</strong>
                  <span className="browse-extras-desc">
                    Ketju tai sali tarjoaa kokeilujakson.
                  </span>
                </span>
                <UxSwitch
                  checked={extraFreeTrial}
                  onChange={setExtraFreeTrial}
                />
              </label>
              <label className="browse-extras-row">
                <span>
                  <strong>Päivälippu</strong>
                  <span className="browse-extras-desc">
                    Kertakäynti tai päivälippu saatavilla.
                  </span>
                </span>
                <UxSwitch
                  checked={extraDayPass}
                  onChange={setExtraDayPass}
                />
              </label>
            </div>

            <div className="browse-extras-footer">
              <button
                type="button"
                className="browse-extras-btn browse-extras-btn-ghost"
                onClick={() => {
                  setExtraOnly247(false);
                  setExtraFreeTrial(false);
                  setExtraDayPass(false);
                }}
              >
                {t("clear")}
              </button>
              <button
                type="button"
                className="browse-extras-btn"
                onClick={() => setExtrasOpen(false)}
              >
                Valmis
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
    </>
  );
}

export default GymsPage;
