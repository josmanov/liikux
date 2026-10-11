import "./HomePage.css";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Goal,
  ArrowRight,
  HeartPulse,
  LocateFixed,
  Mountain,
  PersonStanding,
  Target,
  Timer,
  Trophy,
  Waves,
} from "lucide-react";
import HoverIcon, { usePickHover } from "../components/HoverIcon";
import LoadSpin from "../components/LoadSpin";
import { type Chain } from "../data/types";
import { fetchChains, fetchHomeStats } from "../data/api";
import { useAddressSuggest } from "../data/geocode";
import { lajiGifUrl } from "../data/lajiGifs";
import { preloadImages } from "../data/preloadImages";
import { useInView } from "../hooks/useInView";
import { useAppLocation } from "../context/LocationContext";
import { useChainPopup } from "../context/ChainPopupContext";
import { pathGyms, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";

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

const patternIcons = [
  Dumbbell,
  Bike,
  Footprints,
  HeartPulse,
  Timer,
  Flame,
  Trophy,
  PersonStanding,
] as const;

const PATTERN_CELL = 120;
const PATTERN_COLS = 8;
const PATTERN_ROWS = 5;

const heroPatternItems = Array.from({ length: PATTERN_ROWS }, (_, r) =>
  Array.from({ length: PATTERN_COLS }, (_, c) => {
    const Icon = patternIcons[(r * 3 + c * 5 + r * c) % patternIcons.length];
    const wobble = (((r * 13 + c * 17) % 13) - 6) * 2.4;
    return {
      key: `${r}-${c}`,
      Icon,
      left: c * PATTERN_CELL + (r % 2 ? PATTERN_CELL / 2 : 0) - 10,
      top: r * PATTERN_CELL + 4 + wobble,
      rot: (((r * 7 + c * 11) % 5) - 2) * 10,
    };
  }),
).flat();

function HeroIconPattern() {
  return (
    <div className="hero-icon-wrap" aria-hidden="true">
      <div className="hero-icon-bg">
        {heroPatternItems.map((item) => (
          <item.Icon
            key={item.key}
            className="hero-icon-bg-item"
            size={34}
            strokeWidth={1.55}
            style={{
              left: item.left,
              top: item.top,
              transform: `rotate(${item.rot}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

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
        void useMyLocation().then(() => {
          navigate(pathGyms(lang), { state: { focusOrigin: true } });
        });
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
  const railReveal = useInView<HTMLDivElement>();
  const lajitReveal = useInView<HTMLDivElement>();
  const { openChains, openChain } = useChainPopup();
  const [chains, setChains] = useState<Chain[]>([]);
  const [gymCount, setGymCount] = useState(0);
  const [cityCount, setCityCount] = useState(0);
  const { label, lat, lng, setLocation } = useAppLocation();
  const navigate = useNavigate();
  const { lang, t } = useLang();
  const cityWordFi =
    cityCount === 1 ? "kaupungissa" : "kaupungeissa";
  const homeTitle =
    lang === "fi"
      ? gymCount > 0 && cityCount > 0
        ? `Liikux – ${gymCount} kuntosalia ${cityCount} ${cityWordFi} | etsi sali`
        : "Liikux – yli 1000 kuntosalia Suomessa | etsi sali lähelläsi"
      : gymCount > 0 && cityCount > 0
        ? `Liikux – ${gymCount} gyms in ${cityCount} cities | find a gym`
        : "Liikux – over 1000 gyms in Finland | find a gym near you";
  const homeDescription =
    lang === "fi"
      ? gymCount > 0 && cityCount > 0
        ? `${gymCount} kuntosalia ${cityCount} ${cityWordFi}. Löydä sali lähelläsi, selaa ketjuja ja hintoja kartalla sekä listalla – Liikux, Suomen kuntosalihakemisto.`
        : "Yli 1000 kuntosalia kymmenissä kaupungeissa. Löydä sali lähelläsi, selaa ketjuja ja hintoja kartalla sekä listalla – Liikux, Suomen kuntosalihakemisto."
      : gymCount > 0 && cityCount > 0
        ? `${gymCount} gyms in ${cityCount} cities. Find a gym near you, browse chains and prices on the map and list – Liikux.`
        : "Over 1000 gyms across Finland. Find a gym near you, browse chains and prices on the map and list – Liikux.";
  usePageMeta({
    title: homeTitle,
    description: homeDescription,
    path: lang === "fi" ? "/" : "/en",
  });
  const [addressDraft, setAddressDraft] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const { hits: suggestions, loading: suggestLoading } = useAddressSuggest(
    addressDraft,
    suggestOpen,
    { lat, lng },
  );

  function goBrowseWithPick(item: {
    label: string;
    lat: number;
    lng: number;
  }) {
    flushSync(() => {
      setLocation({ label: item.label, lat: item.lat, lng: item.lng });
    });
    setSuggestOpen(false);
    navigate(pathGymsFromLocation(lang, item.label), {
      replace: true,
      state: { focusOrigin: true },
    });
  }

  useEffect(() => {
    if (label === "Helsinki" || label === "Lähellä minua") {
      setAddressDraft("");
    } else {
      setAddressDraft(label);
    }
  }, [label]);

  const [homeReady, setHomeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [chainData, stats] = await Promise.all([
        fetchChains().catch(() => [] as Chain[]),
        fetchHomeStats().catch(() => ({ gymCount: 0, cityCount: 0 })),
      ]);
      if (cancelled) return;
      setChains(chainData);
      setGymCount(stats.gymCount);
      setCityCount(stats.cityCount);

      const topImages = chainData
        .filter((c) => c.slug !== "muut" && (c.gymCount ?? 0) > 0)
        .slice()
        .sort((a, b) => {
          const diff = (b.gymCount ?? 0) - (a.gymCount ?? 0);
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name, "fi");
        })
        .slice(0, 8)
        .map((c) => c.image);

      await preloadImages(topImages);
      if (cancelled) return;
      setHomeReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listedChains = chains
    .filter((c) => c.slug !== "muut" && (c.gymCount ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      const diff = (b.gymCount ?? 0) - (a.gymCount ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "fi");
    });
  const suositutKetjut = listedChains.slice(0, 8);
  const chainCount = listedChains.length;

  if (!homeReady) {
    return (
      <div className="load-cover">
        <LoadSpin />
      </div>
    );
  }

  return (
    <main className="shell load-reveal">
      <section className="hero">
        <HeroIconPattern />
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
                    const first = suggestions[0];
                    if (first) goBrowseWithPick(first);
                  }
                  if (e.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
                onFocus={() => {
                  if (addressDraft.trim().length >= 3) setSuggestOpen(true);
                }}
                onBlur={() => {
                  setSuggestOpen(false);
                }}
              />
              <LocateButton />
              {suggestOpen && addressDraft.trim().length >= 3 ? (
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
            <Link
              to={pathGymsFromLocation(lang, label)}
              state={{ focusOrigin: true }}
              className="hero-browse"
            >
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

        <div className="hero-bottom">
          <div
            id="suositut"
            className="rail reveal is-in"
            ref={railReveal.ref}
          >
            <h2 className="rail-title">{t("popularInFinland")}</h2>
            {chainCount > 0 ? (
              <button
                type="button"
                className="rail-show-all"
                onClick={() => openChains()}
              >
                {t("showAllChains", { count: chainCount })}
                <span aria-hidden="true">›</span>
              </button>
            ) : null}
            <div className="rail-viewport">
              <div className="rail-track list-pop">
                {suositutKetjut.map((chain, i) => (
                  <button
                    key={chain.id}
                    type="button"
                    className="place-card"
                    style={{
                      animationDelay: `${Math.min(i, 18) * 28}ms`,
                    }}
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
                      <span
                        className="place-card-shine"
                        aria-hidden="true"
                      />
                      <img
                        src={chain.image}
                        alt=""
                        width={160}
                        height={90}
                        loading="eager"
                        decoding="async"
                        fetchPriority={i < 4 ? "high" : "auto"}
                      />
                    </span>
                    <span className="place-card-name">{chain.name}</span>
                  </button>
                ))}
              </div>
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
  );
}

export default HomePage;
