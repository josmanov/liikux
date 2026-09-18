import "./HomePage.css";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Dumbbell,
  Footprints,
  Goal,
  Mountain,
  PersonStanding,
  Target,
  Trophy,
  Waves,
} from "lucide-react";
import HoverIcon, { usePickHover } from "../components/HoverIcon";
import { type Chain, type Gym } from "../data/types";
import { lajiGifUrl } from "../data/lajiGifs";
import { useInView } from "../hooks/useInView";
import ChainPopup from "../components/ChainPopup";

const picks = [
  {
    name: "Kuntosalit",
    to: "/fi/kuntosalit",
    icon: "/picks/kuntosalit.gif",
    still: "/picks/kuntosalit-still.png",
    animated: true,
  },
  {
    name: "Harrastukset",
    to: "/harjoitukset",
    icon: "/picks/harrastukset.gif",
    still: "/picks/harrastukset-still.png",
    animated: true,
  },
];

const lajit: {
  name: string;
  to: string;
  Icon?: LucideIcon;
}[] = [
  { name: "Kuntosali", to: "/fi/kuntosalit", Icon: Dumbbell },
  { name: "Jalkapallo", to: "/harjoitukset/", Icon: Goal },
  { name: "Juoksu", to: "/harjoitukset", Icon: Footprints },
  { name: "Pyöräily", to: "/harjoitukset", Icon: Bike },
  { name: "Uinti", to: "/harjoitukset", Icon: Waves },
  { name: "Tanssi", to: "/harjoitukset", Icon: PersonStanding },
  { name: "Kiipeily", to: "/harjoitukset", Icon: Mountain },
  { name: "Koripallo", to: "/harjoitukset", Icon: Trophy },
  { name: "Tennis", to: "/harjoitukset", Icon: Target },
  { name: "Padeli", to: "/harjoitukset", Icon: Trophy },
];
function LajiIcon({ name, Icon }: { name: string; Icon?: LucideIcon }) {
  const gif = lajiGifUrl(name);
  const [broken, setBroken] = useState(false);

  if (gif && !broken) {
    return (
      <img
        className="laji-gif"
        src={gif}
        alt=""
        onError={() => setBroken(true)}
      />
    );
  }

  if (Icon) {
    return <Icon className="laji-icon" strokeWidth={2} />;
  }
  return null;
}

function LocateButton() {
  const hover = usePickHover();

  return (
    <button
      type="button"
      className="hero-locate"
      aria-label="Käytä sijaintiani"
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      <span className="hero-locate-gif">
        <img
          className="hero-locate-still"
          src="/picks/location-still.png"
          alt=""
          style={{ opacity: hover.playing ? 0 : 1 }}
        />
        {hover.playing ? (
          <img
            key={hover.playKey}
            className="hero-locate-anim"
            src={`/picks/location.gif?r=${hover.playKey}`}
            alt=""
            aria-hidden="true"
          />
        ) : null}
      </span>
    </button>
  );
}

function SearchButton() {
  const hover = usePickHover();

  return (
    <button
      type="button"
      className="hero-locate"
      aria-label="Käytä sijaintiani"
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      <span className="hero-locate-gif">
        <img className="hero-locate-still" src="/picks/search.png" alt="" />
      </span>
    </button>
  );
}

function PickLink({
  pick,
}: {
  pick: {
    name: string;
    to: string;
    icon: string;
    still?: string;
    animated?: boolean;
  };
}) {
  const hover = usePickHover();

  return (
    <Link
      to={pick.to}
      className="hero-pick"
      onMouseEnter={pick.animated ? hover.onMouseEnter : undefined}
      onMouseLeave={pick.animated ? hover.onMouseLeave : undefined}
    >
      <HoverIcon
        src={pick.icon}
        stillSrc={pick.still}
        animated={pick.animated}
        playing={hover.playing}
        playKey={hover.playKey}
      />
      <span>{pick.name}</span>
    </Link>
  );
}

