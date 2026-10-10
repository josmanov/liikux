import "./GymsPage.css";
import "../components/ChainPopup.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Euro,
  Heart,
  Link2,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Route,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { LngLatBounds, Map, Marker, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import { useAddressSuggest } from "../data/geocode";
import { useLockPageScroll } from "../hooks/useLockPageScroll";
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
  formatPricePill,
} from "../data/format";
import { useAppLocation } from "../context/LocationContext";
import {
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  buildBrowseSearch,
  parseBrowseSearch,
  sameIds,
} from "../data/browseSearch";
import { toggleFavoriteSlug, readFavoriteSlugs } from "../data/favorites";
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

function zoomWhereClusterSplits(map: Map, group: Gym[]) {
  const z0 = map.getZoom();
  const maxZoom = Math.min(map.getMaxZoom(), z0 + 5.5);
  const pts = group.map((g) => map.project([g.lng, g.lat]));
  let minD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < minD) minD = d;
    }
  }
  if (!Number.isFinite(minD) || minD < 0.5) {
    return Math.min(z0 + 2.4, maxZoom);
  }

  let lo = z0;
  let hi = maxZoom;
  for (let n = 0; n < 16; n++) {
    const mid = (lo + hi) / 2;
    const spread = minD * 2 ** (mid - z0);
    const need = pinTouchPx(markerScaleForZoom(mid)) + 16;
    if (spread > need) hi = mid;
    else lo = mid;
  }
  return Math.min(hi + 0.2, maxZoom);
}

function frameOriginAndGym(
  map: Map,
  originLng: number,
  originLat: number,
  gymLng: number,
  gymLat: number,
) {
  const bounds = new LngLatBounds();
  bounds.extend([originLng, originLat]);
  bounds.extend([gymLng, gymLat]);
  const cam = map.cameraForBounds(bounds, {
    padding: { top: 110, bottom: 150, left: 96, right: 96 },
  });
  const now = map.getZoom();
  let zoom = cam?.zoom ?? FRAME_ZOOM;
  if (!Number.isFinite(zoom) || zoom > FRAME_ZOOM) zoom = FRAME_ZOOM;
  if (zoom > now && now >= FRAME_ZOOM - 0.05) zoom = now;
  map.easeTo({
    center: cam?.center ?? [(originLng + gymLng) / 2, (originLat + gymLat) / 2],
    zoom,
    duration: 700,
    easing: (t) => 1 - (1 - t) ** 3,
  });
}

function gymsNearViewport(gyms: Gym[], map: Map) {
  const b = map.getBounds();
  const padX = (b.getEast() - b.getWest()) * 0.4;
  const padY = (b.getNorth() - b.getSouth()) * 0.4;
  const west = b.getWest() - padX;
  const east = b.getEast() + padX;
  const south = b.getSouth() - padY;
  const north = b.getNorth() + padY;
  return gyms.filter(
    (g) =>
      g.lng != null &&
      g.lat != null &&
      g.lng >= west &&
      g.lng <= east &&
      g.lat >= south &&
      g.lat <= north,
  );
}

