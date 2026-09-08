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
  { name: "Jalkapallo", to: "/harjoitukset", Icon: Goal },
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
            id="floating_outlined"
            type="text"
            placeholder="Kuntosali, kiipeily..."
          />
          <label className="hero-search-label" htmlFor="floating_outlined">
            Hae
          </label>
          <div className="hero-search-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="#94a3b8"
              viewBox="0 0 24 24"
              height="24"
              width="24"
            >
              <path d="M10.979 16.8991C11.0591 17.4633 10.6657 17.9926 10.0959 17.9994C8.52021 18.0183 6.96549 17.5712 5.63246 16.7026C4.00976 15.6452 2.82575 14.035 2.30018 12.1709C1.77461 10.3068 1.94315 8.31525 2.77453 6.56596C3.60592 4.81667 5.04368 3.42838 6.82101 2.65875C8.59833 1.88911 10.5945 1.79039 12.4391 2.3809C14.2837 2.97141 15.8514 4.21105 16.8514 5.86977C17.8513 7.52849 18.2155 9.49365 17.8764 11.4005C17.5979 12.967 16.8603 14.4068 15.7684 15.543C15.3736 15.9539 14.7184 15.8787 14.3617 15.4343C14.0051 14.9899 14.0846 14.3455 14.4606 13.9173C15.1719 13.1073 15.6538 12.1134 15.8448 11.0393C16.0964 9.62426 15.8261 8.166 15.0841 6.93513C14.3421 5.70426 13.1788 4.78438 11.81 4.34618C10.4412 3.90799 8.95988 3.98125 7.641 4.55236C6.32213 5.12348 5.25522 6.15367 4.63828 7.45174C4.02135 8.74982 3.89628 10.2276 4.28629 11.6109C4.67629 12.9942 5.55489 14.1891 6.75903 14.9737C7.67308 15.5693 8.72759 15.8979 9.80504 15.9333C10.3746 15.952 10.8989 16.3349 10.979 16.8991Z"></path>
              <rect
                transform="rotate(-49.6812 12.2469 14.8859)"
                rx="1"
                height="10.1881"
                width="2"
                y="14.8859"
                x="12.2469"
              ></rect>
            </svg>
          </div>
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
