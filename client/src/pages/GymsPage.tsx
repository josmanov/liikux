import "./GymsPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { LngLatBounds, Map, Marker, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";
import {
  formatDistanceKm,
  formatPriceFrom,
} from "../data/gymCardMock";
import { useAppLocation } from "../context/LocationContext";

function markerScaleForZoom(zoom: number) {
  const t = Math.min(1, Math.max(0, (zoom - 4.2) / 8));
  return 0.42 + t * 0.58;
}

function clusterCellDeg(zoom: number) {
  if (zoom < 7) return 0.5;
  if (zoom < 8) return 0.32;
  if (zoom < 9) return 0.2;
  if (zoom < 10) return 0.12;
  if (zoom < 11) return 0.075;
  if (zoom < 12) return 0.045;
  if (zoom < 13) return 0.028;
  if (zoom < 14) return 0.018;
  if (zoom < 15) return 0.011;
  return 0.007;
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

const sortOptions = [
  { id: "nearest", label: "Lähimmät ensin" },
  { id: "name-asc", label: "Nimi A–Ö" },
  { id: "name-desc", label: "Nimi Ö–A" },
];

const OTHER_CHAIN_FILTER_ID = "yksityiset";

const chainFilterOptions = [
  { id: "elixia", label: "Elixia" },
  { id: "easyfit", label: "EasyFit" },
  { id: "fressi", label: "Fressi" },
  { id: "fitness24", label: "Fitness24Seven" },
  { id: "gofitness", label: "GoFitness" },
  { id: "olefit", label: "Ole.Fit" },
  { id: "liikku", label: "Liikku" },
  { id: "forever", label: "Forever" },
  { id: "ladyline", label: "LadyLine" },
  { id: "esport", label: "Esport" },
  { id: "unisport", label: "UniSport" },
  { id: "mm", label: "M&M" },
  { id: OTHER_CHAIN_FILTER_ID, label: "Yksityiset / muut" },
];

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

const audienceOptions = [
  { id: "men", label: "Miehille", icon: "/icons/kenelle-men.png" },
  { id: "women", label: "Naisille", icon: "/icons/kenelle-women.png" },
  { id: "kids", label: "Lapsille", icon: "/icons/kenelle-kids.png" },
  { id: "seniors", label: "Seniori", icon: "/icons/kenelle-seniors.png" },
];

const distancePresets = [
  { id: "all", km: null as number | null, label: "Kaikki" },
  { id: "1", km: 1, label: "1 km" },
  { id: "3", km: 3, label: "3 km" },
  { id: "5", km: 5, label: "5 km" },
  { id: "10", km: 10, label: "10 km" },
  { id: "20", km: 20, label: "20 km" },
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

const priceOptions = [
  { id: "all", label: "Kaikki hinnat" },
  { id: "cheap", label: "Alle 30 €/kk" },
  { id: "mid", label: "30–50 €/kk" },
  { id: "premium", label: "Yli 50 €/kk" },
  { id: "daypass", label: "Päivälippu" },
];

type FilterKey = "chains" | "audience" | "distance" | "price" | "sort";

const PAGE_SIZE = 24;

function GymsPage() {
  const { slug: chainSlug } = useParams();
  const routeLocation = useLocation();
  const {
    label: locationLabel,
    lat: locationLat,
    lng: locationLng,
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
  const [priceFilter, setPriceFilter] = useState("all");
  const [mapReady, setMapReady] = useState(false);
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
    if (!chainSlug) return;
    const filterId = filterIdFromChainSlug(chainSlug, chains);
    if (filterId) setSelectedChains([filterId]);
  }, [chainSlug, chains]);

  useEffect(() => {
    if (chainSlug) return;
    setSelectedChains([...allChainFilterIds]);
  }, [chainSlug]);

  const sortLabel =
    sortOptions.find((o) => o.id === sortId)?.label ?? "Lähimmät ensin";
  const chainFilterActive = selectedChains.length < allChainFilterIds.length;
  const pageTitle =
    selectedChains.length === 1
      ? (chainFilterOptions.find((o) => o.id === selectedChains[0])?.label ??
        "Kuntosalit")
      : "Kuntosalit";
  const chainLabel =
    selectedChains.length === 0
      ? "Ketjut"
      : !chainFilterActive
        ? "Ketjut"
        : selectedChains.length === 1
          ? (chainFilterOptions.find((o) => o.id === selectedChains[0])
              ?.label ?? "Ketjut")
          : `Ketjut (${selectedChains.length})`;
  const audienceLabel =
    selectedAudiences.length === 0
      ? "Kenelle"
      : selectedAudiences.length === 1
        ? (audienceOptions.find((o) => o.id === selectedAudiences[0])?.label ??
          "Kenelle")
        : `Kenelle (${selectedAudiences.length})`;
  const distanceLabel =
    distancePresets.find((o) => o.id === distanceFilter)?.label ?? "Etäisyys";
  const distancePresetIndex = Math.max(
    0,
    distancePresets.findIndex((o) => o.id === distanceFilter),
  );
  const maxDistanceKm =
    distancePresets[distancePresetIndex]?.km ?? null;

  const origin = useMemo(() => {
    if (locationLat != null && locationLng != null) {
      return { lat: locationLat, lng: locationLng };
    }
    const key = Object.keys(cityCenters).find(
      (city) => locationLabel.toLowerCase() === city.toLowerCase(),
    );
    return cityCenters[key ?? "Helsinki"];
  }, [locationLabel, locationLat, locationLng]);

  const priceLabel =
    priceOptions.find((o) => o.id === priceFilter)?.label ?? "Hinta";

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
      if (selectedAudiences.length > 0) {
        return false;
      }
      if (priceFilter !== "all") {
        const chain = chains.find((c) => c.id === gym.chainId);
        const priceFrom =
          gym.priceFrom != null ? gym.priceFrom : (chain?.priceFrom ?? null);
        const dayPass = chain?.dayPass ?? null;
        if (priceFilter === "daypass") {
          if (dayPass !== true) return false;
        } else if (priceFrom == null) {
          return false;
        } else if (priceFilter === "cheap" && !(priceFrom < 30)) {
          return false;
        } else if (
          priceFilter === "mid" &&
          !(priceFrom >= 30 && priceFrom <= 50)
        ) {
          return false;
        } else if (priceFilter === "premium" && !(priceFrom > 50)) {
          return false;
        }
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
    return chains.find((c) => c.id === selectedGym.chainId) ?? null;
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

  function toggleFilter(key: FilterKey) {
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
                "fill-opacity": 0.62,
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
    Promise.all([
      fetch("http://localhost:3001/api/gyms").then((r) => r.json()),
      fetch("http://localhost:3001/api/chains").then((r) => r.json()),
    ])
      .then(([gymData, chainData]: [Gym[], Chain[]]) => {
        setGyms(gymData);
        setChains(chainData);
      })
      .catch(() => {
        setGyms([]);
        setChains([]);
      });
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
      const cell = clusterCellDeg(zoom);

      type Pt = {
        g: (typeof gyms)[number];
      };
      const cells = new globalThis.Map<string, Pt[]>();
      for (const g of gyms) {
        const key = `${Math.floor((g.lng as number) / cell)}:${Math.floor((g.lat as number) / cell)}`;
        const list = cells.get(key);
        if (list) list.push({ g });
        else cells.set(key, [{ g }]);
      }

      cells.forEach((group, cellKey) => {
        if (group.length === 1) {
          const { g } = group[0];
          const chain = chainsByIdRef.current.get(g.chainId);
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

          const img = document.createElement("img");
          img.src = brandImg || "/pins/gym-pin.png";
          img.alt = "";
          img.decoding = "async";
          hit.appendChild(img);
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
            .setLngLat([g.lng as number, g.lat as number])
            .addTo(map);
          markersRef.current.set(g.id, marker);
          return;
        }

        let lng = 0;
        let lat = 0;
        group.forEach((pt) => {
          lng += pt.g.lng as number;
          lat += pt.g.lat as number;
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
          group.forEach((pt) => {
            bounds.extend([pt.g.lng as number, pt.g.lat as number]);
          });
          map.fitBounds(bounds, { padding: 72, maxZoom: 16 });
        });

        const marker = new Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(`cluster-${cellKey}`, marker);
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

  return (
    <main className="browse">
      <div className="browse-body">
          <div className="browse-list-sticky">
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
                placeholder="Hae nimellä tai osoitteella..."
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
                ? "Valitse maakunta kartalta"
                : selectedMaakunta
                  ? `${selectedMaakunta} · ${inViewGyms.length} paikkaa`
                  : `${inViewGyms.length} paikkaa`}
            </p>
          </header>
          </div>

        <section className="browse-map-col">
          <div
            className="browse-map-filters"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="browse-sep" aria-hidden="true" />

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
                  aria-label="Ketjut"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-filter-menu-actions">
                    <button
                      type="button"
                      className="browse-filter-menu-action"
                      onClick={() => setSelectedChains([...allChainFilterIds])}
                    >
                      Kaikki
                    </button>
                    <button
                      type="button"
                      className="browse-filter-menu-action"
                      onClick={() => setSelectedChains([])}
                    >
                      Tyhjennä
                    </button>
                  </div>
                  <ul className="browse-filter-check-list" role="listbox">
                    {chainFilterOptions.map((opt) => {
                      const on = selectedChains.includes(opt.id);
                      return (
                        <li key={opt.id}>
                          <label className="browse-filter-check">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => {
                                setSelectedChains((cur) =>
                                  cur.includes(opt.id)
                                    ? cur.filter((id) => id !== opt.id)
                                    : [...cur, opt.id],
                                );
                              }}
                            />
                            <span>{opt.label}</span>
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
                className="browse-filter-btn"
                aria-expanded={openFilter === "audience"}
                aria-haspopup="listbox"
                onClick={() => toggleFilter("audience")}
              >
                <img
                  className="browse-filter-icon"
                  src="/icons/kenelle.png"
                  alt=""
                />
                <span className="browse-filter-label">{audienceLabel}</span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "audience" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-audience"
                  role="group"
                  aria-label="Kenelle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-filter-menu-actions">
                    <button
                      type="button"
                      className="browse-filter-menu-action"
                      onClick={() => setSelectedAudiences([])}
                    >
                      Tyhjennä
                    </button>
                  </div>
                  <ul className="browse-filter-check-list" role="listbox">
                    {audienceOptions.map((opt) => {
                      const on = selectedAudiences.includes(opt.id);
                      return (
                        <li key={opt.id}>
                          <label className="browse-filter-check">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => {
                                setSelectedAudiences((cur) =>
                                  cur.includes(opt.id)
                                    ? cur.filter((id) => id !== opt.id)
                                    : [...cur, opt.id],
                                );
                              }}
                            />
                            <span className="browse-filter-check-label">
                              {opt.label}
                            </span>
                            <img
                              className="browse-filter-check-icon"
                              src={opt.icon}
                              alt=""
                            />
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
                className="browse-filter-btn"
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
                  {distanceFilter === "all" ? "Etäisyys" : distanceLabel}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "distance" ? (
                <div
                  className="browse-filter-menu browse-filter-menu-distance"
                  role="dialog"
                  aria-label="Etäisyys"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="browse-distance-head">
                    <span>Max etäisyys</span>
                    <strong>
                      {maxDistanceKm == null
                        ? "Kaikki"
                        : `${maxDistanceKm} km`}
                    </strong>
                  </div>
                  <input
                    className="browse-distance-slider"
                    type="range"
                    min={0}
                    max={distancePresets.length - 1}
                    step={1}
                    value={distancePresetIndex}
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
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="browse-filter">
              <button
                type="button"
                className="browse-filter-btn"
                aria-expanded={openFilter === "price"}
                aria-haspopup="listbox"
                onClick={() => toggleFilter("price")}
              >
                <img
                  className="browse-filter-icon"
                  src="/icons/hinta.png"
                  alt=""
                />
                <span className="browse-filter-label">
                  {priceFilter === "all" ? "Hinta" : priceLabel}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "price" ? (
                <ul className="browse-filter-menu" role="listbox">
                  {priceOptions.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={opt.id === priceFilter ? "is-on" : ""}
                        role="option"
                        aria-selected={opt.id === priceFilter}
                        onClick={() => {
                          setPriceFilter(opt.id);
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

            <div className="browse-filters-actions">
              <button type="button" className="browse-filters-more">
                <SlidersHorizontal size={16} strokeWidth={2.2} />
                <span>Suodattimet</span>
              </button>
              <button
                type="button"
                className="browse-filters-clear"
                onClick={() => {
                  setSelectedChains([...allChainFilterIds]);
                  setSelectedAudiences([]);
                  setDistanceFilter("all");
                  setPriceFilter("all");
                  setOpenFilter(null);
                }}
              >
                Tyhjennä
              </button>
            </div>
          </div>

          <div className="browse-map-frame">
            <div className="browse-map" aria-label="Kartta" ref={mapRef} />
            <p className="browse-region-hint">
              {selectedMaakunta ?? "Valitse maakunta"}
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
                  to={`/fi/sali/${selectedGym.slug}`}
                >
                  <span
                    className={[
                      "browse-map-preview-media",
                      selectedChain?.image
                        ? selectedChain.logoFit === "contain"
                          ? "is-logo"
                          : ""
                        : "is-pin",
                      selectedChain?.image ? selectedChain.logoClass || "" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <img
                      src={selectedChain?.image || "/pins/gym-pin.png"}
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
                  <span className="browse-map-preview-open">Avaa</span>
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className="browse-list-main">
          {regionPickMode ? (
            <p className="browse-region-empty">
              Valitse maakunta kartalta nähdäksesi salit.
            </p>
          ) : null}
          <ul className="browse-rows">
            {pageGyms.map((gym) => {
              const chain = chains.find((c) => c.id === gym.chainId);
              const distKm =
                gym.lat != null && gym.lng != null
                  ? distanceKm(origin.lat, origin.lng, gym.lat, gym.lng)
                  : null;
              const priceLabel = formatPriceFrom(
                gym.priceFrom != null ? gym.priceFrom : chain?.priceFrom,
              );
              return (
                <li key={gym.id}>
                  <Link
                    to={`/fi/sali/${gym.slug}`}
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
                        chain?.image
                          ? chain.logoFit === "contain"
                            ? "is-logo"
                            : ""
                          : "is-pin",
                        chain?.image ? chain.logoClass || "" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <img
                        src={chain?.image || "/pins/gym-pin.png"}
                        alt=""
                      />
                    </span>
                    <div className="browse-row-text">
                      <div className="browse-row-top">
                        <strong>{gym.name}</strong>
                        {distKm != null ? (
                          <span className="browse-row-distance">
                            {formatDistanceKm(distKm)}
                          </span>
                        ) : null}
                      </div>
                      <span className="browse-row-city">{gym.city}</span>
                      <span className="browse-row-address">
                        {gym.address
                          .replace(new RegExp(`,\\s*${gym.city}\\s*$`, "i"), "")
                          .trim()}
                      </span>
                      {priceLabel ? (
                        <span className="browse-row-price">{priceLabel}</span>
                      ) : null}
                      <div className="browse-row-tags">
                        {chain?.is247 === true ? (
                          <span className="browse-tag is-247">24/7</span>
                        ) : null}
                        {chain?.freeTrial === true ? (
                          <span className="browse-tag is-trial">
                            Ilmainen kokeilu
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <span>Seuraava</span>
                <ChevronRight size={18} strokeWidth={2.2} />
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default GymsPage;
