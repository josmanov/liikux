import "./HomePage.css";
import "../features/home/chain-tiles.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Clock, Dumbbell, Euro, Gift, Heart, MapPin, Scale } from "lucide-react";
import HomeSearch from "../features/home/HomeSearch";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { fetchChains, fetchGyms, fetchHomeStats } from "../data/api";
import { CITY_CENTERS } from "../data/citySlug";
import { formatPriceFrom } from "../data/format";
import { useAppLocation } from "../context/LocationContext";
import { pathChain, pathChains, pathGyms, pathGymsCity, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";

/**
 * Home page, top to bottom:
 *  1. Hero (centered): headline, address search, "or browse", city chips
 *  2. Numbers from the real data (each one opens browse with that filter)
 *  3. "How it works" in three steps
 *  4. Popular chains as brand tiles (click → that chain on the map)
 *  5. Gyms by city
 *  6. Call to action
 */

const QUICK_CITIES = ["helsinki", "espoo", "vantaa", "tampere", "turku", "oulu"];

function useHomeData() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [cityCount, setCityCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchChains().then((c) => alive && setChains(c));
    fetchHomeStats().then((s) => alive && setCityCount(s.cityCount));
    fetchGyms().then((g) => alive && setGyms(g));
    return () => {
      alive = false;
    };
  }, []);

  const listedChains = useMemo(
    () =>
      chains
        .filter((c) => c.slug !== "muut" && (c.gymCount ?? 0) > 0)
        .sort((a, b) => (b.gymCount ?? 0) - (a.gymCount ?? 0) || a.name.localeCompare(b.name, "fi")),
    [chains],
  );

  // Real numbers from the gym list: 24/7 gyms, free trials, average price.
  const numbers = useMemo(() => {
    let open247 = 0;
    let trial = 0;
    let priceSum = 0;
    let priced = 0;
    for (const g of gyms) {
      const offer = resolveGymOffer(g, g.chain);
      if (offer.is247) open247++;
      if (offer.freeTrial) trial++;
      if (offer.priceFrom != null && offer.priceFrom > 0) {
        priceSum += offer.priceFrom;
        priced++;
      }
    }
    return {
      gyms: gyms.length,
      open247,
      trial,
      avgPrice: priced > 0 ? Math.round(priceSum / priced) : null,
    };
  }, [gyms]);

  // Count gyms per known city, biggest first.
  const cities = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of gyms) {
      const key = g.city.trim().toLowerCase();
      count.set(key, (count.get(key) ?? 0) + 1);
    }
    return CITY_CENTERS.map((c) => ({ ...c, count: count.get(c.name.toLowerCase()) ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [gyms]);

  return {
    topChains: listedChains.slice(0, 6),
    chainCount: listedChains.length,
    cities,
    numbers,
    cityCount,
  };
}

function HomePage() {
  const { lang, t } = useLang();
  const { label } = useAppLocation();
  const { topChains, chainCount, cities, numbers, cityCount } = useHomeData();
  const gymsText = numbers.gyms > 0 ? String(numbers.gyms) : lang === "fi" ? "yli 1000" : "over 1,000";
  const browsePath = pathGymsFromLocation(lang, label);
  const dash = "–";

  usePageMeta({
    title:
      lang === "fi"
        ? "Liikux – vertaa kuntosaleja, hintoja ja kokeiluja | etsi sali lähelläsi"
        : "Liikux – compare gyms, prices and free trials in Finland",
    description:
      lang === "fi"
        ? `Vertaa ${gymsText} kuntosalin hintoja, ilmaisia kokeiluja ja aukioloaikoja kartalla. Löydä sali kotisi tai työpaikkasi läheltä – Liikux.`
        : `Compare prices, free trials and opening hours of ${gymsText} gyms in Finland on a map – Liikux.`,
    path: lang === "fi" ? "/" : "/en",
  });

  return (
    <main className="home load-reveal">
      {/* 1. Hero */}
      <section className="home-hero">
        <div className="home-wrap home-hero-inner">
          <h1 className="home-title">
            {t("homeTitle")} <span className="home-title-accent">{t("homeTitleAccent")}</span>
          </h1>
          <p className="home-lead">{t("homeLead", { gyms: gymsText })}</p>
          <HomeSearch />
          <div className="home-quick">
            {QUICK_CITIES.map((slug) => {
              const city = CITY_CENTERS.find((c) => c.slug === slug)!;
              return (
                <Link key={slug} className="chip" to={pathGymsCity(lang, slug)}>
                  <MapPin size={14} strokeWidth={2.2} aria-hidden="true" />
                  {city.name}
                </Link>
              );
            })}
          </div>
          <Link className="home-browse-all" to={browsePath} state={{ focusOrigin: true }}>
            {t("homeBrowseAll")}
            <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
        <button
          type="button"
          className="home-scroll"
          aria-label={lang === "fi" ? "Näytä lisää" : "Show more"}
          onClick={() => document.getElementById("home-more")?.scrollIntoView({ behavior: "smooth" })}
        >
          <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </section>

      {/* 2. Numbers — each opens browse with that filter */}
      <section className="home-wrap">
        <div className="home-stats" id="home-more">
          <Link className="home-stat" to={pathGyms(lang)}>
            <Dumbbell className="home-stat-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
            <strong>{numbers.gyms || dash}</strong>
            <span>{t("homeStatGyms", { cities: cityCount || dash })}</span>
          </Link>
          <Link className="home-stat" to={`${browsePath}?247=1`}>
            <Clock className="home-stat-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
            <strong>{numbers.open247 || dash}</strong>
            <span>{t("homeStat247")}</span>
          </Link>
          <Link className="home-stat" to={`${browsePath}?trial=1`}>
            <Gift className="home-stat-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
            <strong>{numbers.trial || dash}</strong>
            <span>{t("homeStatTrial")}</span>
          </Link>
          <Link className="home-stat" to={`${browsePath}?sort=price-asc`}>
            <Euro className="home-stat-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
            <strong>{numbers.avgPrice != null ? `${numbers.avgPrice} €` : dash}</strong>
            <span>{t("homeStatAvg")}</span>
          </Link>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-h2">{t("homeHowTitle")}</h2>
          <ol className="home-steps">
            <li className="home-step">
              <span className="home-step-num">1</span>
              <MapPin className="home-step-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
              <h3>{t("homeStep1Title")}</h3>
              <p>{t("homeStep1Text")}</p>
            </li>
            <li className="home-step">
              <span className="home-step-num">2</span>
              <Scale className="home-step-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
              <h3>{t("homeStep2Title")}</h3>
              <p>{t("homeStep2Text")}</p>
            </li>
            <li className="home-step">
              <span className="home-step-num">3</span>
              <Heart className="home-step-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
              <h3>{t("homeStep3Title")}</h3>
              <p>{t("homeStep3Text")}</p>
            </li>
          </ol>
        </div>
      </section>

      {/* 4. Popular chains */}
      <section className="home-section">
        <div className="home-wrap">
          <div className="home-section-head">
            <div>
              <h2 className="home-h2">{t("homeChainsTitle")}</h2>
              <p className="home-sub">{t("homeChainsLead")}</p>
            </div>
            {chainCount > 0 ? (
              <Link className="btn btn-ghost" to={pathChains(lang)}>
                {t("showAllChains", { count: chainCount })}
                <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <div className="home-chains">
            {topChains.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="chain-tile is-skeleton" aria-hidden="true" />
                ))
              : topChains.map((chain) => (
                  <Link key={chain.id} className="chain-tile" to={pathChain(lang, chain.slug)}>
                    <span className={["chain-tile-img", chain.logoFit === "contain" ? "is-contain" : "", chain.logoClass || ""].filter(Boolean).join(" ")}>
                      <img src={chain.image} alt="" width={320} height={200} loading="lazy" decoding="async" />
                    </span>
                    <span className="chain-tile-body">
                      <span className="chain-tile-name">{chain.name}</span>
                      <span className="chain-tile-meta">
                        {t("homeChainGyms", { count: chain.gymCount ?? 0 })}
                        {chain.priceFrom != null ? ` · ${formatPriceFrom(chain.priceFrom, lang)}` : ""}
                      </span>
                    </span>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* 5. Cities */}
      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-h2">{t("homeCitiesTitle")}</h2>
          <div className="home-cities">
            {cities.map((c) => (
              <Link key={c.slug} className="city-link" to={pathGymsCity(lang, c.slug)}>
                <span className="city-link-name">{c.name}</span>
                <span className="city-link-count">{t("homeCityGyms", { count: c.count })}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Call to action */}
      <section className="home-section">
        <div className="home-wrap">
          <div className="home-cta">
            <div>
              <h2 className="home-h2">{t("homeCtaTitle")}</h2>
              <p className="home-sub">{t("homeCtaText")}</p>
            </div>
            <Link className="btn btn-dark" to={browsePath} state={{ focusOrigin: true }}>
              {t("browseGyms")}
              <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
