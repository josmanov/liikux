import { useEffect, useRef, useState } from "react";
import { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Chain, type Gym } from "../data/types";
import "./GymsPage.css";

function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [24.94, 60.17],
      zoom: 12,
    });

    map.on("load", () => {
      map.resize();
    });

    return () => {
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
              <li key={gym.id} className="browse-row">
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
