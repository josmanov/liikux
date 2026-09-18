import "./GymsPage.css";
import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";

function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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

        el.addEventListener("mouseenter", () => setHoveredId(gym.id));
        el.addEventListener("mouseleave", () => setHoveredId(null));

        const marker = new Marker({ element: el })
          .setLngLat([gym.lng, gym.lat])
          .addTo(map);

        markersRef.current.set(gym.id, marker);
        bounds.extend([gym.lng, gym.lat]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 72, maxZoom: 12 });
      }
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.once("load", addMarkers);
    }
  }, [gyms]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.getElement().classList.toggle("is-hovered", id === hoveredId);
    });
  }, [hoveredId]);

  return (
    <main className="browse">
      <section className="browse-list">
        <header className="browse-list-head">
          <h1>Kuntosalit</h1>
          <p>{gyms.length} paikkaa</p>
        </header>
        <ul className="browse-rows">
          {gyms.map((gym) => {
            const chain = chains.find((c) => c.id === gym.chainId);
            return (
              <li
                key={gym.id}
                className={[
                  "browse-row",
                  hoveredId === gym.id ? "is-hovered" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setHoveredId(gym.id)}
                onMouseLeave={() => setHoveredId(null)}
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
              </li>
            );
          })}
        </ul>
      </section>
      <aside className="browse-map" aria-label="Kartta" ref={mapRef} />
    </main>
  );
}

export default GymsPage;
