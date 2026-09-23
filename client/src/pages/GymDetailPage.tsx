import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type Chain, type Gym } from "../data/types";
import { extraGymsMock } from "../data/extraGymsMock";
import {
  formatDistanceKm,
  formatPriceFrom,
  getGymCardMock,
} from "../data/gymCardMock";
import "./GymDetailPage.css";

type GymDetail = Gym & { chain: Chain | null };

function GymDetailPage() {
  const { slug } = useParams();
  const [gym, setGym] = useState<GymDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!slug) {
      setStatus("missing");
      setGym(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    Promise.all([
      fetch(`http://localhost:3001/api/gyms/${encodeURIComponent(slug)}`).then(
        async (r) => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error("fail");
          return r.json() as Promise<GymDetail>;
        },
      ),
      fetch("http://localhost:3001/api/chains").then((r) => r.json() as Promise<Chain[]>),
    ])
      .then(([apiGym, chainData]) => {
        if (cancelled) return;
        if (apiGym) {
          setGym(apiGym);
          setStatus("ok");
          return;
        }

        const mock = extraGymsMock.find((g) => g.slug === slug);
        if (!mock) {
          setGym(null);
          setStatus("missing");
          return;
        }

        const chain = chainData.find((c) => c.id === mock.chainId) ?? null;
        setGym({ ...mock, chain });
        setStatus("ok");
      })
      .catch(() => {
        if (cancelled) return;
        const mock = extraGymsMock.find((g) => g.slug === slug);
        if (!mock) {
          setGym(null);
          setStatus("missing");
          return;
        }
        setGym({ ...mock, chain: null });
        setStatus("ok");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === "loading") {
    return (
      <main className="gym-detail">
        <p className="gym-detail-muted">Ladataan…</p>
      </main>
    );
  }

  if (status === "missing" || !gym) {
    return (
      <main className="gym-detail">
        <h1>Salia ei löytynyt</h1>
        <p className="gym-detail-muted">Tarkista osoite tai palaa selaamaan.</p>
        <Link className="gym-detail-back" to="/fi/kuntosalit">
          ← Selaa kuntosaleja
        </Link>
      </main>
    );
  }

  const card = getGymCardMock(gym.slug);
  const chain = gym.chain;
  const mapsUrl =
    gym.lat != null && gym.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${gym.lat},${gym.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${gym.name} ${gym.address}`,
        )}`;

  const services = [
    card.is247 ? "24/7" : null,
    card.openNow && !card.is247 ? "Auki nyt" : null,
    card.freeTrial ? "Ilmainen kokeilu" : null,
    card.dayPass ? "Päivälippu" : null,
  ].filter(Boolean) as string[];

  return (
    <main className="gym-detail">
      <Link className="gym-detail-back" to="/fi/kuntosalit">
        ← Selaa kuntosaleja
      </Link>

      <div className="gym-detail-hero">
        <span
          className={[
            "gym-detail-logo",
            chain?.image ? (chain.logoFit === "contain" ? "is-logo" : "") : "is-pin",
            chain?.image ? chain.logoClass || "" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <img src={chain?.image || "/pins/gym-pin.png"} alt="" />
        </span>
        <div className="gym-detail-hero-text">
          <h1>{gym.name}</h1>
          {chain ? <p className="gym-detail-chain">{chain.name}</p> : null}
        </div>
      </div>

      <section className="gym-detail-block">
        <h2>Sijainti</h2>
        <p>{gym.address}</p>
        <p className="gym-detail-muted">{gym.city}</p>
        <p className="gym-detail-distance">
          {formatDistanceKm(card.distanceKm)}
        </p>
      </section>

      <section className="gym-detail-block">
        <h2>Hinta</h2>
        <p>{formatPriceFrom(card.priceFrom)}</p>
      </section>

      <section className="gym-detail-block">
        <h2>Palvelut</h2>
        {services.length > 0 ? (
          <ul className="gym-detail-tags">
            {services.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="gym-detail-muted">Ei lisätietoja vielä.</p>
        )}
      </section>

      <a
        className="gym-detail-cta"
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
      >
        Avaa kartalla
      </a>
    </main>
  );
}

export default GymDetailPage;
