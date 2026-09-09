import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  ChevronLeft,
  ChevronRight,
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
import { gymsInCity } from "../data/mockPlaces";
import { lajiGifUrl } from "../data/lajiGifs";
import { useInView } from "../hooks/useInView";
import "./HomePage.css";

const city = "Helsinki";
const cityIn = "Helsingissä";
const suositutSalit = gymsInCity(city);
const VISIBLE = 6;

const picks = [
  {
    name: "Kaikki",
    to: "/",
    icon: "/picks/kaikki.gif",
    still: "/picks/kaikki-still.png",
    animated: true,
  },
  {
    name: "Kuntosalit",
    to: "/gyms",
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
  {
    name: "Palvelut",
    to: "/gyms",
    icon: "/picks/palvelut.gif",
    still: "/picks/palvelut-still.png",
    animated: true,
  },
];

const lajit: {
  name: string;
  to: string;
  Icon?: LucideIcon;
}[] = [
  { name: "Kuntosali", to: "/gyms", Icon: Dumbbell },
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
function LajiIcon({
  name,
  Icon,
}: {
  name: string;
  Icon?: LucideIcon;
}) {
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
        <img
          className="hero-locate-still"
          src="/picks/search.png"
          alt=""
        />
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
  const [start, setStart] = useState(0);
  const [step, setStep] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const maxStart = Math.max(0, suositutSalit.length - VISIBLE);
  const railReveal = useInView<HTMLDivElement>();
  const lajitReveal = useInView<HTMLDivElement>();

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

  function prev() {
    setStart((n) => Math.max(0, n - 1));
  }

  function next() {
    setStart((n) => Math.min(maxStart, n + 1));
  }

  return (
    <main className="shell">
      <section className="hero">
        <h1 className="title">Löydä paikka liikkua</h1>
        <p className="lede">
          Etsi alueesi kuntosalit, urheiluseurat ja harrastuspaikat
        </p>

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
          <SearchButton />
          <span className="hero-search-divider" aria-hidden="true" />
          <LocateButton />
        </div>

        <div className="hero-picks">
          {picks.map((pick) => (
            <PickLink key={pick.name} pick={pick} />
          ))}
        </div>
      </section>

      <section className="discover" aria-label="Suositukset">
        <div
          className={`rail reveal ${railReveal.inView ? "is-in" : ""}`}
          ref={railReveal.ref}
        >
          <div className="rail-head">
            <h2 className="rail-title">Suositut kuntosalit {cityIn}</h2>
            <div className="rail-arrows">
              <button
                type="button"
                className="rail-arrow"
                aria-label="Edellinen"
                onClick={prev}
                disabled={start <= 0}
              >
                <ChevronLeft size={22} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="rail-arrow"
                aria-label="Seuraava"
                onClick={next}
                disabled={start >= maxStart}
              >
                <ChevronRight size={22} strokeWidth={2.4} />
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
              {suositutSalit.map((place) => (
                <Link
                  key={place.id}
                  to={`/gyms/${place.id}`}
                  className="place-card"
                >
                  <span
                    className={[
                      "place-card-media",
                      place.logoFit === "contain" ? "is-logo" : "",
                      place.logoClass || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="place-card-shine" aria-hidden="true" />
                    <img src={place.image} alt="" />
                  </span>
                  <span className="place-card-name">{place.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

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
    </main>
  );
}

export default HomePage;
