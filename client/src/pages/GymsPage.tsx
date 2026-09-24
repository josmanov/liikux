import "./GymsPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";
import {
  formatDistanceKm,
  formatPriceFrom,
  getGymCardMock,
} from "../data/gymCardMock";
import { extraGymsMock } from "../data/extraGymsMock";
import { useAppLocation } from "../context/LocationContext";

const PIN_TOUCH_PX = 40;

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
  const fitKeyRef = useRef("");

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

  const areaCity = useMemo(() => {
    const known = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu"];
    return (
      known.find(
        (city) => city.toLowerCase() === locationLabel.trim().toLowerCase(),
      ) ?? null
    );
  }, [locationLabel]);

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
      if (
        areaCity &&
        gym.city.toLowerCase() !== areaCity.toLowerCase()
      ) {
        return false;
      }
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
        const card = getGymCardMock(gym.slug);
        const hit = selectedAudiences.some((id) =>
          card.audiences.includes(id as "men" | "women" | "kids" | "seniors"),
        );
        if (!hit) return false;
      }
      if (priceFilter !== "all") {
        const card = getGymCardMock(gym.slug);
        if (priceFilter === "cheap" && !(card.priceFrom < 30)) return false;
        if (
          priceFilter === "mid" &&
          !(card.priceFrom >= 30 && card.priceFrom <= 50)
        ) {
          return false;
        }
        if (priceFilter === "premium" && !(card.priceFrom > 50)) return false;
        if (priceFilter === "daypass" && !card.dayPass) return false;
      }
      if (maxDistanceKm != null) {
        if (gym.lat == null || gym.lng == null) return false;
        const km = distanceKm(origin.lat, origin.lng, gym.lat, gym.lng);
        if (km > maxDistanceKm) return false;
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
    areaCity,
  ]);

  visibleGymsRef.current = visibleGyms;

  const inViewGyms = useMemo(() => {
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
  }, [visibleGyms, mapBounds]);

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

  const selectedCard = selectedGym
    ? getGymCardMock(selectedGym.slug)
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
    areaCity,
  ]);

  useEffect(() => {
    setPage(1);
  }, [mapBounds]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safePage]);

  useEffect(() => {
    if (!selectedId || !selectFromMapRef.current) return;
    if (!pageGyms.some((g) => g.id === selectedId)) return;
    selectFromMapRef.current = false;

    const el = document.querySelector<HTMLElement>(
      `.browse-row[data-gym-id="${selectedId}"]`,
    );
    if (!el) return;

    const index = pageGyms.findIndex((g) => g.id === selectedId);
    const nearEnd = index >= 0 && index >= pageGyms.length - 6;
    const pager = document.querySelector<HTMLElement>(".browse-pager");

    if (nearEnd) {
      (pager ?? el).scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
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
      center: [24.94, 60.17],
      zoom: 11,
    });

    mapInstanceRef.current = map;

    map.on("load", () => {
      map.resize();
      setMapReady(true);
    });

    return () => {
      setMapReady(false);
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
        setGyms([...gymData, ...extraGymsMock]);
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

      const gyms = visibleGymsRef.current.filter(
        (g) => g.lng != null && g.lat != null,
      );
      if (gyms.length === 0) return;

      const pts = gyms.map((g, i) => ({
        i,
        g,
        p: map.project([g.lng as number, g.lat as number]),
      }));

      const parent = pts.map((_, i) => i);
      function find(a: number) {
        while (parent[a] !== a) {
          parent[a] = parent[parent[a]];
          a = parent[a];
        }
        return a;
      }
      function union(a: number, b: number) {
        a = find(a);
        b = find(b);
        if (a !== b) parent[a] = b;
      }

      const touch2 = PIN_TOUCH_PX * PIN_TOUCH_PX;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].p.x - pts[j].p.x;
          const dy = pts[i].p.y - pts[j].p.y;
          if (dx * dx + dy * dy < touch2) union(i, j);
        }
      }

      const groups = new globalThis.Map<number, typeof pts>();
      for (const pt of pts) {
        const root = find(pt.i);
        const list = groups.get(root);
        if (list) list.push(pt);
        else groups.set(root, [pt]);
      }

      let clusterN = 0;
      groups.forEach((group) => {
        if (group.length === 1) {
          const { g } = group[0];
          const el = document.createElement("div");
          el.className = "gym-pin";
          el.dataset.gymId = g.id;

          const hit = document.createElement("button");
          hit.type = "button";
          hit.className = "gym-pin-hit";
          if (g.id === selectedIdRef.current) hit.classList.add("is-selected");
          if (g.id === hoveredIdRef.current) hit.classList.add("is-hovered");
          hit.setAttribute("aria-label", g.name);

          const img = document.createElement("img");
          img.src = "/pins/gym-pin.png";
          img.alt = "";
          hit.appendChild(img);
          el.appendChild(hit);

          hit.addEventListener("mouseenter", () => setHoveredId(g.id));
          hit.addEventListener("mouseleave", () => setHoveredId(null));
          hit.addEventListener("click", () => {
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
        markersRef.current.set(`cluster-${clusterN}`, marker);
        clusterN += 1;
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

    function onMapIdle() {
      syncPins();
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

    syncPins();
    syncOriginPin();
    setMapBounds(readBounds());
    map.resize();

    map.on("moveend", onMapIdle);
    map.on("zoomend", onMapIdle);

    return () => {
      map.off("moveend", onMapIdle);
      map.off("zoomend", onMapIdle);
      clearMarkers();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    };
  }, [visibleGyms, mapReady, origin.lat, origin.lng]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const key = `${visibleGyms.length}:${origin.lat}:${origin.lng}:${areaCity ?? ""}:${selectedChains.join(",")}:${distanceFilter}:${priceFilter}:${query}`;
    if (key === fitKeyRef.current && visibleGyms.length > 0) return;
    fitKeyRef.current = key;

    const withCoords = visibleGyms.filter((g) => g.lng != null && g.lat != null);
    const bounds = new LngLatBounds();
    withCoords.forEach((g) => bounds.extend([g.lng as number, g.lat as number]));
    if (origin.lat != null && origin.lng != null) {
      bounds.extend([origin.lng, origin.lat]);
    }
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds, { padding: 72, maxZoom: 12 });
  }, [
    visibleGyms,
    mapReady,
    origin.lat,
    origin.lng,
    areaCity,
    selectedChains,
    distanceFilter,
    priceFilter,
    query,
  ]);
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const hit = marker.getElement().querySelector(".gym-pin-hit");
      if (!hit) return;
      hit.classList.toggle("is-hovered", id === hoveredId);
      hit.classList.toggle("is-selected", id === selectedId);
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
            <p className="browse-list-count">{inViewGyms.length} paikkaa</p>
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
            {selectedGym && selectedCard ? (
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
                    <span className="browse-map-preview-distance">
                      {formatDistanceKm(selectedCard.distanceKm)}
                    </span>
                  </span>
                  <span className="browse-map-preview-open">Avaa</span>
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className="browse-list-main">
          <ul className="browse-rows">
            {pageGyms.map((gym) => {
              const chain = chains.find((c) => c.id === gym.chainId);
              const card = getGymCardMock(gym.slug);
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
                        <span className="browse-row-distance">
                          {formatDistanceKm(card.distanceKm)}
                        </span>
                      </div>
                      <span className="browse-row-city">{gym.city}</span>
                      <span className="browse-row-address">
                        {gym.address
                          .replace(new RegExp(`,\\s*${gym.city}\\s*$`, "i"), "")
                          .trim()}
                      </span>
                      <span className="browse-row-price">
                        {formatPriceFrom(card.priceFrom)}
                      </span>
                      <div className="browse-row-tags">
                        {card.is247 ? (
                          <span className="browse-tag is-247">24/7</span>
                        ) : null}
                        {card.openNow && !card.is247 ? (
                          <span className="browse-tag is-open">Auki nyt</span>
                        ) : null}
                        {card.freeTrial ? (
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
