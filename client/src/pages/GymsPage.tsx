import "./GymsPage.css";
import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";

function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());

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
    if (!map || gyms.length === 0) return;

    const addMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      const bounds = new LngLatBounds();

      gyms.forEach((gym) => {
        if (gym.lng == null || gym.lat == null) return;

        const el = document.createElement("button");
        el.type = "button";
        el.className = "gym-pin";
        el.dataset.gymId = gym.id;
        el.setAttribute("aria-label", gym.name);

        const img = document.createElement("img");
        img.src = "/pins/gym-pin.png";
        img.alt = "";
        el.appendChild(img);

        el.addEventListener("mouseenter", () => setHoveredId(gym.id));
        el.addEventListener("mouseleave", () => setHoveredId(null));
        el.addEventListener("click", () => setSelectedId(gym.id));

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
  }, [gyms]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.classList.toggle("is-hovered", id === hoveredId);
      el.classList.toggle("is-selected", id === selectedId);
    });
  }, [hoveredId, selectedId]);

  return (
    <main className="browse">
      <div className="browse-body">
        <section className="browse-list-col">
          <header className="browse-list-head">
            <h1>Kuntosalit</h1>
            <p>{gyms.length} paikkaa</p>
          </header>
          <ul className="browse-rows">
            {gyms.map((gym) => {
              const chain = chains.find((c) => c.id === gym.chainId);
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
                      <strong>{gym.name}</strong>
                      <span>
                        {gym.city} · {gym.address}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="browse-map-col">
          <header className="browse-map-head" aria-label="Kartan suodattimet" />
          <div className="browse-map-frame">
            <div className="browse-map" aria-label="Kartta" ref={mapRef} />
          </div>
        </section>
      </div>
    </main>
  );
}

export default GymsPage;
