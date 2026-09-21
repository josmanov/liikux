import "./GymsPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";
import {
  formatDistanceKm,
  formatPriceFrom,
  getGymCardMock,
} from "../data/gymCardMock";
import { extraGymsMock } from "../data/extraGymsMock";

const PIN_TOUCH_PX = 40;

const sortOptions = [
  { id: "nearest", label: "Lähimmät ensin" },
  { id: "name-asc", label: "Nimi A–Ö" },
  { id: "name-desc", label: "Nimi Ö–A" },
];

const chainFilterOptions = [
  { id: "all", label: "Kaikki ketjut" },
  { id: "elixia", label: "Elixia" },
  { id: "easyfit", label: "EasyFit" },
  { id: "fressi", label: "Fressi" },
  { id: "fitness24", label: "Fitness24Seven" },
  { id: "gofitness", label: "GoFitness" },
  { id: "olefit", label: "Ole.Fit" },
  { id: "liikku", label: "Liikku" },
];

const audienceOptions = [
  { id: "all", label: "Kaikille" },
  { id: "men", label: "Miehille" },
  { id: "women", label: "Naisille" },
  { id: "kids", label: "Lapsille" },
  { id: "seniors", label: "Seniori" },
];

const distanceOptions = [
  { id: "all", label: "Kaikki etäisyydet" },
  { id: "1", label: "Alle 1 km" },
  { id: "3", label: "Alle 3 km" },
  { id: "5", label: "Alle 5 km" },
  { id: "10", label: "Alle 10 km" },
];

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
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState("nearest");
  const [page, setPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [chainFilter, setChainFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const selectFromMapRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const sortLabel =
    sortOptions.find((o) => o.id === sortId)?.label ?? "Lähimmät ensin";
  const chainLabel =
    chainFilterOptions.find((o) => o.id === chainFilter)?.label ?? "Ketjut";
  const audienceLabel =
    audienceOptions.find((o) => o.id === audienceFilter)?.label ?? "Kenelle";
  const distanceLabel =
    distanceOptions.find((o) => o.id === distanceFilter)?.label ?? "Etäisyys";
  const priceLabel =
    priceOptions.find((o) => o.id === priceFilter)?.label ?? "Hinta";

  const visibleGyms = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = gyms.filter((gym) => {
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
    }

    return list;
  }, [gyms, query, sortId]);

  const pageCount = Math.max(1, Math.ceil(visibleGyms.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const pageGyms = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return visibleGyms.slice(start, start + PAGE_SIZE);
  }, [visibleGyms, safePage]);
  const pageGymsRef = useRef(pageGyms);
  pageGymsRef.current = pageGyms;

  useEffect(() => {
    setPage(1);
  }, [query, sortId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safePage]);

  useEffect(() => {
    if (!selectedId || !selectFromMapRef.current) return;
    selectFromMapRef.current = false;

    const el = document.querySelector<HTMLElement>(
      `[data-gym-id="${selectedId}"]`,
    );
    if (!el) return;

    const index = pageGyms.findIndex((g) => g.id === selectedId);
    const nearEnd = index >= 0 && index >= pageGyms.length - 2;

    if (!nearEnd) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const footer = document.querySelector<HTMLElement>(".footer");
    const sticky = document.querySelector<HTMLElement>(".browse-list-sticky");
    const header = document.querySelector<HTMLElement>(".header");
    const topPad =
      (header?.offsetHeight ?? 0) + (sticky?.offsetHeight ?? 0) + 12;
    const footerH = footer?.offsetHeight ?? 0;
    const elTop = el.getBoundingClientRect().top + window.scrollY;
    const ideal = elTop - topPad;
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight - footerH - 8,
    );

    window.scrollTo({
      top: Math.min(ideal, maxScroll),
      behavior: "smooth",
    });
  }, [selectedId, pageGyms]);

  useEffect(() => {
    if (!openFilter) return;
    function close() {
      setOpenFilter(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
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

    function syncPins() {
      clearMarkers();

      const gyms = pageGymsRef.current.filter(
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

    function fitToGyms() {
      const gyms = pageGyms.filter((g) => g.lng != null && g.lat != null);
      if (gyms.length === 0) return;
      const bounds = new LngLatBounds();
      gyms.forEach((g) => bounds.extend([g.lng as number, g.lat as number]));
      map.fitBounds(bounds, { padding: 72, maxZoom: 12 });
    }

    syncPins();
    fitToGyms();
    map.resize();

    map.on("moveend", syncPins);
    map.on("zoomend", syncPins);

    return () => {
      map.off("moveend", syncPins);
      map.off("zoomend", syncPins);
      clearMarkers();
    };
  }, [pageGyms, mapReady]);

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
            <h1>Kuntosalit</h1>
            <p className="browse-list-count">{visibleGyms.length} paikkaa</p>
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
                <span className="browse-filter-label">
                  {chainFilter === "all" ? "Ketjut" : chainLabel}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "chains" ? (
                <ul className="browse-filter-menu" role="listbox">
                  {chainFilterOptions.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={opt.id === chainFilter ? "is-on" : ""}
                        role="option"
                        aria-selected={opt.id === chainFilter}
                        onClick={() => {
                          setChainFilter(opt.id);
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
                <span className="browse-filter-label">
                  {audienceFilter === "all" ? "Kenelle" : audienceLabel}
                </span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {openFilter === "audience" ? (
                <ul className="browse-filter-menu" role="listbox">
                  {audienceOptions.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={opt.id === audienceFilter ? "is-on" : ""}
                        role="option"
                        aria-selected={opt.id === audienceFilter}
                        onClick={() => {
                          setAudienceFilter(opt.id);
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

            <div className="browse-filter">
              <button
                type="button"
                className="browse-filter-btn"
                aria-expanded={openFilter === "distance"}
                aria-haspopup="listbox"
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
                <ul className="browse-filter-menu" role="listbox">
                  {distanceOptions.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        className={opt.id === distanceFilter ? "is-on" : ""}
                        role="option"
                        aria-selected={opt.id === distanceFilter}
                        onClick={() => {
                          setDistanceFilter(opt.id);
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
                  setChainFilter("all");
                  setAudienceFilter("all");
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
          </div>
        </section>

        <section className="browse-list-main">
          <ul className="browse-rows">
            {pageGyms.map((gym) => {
              const chain = chains.find((c) => c.id === gym.chainId);
              const card = getGymCardMock(gym.slug);
              return (
                <li key={gym.id}>
                  <button
                    type="button"
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
                    onClick={() => {
                      selectFromMapRef.current = false;
                      setSelectedId(gym.id);
                    }}
                  >
                    <span
                      className={[
                        "browse-row-media",
                        chain?.logoFit === "contain" ? "is-logo" : "",
                        chain?.logoClass || "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {chain?.image ? <img src={chain.image} alt="" /> : null}
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
                  </button>
                </li>
              );
            })}
          </ul>

          {visibleGyms.length > PAGE_SIZE ? (
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
