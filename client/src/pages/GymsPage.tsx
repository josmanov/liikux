import "./GymsPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";
import {
  formatDistanceKm,
  formatPriceFrom,
  getGymCardMock,
} from "../data/gymCardMock";

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

function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState("nearest");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [chainFilter, setChainFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());

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
    });

    return () => {
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
        setGyms(gymData);
        setChains(chainData);
      })
      .catch(() => {
        setGyms([]);
        setChains([]);
      });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const addMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (visibleGyms.length === 0) {
        map.resize();
        return;
      }

      const bounds = new LngLatBounds();

      visibleGyms.forEach((gym) => {
        if (gym.lng == null || gym.lat == null) return;

        const el = document.createElement("div");
        el.className = "gym-pin";
        el.dataset.gymId = gym.id;

        const hit = document.createElement("button");
        hit.type = "button";
        hit.className = "gym-pin-hit";
        hit.setAttribute("aria-label", gym.name);

        const img = document.createElement("img");
        img.src = "/pins/gym-pin.png";
        img.alt = "";
        hit.appendChild(img);
        el.appendChild(hit);

        hit.addEventListener("mouseenter", () => setHoveredId(gym.id));
        hit.addEventListener("mouseleave", () => setHoveredId(null));
        hit.addEventListener("click", () => setSelectedId(gym.id));

        const marker = new Marker({ element: el })
          .setLngLat([gym.lng, gym.lat])
          .addTo(map);

        markersRef.current.set(gym.id, marker);
        bounds.extend([gym.lng, gym.lat]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 72, maxZoom: 12 });
      }

      map.resize();
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.once("load", addMarkers);
    }
  }, [visibleGyms]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const hit = marker.getElement().querySelector(".gym-pin-hit");
      if (!hit) return;
      hit.classList.toggle("is-hovered", id === hoveredId);
      hit.classList.toggle("is-selected", id === selectedId);
    });
  }, [hoveredId, selectedId]);

  return (
    <main className="browse">
      <div className="browse-body">
        <section className="browse-list-col">
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
          <ul className="browse-rows">
            {visibleGyms.map((gym) => {
              const chain = chains.find((c) => c.id === gym.chainId);
              const card = getGymCardMock(gym.slug);
              return (
                <li key={gym.id}>
                  <button
                    type="button"
                    className={[
                      "browse-row",
                      hoveredId === gym.id ? "is-hovered" : "",
                      selectedId === gym.id ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setHoveredId(gym.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(gym.id)}
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
        </section>

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
      </div>
    </main>
  );
}

export default GymsPage;
