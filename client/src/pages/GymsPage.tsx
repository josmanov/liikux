import { useEffect, useState } from "react";
import { type Gym } from "../data/types";
import "./GymsPage.css";

function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);

  useEffect(() => {
    fetch("http://localhost:3001/api/gyms")
      .then((r) => r.json())
      .then((data: Gym[]) => setGyms(data))
      .catch(() => setGyms([]));
  }, []);

  return (
    <main className="browse">
      <section className="browse-list">
        <header className="browse-list-head">
          <h1>Kuntosalit</h1>
          <p>{gyms.length} paikkaa</p>
        </header>
        <ul className="browse-rows">
          {gyms.map((gym) => (
            <li key={gym.id} className="browse-row">
              <strong>{gym.name}</strong>
              <span>
                {gym.city} · {gym.address}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="browse-map" aria-label="Kartta">
        <p>Kartta tulee tähän</p>
      </aside>
    </main>
  );
}

export default GymsPage;