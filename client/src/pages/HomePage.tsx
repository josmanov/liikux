import "./HomePage.css";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Dumbbell,
  Footprints,
  Goal,
  ArrowRight,
  LocateFixed,
  Mountain,
  PersonStanding,
  Target,
  Trophy,
  Waves,
} from "lucide-react";
import HoverIcon, { usePickHover } from "../components/HoverIcon";
import LoadSpin from "../components/LoadSpin";
import { type Chain } from "../data/types";
import { fetchChains, fetchHomeStats } from "../data/api";
import { lajiGifUrl } from "../data/lajiGifs";
import { useInView } from "../hooks/useInView";
import { useAppLocation } from "../context/LocationContext";
import { useChainPopup } from "../context/ChainPopupContext";
import { pathGyms } from "../i18n/lang";
import { useLang } from "../i18n/useLang";

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
  const navigate = useNavigate();
  const { useMyLocation } = useAppLocation();
  const { lang, t } = useLang();

  return (
    <button
      type="button"
      className="hero-locate"
      aria-label={t("useMyLocation")}
      onClick={() => {
        useMyLocation();
        navigate(pathGyms(lang), { state: { focusOrigin: true } });
      }}
    >
      <LocateFixed size={18} strokeWidth={2.2} />
    </button>
  );
}

function SearchButton() {
  const { t } = useLang();
  return (
    <button
      type="button"
      className="hero-locate"
      aria-label={t("search")}
    >
      <img src="/picks/search.png" alt="" width={22} height={22} />
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
  const { openChains, openChain } = useChainPopup();
  const [chains, setChains] = useState<Chain[]>([]);
  const [gymCount, setGymCount] = useState(0);
  const [cityCount, setCityCount] = useState(0);
  const { label, setLocation } = useAppLocation();
  const navigate = useNavigate();
  const { lang, t } = useLang();
  const [addressDraft, setAddressDraft] = useState("");
  const [suggestions, setSuggestions] = useState<
    { id: string; label: string; lat: number; lng: number }[]
  >([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  function goBrowseWithPick(item: {
    label: string;
    lat: number;
    lng: number;
  }) {
    setLocation({ label: item.label, lat: item.lat, lng: item.lng });
    setSuggestOpen(false);
    setSuggestions([]);
    navigate(pathGyms(lang), { state: { focusOrigin: true } });
  }

  useEffect(() => {
    if (label === "Helsinki" || label === "Lähellä minua") {
      setAddressDraft("");
    } else {
      setAddressDraft(label);
    }
  }, [label]);

  useEffect(() => {
    const q = addressDraft.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`http://localhost:3001/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then(
          (data: { id: string; label: string; lat: number; lng: number }[]) => {
            if (ac.signal.aborted) return;
            setSuggestions(Array.isArray(data) ? data : []);
            if (document.activeElement?.id === "address_input") {
              setSuggestOpen(true);
            }
          },
        )
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setSuggestLoading(false);
        });
    }, 120);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [addressDraft]);

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

  const [homeReady, setHomeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchChains().catch(() => [] as Chain[]),
      fetchHomeStats().catch(() => ({ gymCount: 0, cityCount: 0 })),
    ]).then(([data, stats]) => {
      if (cancelled) return;
      setChains(data);
      setGymCount(stats.gymCount);
      setCityCount(stats.cityCount);
      setHomeReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const suositutKetjut = chains
    .filter((c) => c.slug !== "muut")
    .slice(0, 6);
  const chainCount = chains.filter((c) => c.slug !== "muut").length;

  return (
    <>
      {!homeReady ? (
        <div className="load-cover">
          <LoadSpin />
        </div>
      ) : null}
    <main className={homeReady ? "shell load-reveal" : "shell load-hold"}>
      <section className="hero">
        <div className="hero-top">
          <h1 className="title">{t("heroTitle")}</h1>
          <div className="hero-search-wrap">
            <div className="hero-search" id="input">
              <input
                className="hero-search-input"
                id="address_input"
                type="text"
                placeholder={t("addressPlaceholder")}
                aria-label={t("addressAria")}
                value={addressDraft}
                autoComplete="off"
                onChange={(e) => {
                  setAddressDraft(e.target.value);
                  setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                  if (e.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
                onFocus={() => {
                  if (addressDraft.trim().length >= 2) setSuggestOpen(true);
                }}
                onBlur={() => {
                  setSuggestOpen(false);
                }}
              />
              <span className="hero-search-divider" aria-hidden="true" />
              <LocateButton />
              {suggestOpen && addressDraft.trim().length >= 2 ? (
                <div className="hero-suggest" role="listbox">
                  {suggestLoading && suggestions.length === 0 ? (
                    <p className="hero-suggest-empty">
                      <LoadSpin size="sm" />
                    </p>
                  ) : null}
                  {!suggestLoading && suggestions.length === 0 ? (
                    <p className="hero-suggest-empty">{t("noResults")}</p>
                  ) : null}
                  {suggestions.length > 0 ? (
                    <ul className="hero-suggest-list">
                      {suggestions.slice(0, 6).map((item) => {
                        const comma = item.label.lastIndexOf(",");
                        const name =
                          comma >= 0
                            ? item.label.slice(0, comma).trim()
                            : item.label;
                        const meta =
                          comma >= 0
                            ? item.label.slice(comma + 1).trim()
                            : "";
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className="hero-suggest-hit"
                              role="option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => goBrowseWithPick(item)}
                            >
                              <span className="hero-suggest-hit-text">
                                <span className="hero-suggest-hit-name">
                                  {name}
                                </span>
                                {meta ? (
                                  <span className="hero-suggest-hit-meta">
                                    {meta}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="hero-or">{t("heroOr")}</p>
            <Link to={pathGyms(lang)} className="hero-browse">
              {t("browseGyms")}
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <p className="hero-stats">
              {t("heroStats", {
                gyms: gymCount,
                chains: chainCount,
                cities: cityCount,
              })}
            </p>
          </div>
        </div>

        <div
          id="suositut"
          className={`rail reveal ${railReveal.inView || homeReady ? "is-in" : ""}`}
          ref={railReveal.ref}
        >
          <div className="rail-head">
            <h2 className="rail-title">{t("popularInFinland")}</h2>
            <div className="rail-arrows">
              <button
                type="button"
                className="lajit-all"
                onClick={() => openChains()}
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
                <span>{t("allGymChains")}</span>
              </button>
            </div>
          </div>
          <div className="rail-viewport" ref={viewportRef}>
            <div
              className={homeReady ? "rail-track list-pop" : "rail-track"}
              style={{
                transform: `translateX(-${start * step}px)`,
              }}
            >
              {suositutKetjut.map((chain, i) => (
                <button
                  key={chain.id}
                  type="button"
                  className="place-card"
                  style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                  onClick={() => openChain(chain.slug)}
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
                </button>
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
    </main>
    </>
  );
}

export default HomePage;