function clusterMarkerKey(group: Gym[]) {
  return "c:" + group.map((g) => g.id).sort().join("|");
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
const ORIGIN_ZOOM = 12;
const FRAME_ZOOM = 12.6;
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

const distancePresetMeta = [
  { id: "1", km: 1 },
  { id: "3", km: 3 },
  { id: "5", km: 5 },
  { id: "10", km: 10 },
  { id: "20", km: 20 },
  { id: "50", km: 50 },
  { id: "all", km: null as number | null },
];

function DualRange({
  lo,
  hi,
  onLo,
  onHi,
  minLabel,
  maxLabel,
}: {
  lo: number;
  hi: number;
  onLo: (n: number) => void;
  onHi: (n: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  const span = PRICE_MAX - PRICE_MIN || 1;
  const left = ((lo - PRICE_MIN) / span) * 100;
  const right = ((hi - PRICE_MIN) / span) * 100;
  return (
    <div className="browse-dual">
      <div className="browse-dual-rail">
        <div
          className="browse-dual-fill"
          style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
        />
      </div>
      <input
        type="range"
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={lo}
        aria-label={minLabel}
        className="browse-dual-input is-lo"
        onChange={(e) => onLo(Math.min(Number(e.target.value), hi))}
      />
      <input
        type="range"
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={hi}
        aria-label={maxLabel}
        className="browse-dual-input is-hi"
        onChange={(e) => onHi(Math.max(Number(e.target.value), lo))}
      />
    </div>
  );
}

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

type FilterKey = "sort" | "price" | "distance";

function filterChainVisual(id: string, list: Chain[]) {
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

const PAGE_SIZE_START = 8;

function pageNums(current: number, count: number): Array<number | "gap"> {
  if (count <= 6) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  if (current <= 4) return [1, 2, 3, 4, "gap", count];
  if (current >= count - 3) {
    return [1, "gap", count - 3, count - 2, count - 1, count];
  }
  return [1, "gap", current - 1, current, current + 1, "gap", count];
}

function GymsPage() {
  const { slug: chainSlug } = useParams();
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const browseStart = parseBrowseSearch(
    routeLocation.search,
    allChainFilterIds,
  );
  const { lang, t } = useLang();
  const sortOptions = [
    { id: "nearest", label: t("sortNearest") },
    { id: "price-asc", label: t("sortCheap") },
    { id: "price-desc", label: t("sortExpensive") },
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
    useMyLocation,
  } = useAppLocation();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
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
  const [dataReady, setDataReady] = useState(false);
  const [maakunnatReady, setMaakunnatReady] = useState(false);
  const [selectedMaakunta, setSelectedMaakunta] = useState<string | null>(null);
  const [regionNames, setRegionNames] = useState<string[]>([]);
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
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
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_START);
  const pageSizeRef = useRef(PAGE_SIZE_START);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const originMarkerRef = useRef<Marker | null>(null);
  const selectFromMapRef = useRef(false);
  const skipBoundsResetRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const favoriteSlugsRef = useRef(favoriteSlugs);
  const visibleGymsRef = useRef<Gym[]>([]);
  const inViewGymsRef = useRef<Gym[]>([]);
  const chainsByIdRef = useRef(new globalThis.Map<string, Chain>());
  const regionPickModeRef = useRef(true);
  const selectedMaakuntaRef = useRef<string | null>(null);
  const maakuntaFeaturesRef = useRef<
    { nimi: string; maakunta: string; geometry: MaakuntaGeom }[]
  >([]);
  const fitKeyRef = useRef("");
  const regionDropRef = useRef<HTMLDivElement>(null);
  const prevFilterKeyRef = useRef<string | null>(null);
  const originRef = useRef({ lat: 60.1699, lng: 24.9384 });
  const focusOriginRef = useRef(
    (routeLocation.state as { focusOrigin?: boolean } | null)?.focusOrigin ===
      true,
  );

  const regionPickMode = selectedMaakunta == null;

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
    const box = listScrollRef.current;
    if (!box) return;

    function fitRows() {
      const list = box.querySelector<HTMLElement>(".browse-rows");
      if (!list) return;
      const raw = getComputedStyle(list).getPropertyValue("--row-min").trim();
      const rowMin = Number.parseFloat(raw) || 96;
      const rows = Math.max(4, Math.floor(box.clientHeight / rowMin));
      const gymRows = Math.max(3, rows - 1);
      list.style.setProperty("--browse-row-count", String(gymRows));
      box.style.setProperty("--browse-row-count", String(rows));
      const next = Math.max(2, gymRows * 2);
      setPageSize((cur) => (cur === next ? cur : next));
    }

    fitRows();
    const watch = new ResizeObserver(fitRows);
    watch.observe(box);
    return () => watch.disconnect();
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
  const chainFilterActive = selectedChains.length < allChainFilterIds.length;
  const pageTitle =
    selectedChains.length === 1
      ? (localizedChainFilterOptions.find((o) => o.id === selectedChains[0])
          ?.label ?? t("gymsTitle"))
      : t("gymsTitle");
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
    const key = Object.keys(cityCenters).find(
      (city) => locationLabel.toLowerCase() === city.toLowerCase(),
    );
    return cityCenters[key ?? "Helsinki"];
  }, [locationLabel, locationLat, locationLng]);
  originRef.current = origin;

  const extrasActive = extraOnly247 || extraFreeTrial || extraDayPass;
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
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [regionMenuOpen]);

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

  pageSizeRef.current = pageSize;

  const pageCount = Math.max(1, Math.ceil(inViewGyms.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const pageGyms = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return inViewGyms.slice(start, start + pageSize);
  }, [inViewGyms, safePage, pageSize]);
  const listLoading =
    !dataReady ||
    !mapReady ||
    (!regionPickMode && gyms.length > 0 && inViewGyms.length === 0 && !mapBounds);
  const showMissing =
    !listLoading &&
    !regionPickMode &&
    pageGyms.length < pageSize &&
    (inViewGyms.length > 0 || gyms.length === 0);

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

  const selectedPriceText = (() => {
    if (!selectedGym) return null;
    const pill = formatPricePill(
      resolveGymOffer(selectedGym, selectedChain).priceFrom,
      lang,
    );
    if (!pill) return t("priceUnknown");
    return pill.replace("€/kk", " €/kk").replace("€/mo", " €/mo");
  })();

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
    if (skipBoundsResetRef.current) {
      skipBoundsResetRef.current = false;
      return;
    }
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

  useLockPageScroll(extrasOpen || chainsOpen);

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

  useEffect(() => {
    if (!mapRef.current) return;

    const start = originRef.current;
    const map = new Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [start.lng, start.lat],
      zoom: ORIGIN_ZOOM,
      maxBounds: MAP_MAX_BOUNDS,
    });

    mapInstanceRef.current = map;

    function onResize() {
      applyFinlandMinZoom(map);
    }

    function onMaxOutView() {
      centerFinlandIfMaxOut(map);
    }

    let dead = false;
    let revealed = false;

    function settleStartView() {
      if (dead || revealed) return;
      const o = originRef.current;
      map.jumpTo({
        center: [o.lng, o.lat],
        zoom: ORIGIN_ZOOM,
      });
      applyFinlandMinZoom(map);
      if (map.getZoom() < map.getMinZoom()) {
        map.setZoom(map.getMinZoom());
      }

      let nimi: string | null = null;
      for (const f of maakuntaFeaturesRef.current) {
        if (pointInPolygon(o.lng, o.lat, f.geometry)) {
          nimi = f.nimi;
          break;
        }
      }
      selectedMaakuntaRef.current = nimi;
      regionPickModeRef.current = nimi == null;
      setSelectedMaakunta(nimi);
      fitKeyRef.current = `origin:${o.lat}:${o.lng}`;

      if (nimi) {
        const hideOpen = ["!=", ["get", "nimi"], nimi] as [
          "!=",
          ["get", string],
          string,
        ];
        for (const id of ["maakunnat-fill", "maakunnat-line", "maakunnat-label"]) {
          if (map.getLayer(id)) map.setFilter(id, hideOpen);
        }
      }

      function reveal() {
        if (dead || revealed) return;
        revealed = true;
        window.clearTimeout(failSafe);
        map.resize();
        setMapReady(true);
      }

      const failSafe = window.setTimeout(reveal, 700);
      map.once("idle", reveal);
      if (map.areTilesLoaded()) {
        window.setTimeout(reveal, 40);
      }
    }

    map.on("load", () => {
      map.resize();
      applyFinlandMinZoom(map);
      const o = originRef.current;
      map.jumpTo({
        center: [o.lng, o.lat],
        zoom: ORIGIN_ZOOM,
      });

      void (async () => {
        try {
          const maskRes = await fetch("/geo/finland-mask.json");
          const outlineRes = await fetch("/geo/finland.json");
          const maakuntaRes = await fetch("/geo/maakunnat.json");
          if (!maskRes.ok || !outlineRes.ok) {
            settleStartView();
            return;
          }
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
            setRegionNames(
              maakuntaFeaturesRef.current
                .map((f) => f.nimi)
                .sort((a, b) => a.localeCompare(b, "fi")),
            );
          }
        } catch {
          /* peite ei kaada karttaa */
        }
        settleStartView();
      })();
    });

    map.on("zoomend", onMaxOutView);
    map.on("moveend", onMaxOutView);
    window.addEventListener("resize", onResize);

    return () => {
      dead = true;
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

    function putPin(g: Gym, scale: number) {
      const old = markersRef.current.get(g.id);
      if (old) {
        old.getElement().style.setProperty("--pin-scale", String(scale));
        return;
      }

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
      el.dataset.gymSlug = g.slug;
      if (favoriteSlugsRef.current.includes(g.slug)) el.classList.add("is-fav");
      el.style.setProperty("--pin-scale", String(scale));
      if (g.id === selectedIdRef.current) {
        el.classList.add("is-front");
        el.style.zIndex = "8";
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

      const fav = document.createElement("span");
      fav.className = "gym-pin-fav";
      fav.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2C5 8 6.8 6.2 9.1 6.2c1.3 0 2.3.6 2.9 1.6.6-1 1.6-1.6 2.9-1.6 2.3 0 4.1 1.8 4.1 4.6C19 15.6 12 20 12 20z"/></svg>';
      hit.appendChild(fav);

      if (g.priceFrom != null) {
        const priceText = formatPricePill(g.priceFrom, lang);
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
      hit.addEventListener("click", (e) => {
        e.stopPropagation();
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
          setPage(Math.floor(idx / pageSizeRef.current) + 1);
        }
        selectFromMapRef.current = true;
        setSelectedId(g.id);
        const here = originRef.current;
        if (g.lat != null && g.lng != null) {
          frameOriginAndGym(map, here.lng, here.lat, g.lng, g.lat);
        }
      });

      const marker = new Marker({ element: el })
        .setLngLat([g.lng, g.lat])
        .addTo(map);
      markersRef.current.set(g.id, marker);
    }

    function putCluster(group: Gym[], scale: number) {
      const key = clusterMarkerKey(group);
      const old = markersRef.current.get(key);
      if (old) {
        old.getElement().style.setProperty("--pin-scale", String(scale));
        return key;
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
      const img = document.createElement("img");
      img.src = "/pins/cluster-kettlebell.png";
      img.alt = "";
      const count = document.createElement("span");
      count.className =
        group.length > 9 ? "gym-cluster-count is-long" : "gym-cluster-count";
      count.textContent = String(group.length);
      el.append(img, count);
      el.setAttribute(
        "aria-label",
        t("gymsCount", { count: group.length }),
      );
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const zoom = zoomWhereClusterSplits(map, group);
        const delta = Math.max(0, zoom - map.getZoom());
        map.easeTo({
          center: [lng, lat],
          zoom,
          duration: Math.min(520, Math.max(280, 240 + delta * 80)),
          easing: (t) => 1 - (1 - t) ** 3,
        });
      });

      const marker = new Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.set(key, marker);
      return key;
    }

    function syncPins() {
      if (regionPickModeRef.current) {
        clearMarkers();
        return;
      }

      const gyms = gymsNearViewport(visibleGymsRef.current, map);
      if (gyms.length === 0) {
        clearMarkers();
        return;
      }

      const zoom = map.getZoom();
      const scale = markerScaleForZoom(zoom);
      const touchPx = pinTouchPx(scale);
      const pickedId = selectedIdRef.current;
      const picked = pickedId
        ? gyms.find((g) => g.id === pickedId)
        : undefined;
      const pool = picked ? gyms.filter((g) => g.id !== picked.id) : gyms;
      const groups = clusterGymsByScreenTouch(pool, map, touchPx);
      const keep = new Set<string>();

      if (picked) {
        putPin(picked, scale);
        keep.add(picked.id);
      }

      groups.forEach((group) => {
        if (group.length === 1) {
          putPin(group[0], scale);
          keep.add(group[0].id);
          return;
        }
        keep.add(putCluster(group, scale));
      });

      const stale: string[] = [];
      markersRef.current.forEach((_marker, id) => {
        if (!keep.has(id)) stale.push(id);
      });
      stale.forEach((id) => {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      });
    }

    function syncOriginPin() {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      if (origin.lat == null || origin.lng == null) return;
      const el = document.createElement("div");
      el.className = "gym-origin-pin";
      el.setAttribute("aria-label", t("fromAddressAria"));
      if (locationLabel.trim()) {
        const label = document.createElement("span");
        label.className = "gym-origin-pin-label";
        label.textContent = locationLabel;
        el.appendChild(label);
      }
      const ring = document.createElement("span");
      ring.className = "gym-origin-pin-ring";
      const ringLate = document.createElement("span");
      ringLate.className = "gym-origin-pin-ring is-late";
      const core = document.createElement("span");
      core.className = "gym-origin-pin-core";
      el.appendChild(ring);
      el.appendChild(ringLate);
      el.appendChild(core);
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

    let pinRaf = 0;

    function onMapMove() {
      if (regionPickModeRef.current) return;
      if (pinRaf !== 0) return;
      pinRaf = requestAnimationFrame(() => {
        pinRaf = 0;
        syncPins();
      });
    }

    function onMoveEnd() {
      if (pinRaf !== 0) {
        cancelAnimationFrame(pinRaf);
        pinRaf = 0;
      }
      syncPins();
      pushBounds();
      const picked = selectedIdRef.current;
      if (!picked) return;
      const g = visibleGymsRef.current.find((x) => x.id === picked);
      if (!g || g.lat == null || g.lng == null) return;
      const b = map.getBounds();
      const onScreen =
        g.lng >= b.getWest() &&
        g.lng <= b.getEast() &&
        g.lat >= b.getSouth() &&
        g.lat <= b.getNorth();
      if (!onScreen) setSelectedId(null);
    }

    let dragged = false;
    function onDragStart() {
      dragged = true;
    }
    function onDragEnd() {
      window.setTimeout(() => {
        dragged = false;
      }, 0);
    }
    function onMapClick(e: MapLayerMouseEvent) {
      if (dragged) return;
      const target = e.originalEvent.target;
      if (
        target instanceof Element &&
        target.closest(".gym-pin, .gym-cluster")
      ) {
        return;
      }
      setSelectedId(null);
    }

    syncPins();
    syncOriginPin();
    setMapBounds(readBounds());
    map.resize();

    map.on("move", onMapMove);
    map.on("moveend", onMoveEnd);
    map.on("dragstart", onDragStart);
    map.on("dragend", onDragEnd);
    map.on("click", onMapClick);

    return () => {
      if (pinRaf !== 0) cancelAnimationFrame(pinRaf);
      map.off("move", onMapMove);
      map.off("moveend", onMoveEnd);
      map.off("dragstart", onDragStart);
      map.off("dragend", onDragEnd);
      map.off("click", onMapClick);
      clearMarkers();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    };
  }, [
    visibleGyms,
    mapReady,
    origin.lat,
    origin.lng,
    locationLabel,
    selectedMaakunta,
    chains,
    lang,
    t,
  ]);

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
      focusOriginRef.current || key !== fitKeyRef.current;
    if (!shouldZoom) return;

    fitKeyRef.current = key;
    focusOriginRef.current = false;

    map.easeTo({
      center: [origin.lng, origin.lat],
      zoom: ORIGIN_ZOOM,
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

  useEffect(() => {
    const favs = new Set(favoriteSlugs);
    markersRef.current.forEach((marker) => {
      const el = marker.getElement();
      const slug = el.dataset.gymSlug;
      el.classList.toggle("is-fav", !!slug && favs.has(slug));
    });
  }, [favoriteSlugs]);

  const browseReady = dataReady && mapReady;

  function focusGymFromList(gym: Gym) {
    const map = mapInstanceRef.current;
    if (!map || gym.lat == null || gym.lng == null) return;
    selectFromMapRef.current = false;
    skipBoundsResetRef.current = true;
    setSelectedId(gym.id);
    map.easeTo({
      center: [gym.lng, gym.lat],
      zoom: Math.max(map.getZoom(), 15.2),
      duration: 700,
    });
  }

  function focusRegion(nimi: string) {
    const map = mapInstanceRef.current;
    const full = maakuntaFeaturesRef.current.find((x) => x.nimi === nimi);
    setRegionMenuOpen(false);
    if (!map || !full) return;
    selectedMaakuntaRef.current = nimi;
    regionPickModeRef.current = false;
    setSelectedMaakunta(nimi);
    map.fitBounds(geomBBox(full.geometry), {
      padding: { top: 72, bottom: 72, left: 72, right: 72 },
      duration: 750,
      maxZoom: 9.5,
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
        (selectedId ? " is-pin-selected" : "")
      }
    >
      <div
        className="browse-toolbar"
        ref={listChromeRef}
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
            <span className="browse-toolbar-sep" aria-hidden="true" />
            <div className="browse-filter">
              <button
                type="button"
                className={[
                  "browse-filter-btn",
                  chainFilterActive ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-haspopup="dialog"
                onClick={() => {
                  setOpenFilter(null);
                  setExtrasOpen(false);
                  setChainsOpen(true);
                }}
              >
                <Link2 className="browse-filter-icon" size={18} strokeWidth={2.2} />
                <span className="browse-filter-label">{t("chains")}</span>
                <span className="browse-filter-info">
                  {chainFilterActive ? `· ${selectedChains.length}` : ""}
                </span>
              </button>
            </div>

            <div className="browse-filter">
              <button
                type="button"
                className={[
                  "browse-filter-btn",
                  priceFilterOn ? "is-on" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={openFilter === "price"}
                aria-haspopup="dialog"
                onClick={() => toggleFilter("price")}
              >
                <Euro className="browse-filter-icon" size={18} strokeWidth={2.2} />
                <span className="browse-filter-label">{t("price")}</span>
                <span className="browse-filter-info">{priceInfo}</span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "price" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-range"
                  role="dialog"
                  aria-label={t("price")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-range">
                    <div className="browse-distance-head">
                      <span className="browse-slider-title">
                        <Euro size={16} strokeWidth={2.2} />
                        {t("price")}
                      </span>
                      <strong>
                        {priceMin} – {priceMax} €
                      </strong>
                    </div>
                    <DualRange
                      lo={priceMin}
                      hi={priceMax}
                      onLo={setPriceMin}
                      onHi={setPriceMax}
                      minLabel={t("priceMinAria")}
                      maxLabel={t("priceMaxAria")}
                    />
                    <div className="browse-dual-ends">
                      <span>{PRICE_MIN} €</span>
                      <span>{PRICE_MAX} €</span>
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
                <Route className="browse-filter-icon" size={18} strokeWidth={2.2} />
                <span className="browse-filter-label">{t("distance")}</span>
                <span className="browse-filter-info">
                  {maxDistanceKm != null ? `· ${maxDistanceKm} km` : ""}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "distance" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-range is-wide"
                  role="dialog"
                  aria-label={t("distance")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-range">
                    <div className="browse-distance-head">
                      <span className="browse-slider-title">
                        <Route size={16} strokeWidth={2.2} />
                        {t("distanceMax")}
                      </span>
                      <strong>
                        {maxDistanceKm == null
                          ? t("distanceAll")
                          : `${maxDistanceKm} km`}
                      </strong>
                    </div>
                    <div className="browse-dual">
                      <div className="browse-dual-rail">
                        <div
                          className="browse-dual-fill"
                          style={{
                            left: "0%",
                            width: `${
                              (distancePresetIndex /
                                Math.max(1, distancePresets.length - 1)) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <input
                        className="browse-dual-input is-hi"
                        type="range"
                        min={0}
                        max={distancePresets.length - 1}
                        step={1}
                        value={distancePresetIndex}
                        aria-label={t("distanceMax")}
                        aria-valuetext={
                          maxDistanceKm == null
                            ? t("distanceAll")
                            : t("distanceKm", { km: maxDistanceKm })
                        }
                        onChange={(e) => {
                          const next =
                            distancePresets[Number(e.target.value)] ??
                            distancePresets[0];
                          setDistanceFilter(next.id);
                        }}
                      />
                    </div>
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
                          {opt.label}
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
                <img
                  className="browse-filter-icon"
                  src="/icons/kenelle-women.png"
                  alt=""
                />
                <span className="browse-filter-label">{t("audienceWomen")}</span>
                <UxSwitch
                  size="sm"
                  checked={womenOnly}
                  onChange={(on) => setSelectedAudiences(on ? ["women"] : [])}
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
                  setPriceMin(PRICE_MIN);
                  setPriceMax(PRICE_MAX);
                  setExtraOnly247(false);
                  setExtraFreeTrial(false);
                  setExtraDayPass(false);
                  setOpenFilter(null);
                  setExtrasOpen(false);
                }}
              >
                {t("clearFiltersBtn")}
              </button>
            </div>
      </div>
      <div className="browse-body">
        <section className="browse-list-frame">
          <header className="browse-list-head">
            <div className="browse-list-head-side">
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
            </div>
            <div className="browse-sort">
              <button
                type="button"
                className="browse-sort-btn"
                aria-expanded={openFilter === "sort"}
                aria-haspopup="listbox"
                onClick={() => toggleFilter("sort")}
              >
                <ArrowUpDown size={16} strokeWidth={2.2} />
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
          </header>
          <div className="browse-list-scroll" ref={listScrollRef}>
            {regionPickMode ? (
              <p className="browse-region-empty">{t("pickRegion")}</p>
            ) : null}
            {!listLoading &&
            !regionPickMode &&
            inViewGyms.length === 0 &&
            gyms.length > 0 ? (
              <p className="browse-region-empty">
                {visibleGyms.length === 0
                  ? t("noGymsFilters")
                  : t("noGymsInView")}
              </p>
            ) : null}
            <ul className={browseReady ? "browse-rows list-pop" : "browse-rows"}>
              {pageGyms.map((gym, i) => {
                const chain = chainForGym(gym, chains);
                const offer = resolveGymOffer(gym, chain as Chain | null);
                const distKm =
                  gym.lat != null && gym.lng != null
                    ? distanceKm(origin.lat, origin.lng, gym.lat, gym.lng)
                    : null;
                const pricePill = formatPricePill(offer.priceFrom, lang);
                const priceLabel = pricePill
                  ? pricePill
                      .replace("€/kk", " €/kk")
                      .replace("€/mo", " €/mo")
                  : null;
                const isFav = favoriteSlugs.includes(gym.slug);
                return (
                  <li
                    key={gym.id}
                    style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                  >
                    <div
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
                      <Link
                        to={pathGym(lang, gym.slug)}
                        className="browse-row-main"
                        onClick={(e) => {
                          if (gym.lat == null || gym.lng == null) return;
                          if (selectedId === gym.id) return;
                          e.preventDefault();
                          focusGymFromList(gym);
                        }}
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
                          <strong>{cleanGymDisplayName(gym.name)}</strong>
                          <span className="browse-row-address">
                            {gym.address
                              .replace(
                                new RegExp(
                                  `,?\\s*\\d{5}\\s+${gym.city}\\s*$`,
                                  "i",
                                ),
                                "",
                              )
                              .replace(
                                new RegExp(`,\\s*${gym.city}\\s*$`, "i"),
                                "",
                              )
                              .trim()}
                          </span>
                          <div className="browse-row-tags">
                            {offer.is247 === true ? (
                              <span className="browse-tag is-247">24/7</span>
                            ) : null}
                            {offer.freeTrial === true ? (
                              <span className="browse-tag is-trial">
                                {t("freeTrial")}
                              </span>
                            ) : null}
                            {offer.dayPass === true ? (
                              <span className="browse-tag is-daypass">
                                {t("priceDayPass")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="browse-row-side">
                          <span className="browse-row-price">
                            {priceLabel ?? t("priceUnknown")}
                          </span>
                          {distKm != null ? (
                            <span className="browse-row-distance">
                              {formatDistanceKm(distKm)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className={
                          isFav ? "browse-row-fav is-on" : "browse-row-fav"
                        }
                        aria-label={
                          isFav ? t("removeFavorite") : t("addFavorite")
                        }
                        aria-pressed={isFav}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFavoriteSlugs(toggleFavoriteSlug(gym.slug));
                        }}
                      >
                        <Heart size={18} strokeWidth={2.2} />
                      </button>
                    </div>
                  </li>
                );
              })}
              {showMissing ? (
                <li className="browse-missing-slot">
                  <p className="browse-missing">
                    {t("missingGym")}
                    <span>{t("missingGymHint")}</span>
                  </p>
                </li>
              ) : null}
            </ul>
            {listLoading ? (
              <div className="browse-list-loading">
                <LoadSpin />
              </div>
            ) : regionPickMode ? null : (
              <div className="browse-pagebar">
                <button
                  type="button"
                  className="browse-pager-btn"
                  aria-label={t("previous")}
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} strokeWidth={2.2} />
                </button>
                <div className="browse-pages">
                  {pageNums(safePage, pageCount).map((item, i) =>
                    item === "gap" ? (
                      <span className="browse-page-gap" key={`gap-${i}`}>
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={
                          item === safePage
                            ? "browse-page-num is-on"
                            : "browse-page-num"
                        }
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="browse-pager-btn"
                  aria-label={t("next")}
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  <ChevronRight size={16} strokeWidth={2.2} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section
          className={
            "browse-map-col"
          }
        >
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
                        addressDraft.trim().length >= 3 &&
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
                  <button
                    type="button"
                    className="browse-map-locate"
                    aria-label={t("useMyLocation")}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void useMyLocation();
                    }}
                  >
                    <LocateFixed size={15} strokeWidth={2.4} />
                  </button>
                </label>
                <div
                  ref={regionDropRef}
                  className={[
                    "browse-region-drop",
                    regionMenuOpen ? "is-open" : "",
                    selectedId ? "is-away" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden={selectedId ? true : undefined}
                >
                  <button
                    type="button"
                    className="browse-region-drop-btn browse-glass"
                    aria-expanded={regionMenuOpen}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setRegionMenuOpen((v) => !v)}
                  >
                    <span>{selectedMaakunta ?? t("regions")}</span>
                    <ChevronDown size={16} strokeWidth={2.2} />
                  </button>
                  <ul className="browse-region-drop-list">
                    {regionNames.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          className={name === selectedMaakunta ? "is-on" : ""}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => focusRegion(name)}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {addressSuggest && addressDraft.trim().length >= 3 &&
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
            <div className="browse-map" aria-label={t("map")} ref={mapRef} />
            <p className="browse-region-hint">
              {selectedMaakunta ?? t("pickRegion")}
            </p>
            {selectedGym ? (
              <div className="browse-map-preview">
                <button
                  type="button"
                  className="browse-map-preview-close"
                  aria-label={t("close")}
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
                        {selectedPriceText ? (
                          <span className="browse-map-preview-price">
                            {selectedPriceText}
                          </span>
                        ) : null}
                      </span>
                    ) : selectedPriceText ? (
                      <span className="browse-map-preview-price">
                        {selectedPriceText}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <button
                  type="button"
                  className={
                    favoriteSlugs.includes(selectedGym.slug)
                      ? "browse-row-fav is-on"
                      : "browse-row-fav"
                  }
                  aria-label={
                    favoriteSlugs.includes(selectedGym.slug)
                      ? t("removeFavorite")
                      : t("addFavorite")
                  }
                  aria-pressed={favoriteSlugs.includes(selectedGym.slug)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFavoriteSlugs(toggleFavoriteSlug(selectedGym.slug));
                  }}
                >
                  <Heart size={18} strokeWidth={2.2} />
                </button>
                {selectedGym.lat != null && selectedGym.lng != null ? (
                  <a
                    className="browse-map-preview-maps"
                    href={
                      "https://www.google.com/maps/dir/?api=1&origin=" +
                      origin.lat +
                      "," +
                      origin.lng +
                      "&destination=" +
                      selectedGym.lat +
                      "," +
                      selectedGym.lng
                    }
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("mapsRoute")}
                  >
                    <img
                      className="is-line"
                      src="/pins/google-maps-outline.png"
                      alt=""
                    />
                    <img
                      className="is-fill"
                      src="/pins/google-maps-pin.png"
                      alt=""
                    />
                  </a>
                ) : null}
                <Link
                  className="browse-map-preview-open"
                  to={pathGym(lang, selectedGym.slug)}
                >
                  {t("open")}
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
              <p className="browse-extras-text">{t("extrasHint")}</p>
            </div>

            <div className="browse-extras-options">
              <label className="browse-extras-row">
                <span>
                  <strong>{t("open247")}</strong>
                  <span className="browse-extras-desc">
                    {t("open247Desc")}
                  </span>
                </span>
                <UxSwitch
                  checked={extraOnly247}
                  onChange={setExtraOnly247}
                />
              </label>
              <label className="browse-extras-row">
                <span>
                  <strong>{t("freeTrial")}</strong>
                  <span className="browse-extras-desc">
                    {t("freeTrialDesc")}
                  </span>
                </span>
                <UxSwitch
                  checked={extraFreeTrial}
                  onChange={setExtraFreeTrial}
                />
              </label>
              <label className="browse-extras-row">
                <span>
                  <strong>{t("priceDayPass")}</strong>
                  <span className="browse-extras-desc">
                    {t("dayPassDesc")}
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
                {t("done")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {chainsOpen
        ? createPortal(
            <div
              className="chain-popup-overlay"
              onClick={() => setChainsOpen(false)}
            >
              <div
                className="chain-popup-card browse-chains-card"
                role="dialog"
                aria-modal="true"
                aria-label={t("chains")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="chain-popup-banner">
                  <div className="chain-popup-banner-row">
                    <h2 className="chain-popup-title">{t("chains")}</h2>
                    <button
                      type="button"
                      className="chain-popup-close"
                      onClick={() => setChainsOpen(false)}
                      aria-label={t("close")}
                    >
                      <X size={20} strokeWidth={2.4} />
                    </button>
                  </div>
                  <div className="browse-chains-top">
                    <div className="group">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="search-icon"
                      >
                        <g>
                          <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
                        </g>
                      </svg>
                      <input
                        className="input"
                        type="search"
                        placeholder={t("chainSearch")}
                        value={chainQuery}
                        onChange={(e) => setChainQuery(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="browse-chains-action"
                      onClick={() => setSelectedChains([...allChainFilterIds])}
                    >
                      {t("all")}
                    </button>
                    <button
                      type="button"
                      className="browse-chains-clear"
                      onClick={() => setSelectedChains([])}
                    >
                      {t("clear")}
                    </button>
                  </div>
                  <p className="browse-chains-picked">
                    {t("chainsPicked", {
                      n: selectedChains.length,
                      total: allChainFilterIds.length,
                    })}
                  </p>
                </div>
                <div className="chain-popup-scroll">
                  <ul
                    className="chain-popup-list list-pop"
                    onScroll={(e) => {
                      e.currentTarget.parentElement?.classList.toggle(
                        "is-scrolled",
                        e.currentTarget.scrollTop > 6,
                      );
                    }}
                  >
                    {localizedChainFilterOptions
                      .filter((opt) => {
                        const q = chainQuery.trim().toLowerCase();
                        if (!q) return true;
                        return opt.label.toLowerCase().includes(q);
                      })
                      .map((opt, i) => {
                      const on = selectedChains.includes(opt.id);
                      const visual = filterChainVisual(opt.id, chains);
                      return (
                        <li
                          key={opt.id}
                          style={{
                            animationDelay: `${Math.min(i, 18) * 28}ms`,
                          }}
                        >
                          <label className="browse-chains-row">
                            <span
                              className={[
                                "chain-popup-media",
                                visual.logo ? "is-logo" : "",
                                visual.logoClass,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <img src={visual.image} alt="" />
                            </span>
                            <span className="browse-chains-main">
                              <span className="browse-chains-name">
                                {opt.label}
                              </span>
                              <span className="browse-chains-hint">
                                {t("chainFilterHint")}
                              </span>
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
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

    </main>
    </>
  );
}

export default GymsPage;