function HomePage() {
  const [step, setStep] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const railReveal = useInView<HTMLDivElement>();
  const lajitReveal = useInView<HTMLDivElement>();
  const gymsAllHover = usePickHover();
  const start = 0;
  const [chainPopupOpen, setChainPopupOpen] = useState(false);
  const [chains, setChains] = useState<Chain[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);

  useEffect(() => {
    function measure() {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const card = viewport.querySelector(".place-card");
      if (!(card instanceof HTMLElement)) return;
      const styles = getComputedStyle(viewport.querySelector(".rail-track")!);
      const gap = parseFloat(styles.columnGap || styles.gap || "16") || 16;
      setStep(card.offsetWidth + gap);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    fetch("http://localhost:3001/api/chains")
      .then((r) => r.json())
      .then((data: Chain[]) => setChains(data))
      .catch(() => setChains([]));
  }, []);

  useEffect(() => {
    fetch("http://localhost:3001/api/gyms")
      .then((r) => r.json())
      .then((data: Gym[]) => setGyms(data))
      .catch(() => setGyms([]));
  }, []);

  const suositutKetjut = chains.slice(0, 6);
  const chainCount = chains.length;
  const cityCount = new Set(gyms.map((g) => g.city)).size;

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-top">
          <h1 className="title">Löydä paikka liikkua</h1>
          <div className="hero-search-wrap">
            <div className="hero-search" id="input">
              <input
                className="hero-search-input"
                id="address_input"
                type="text"
                placeholder=""
              />
              <label className="hero-search-label" htmlFor="address_input">
                Syötä osoite..
              </label>
              <span className="hero-search-divider" aria-hidden="true" />
              <LocateButton />
            </div>
            <p className="hero-stats">
              {chainCount} kuntosaliketjua · {cityCount} kaupunkia
            </p>
          </div>
        </div>

        <div
          className={`rail reveal ${railReveal.inView ? "is-in" : ""}`}
          ref={railReveal.ref}
        >
          <div className="rail-head">
            <h2 className="rail-title">Suomen suosituimmat</h2>
            <div className="rail-arrows">
              <button
                type="button"
                className="lajit-all"
                onClick={() => setChainPopupOpen(true)}
                onMouseEnter={gymsAllHover.onMouseEnter}
                onMouseLeave={gymsAllHover.onMouseLeave}
              >
                <HoverIcon
                  src="/picks/kuntosalit.gif"
                  stillSrc="/picks/kuntosalit-still.png"
                  animated
                  playing={gymsAllHover.playing}
                  playKey={gymsAllHover.playKey}
                />
                <span>Kaikki kuntosaliketjut</span>
              </button>
            </div>
          </div>
          <div className="rail-viewport" ref={viewportRef}>
            <div
              className="rail-track"
              style={{
                transform: `translateX(-${start * step}px)`,
              }}
            >
              {suositutKetjut.map((chain) => (
                <Link
                  key={chain.id}
                  to={`/fi/ketju/${chain.slug}`}
                  className="place-card"
                >
                  <span
                    className={[
                      "place-card-media",
                      chain.logoFit === "contain" ? "is-logo" : "",
                      chain.logoClass || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="place-card-shine" aria-hidden="true" />
                    <img src={chain.image} alt="" />
                  </span>
                  <span className="place-card-name">{chain.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/*
      <section className="discover" aria-label="Harrastukset">
        <div
          className={`lajit reveal ${lajitReveal.inView ? "is-in" : ""}`}
          ref={lajitReveal.ref}
        >
          <div className="rail-head">
            <h2 className="rail-title">Suositut harrastukset Suomessa</h2>
            <Link to="/harjoitukset" className="lajit-all">
              Kaikki harrastukset
            </Link>
          </div>
          <div className="lajit-grid">
            {lajit.map((laji) => (
              <Link key={laji.name} to={laji.to} className="laji-item">
                <span className="laji-label">{laji.name}</span>
                <span className="laji-btn">
                  <span className="laji-shine" aria-hidden="true" />
                  <LajiIcon name={laji.name} Icon={laji.Icon} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      */}
      <ChainPopup
        open={chainPopupOpen}
        onClose={() => setChainPopupOpen(false)}
      />
    </main>
  );
}

export default HomePage;
