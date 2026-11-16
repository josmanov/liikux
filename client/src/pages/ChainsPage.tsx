import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import LoadSpin from "../components/LoadSpin";
import { useAppLocation } from "../context/LocationContext";
import { fetchGymsAndChains } from "../data/api";
import { formatDistanceKm, formatPriceRange } from "../data/format";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { distanceKm } from "../features/browse/utils/distanceKm";
import { pathChain, pathChains, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "../features/home/chain-tiles.css"; // per-chain logo colours and zoom
import "./ChainsPage.css";

/**
 * Chains page (/fi/ketjut, /en/chains): every gym chain as a card.
 *
 * Each card shows numbers counted from the real gym list: how many gyms and
 * cities, the price range, and how far the nearest one is from the user's
 * address. Clicking a card opens that chain's gyms on the map
 * (/fi/ketju/:slug, which is the browse page filtered to the chain).
 */

type SortId = "gyms" | "price" | "near";
type Card = {
  chain: Chain;
  gyms: number;
  cities: number;
  priceMin: number | null;
  priceMax: number | null;
  nearestKm: number | null;
};

const NOT_A_CHAIN = ["muut", "yksityiset"];

/** Smaller number first; cards without a value go last. */
function byNumber(a: number | null, b: number | null) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a - b;
}

function ChainsPage() {
  const { lang, t } = useLang();
  const { label: placeLabel, lat: placeLat, lng: placeLng } = useAppLocation();
  const [data, setData] = useState<{ gyms: Gym[]; chains: Chain[] } | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("gyms");

  usePageMeta({
    title: lang === "fi" ? "Kuntosaliketjut – hinnat ja salit | Liikux" : "Gym chains in Finland – prices and gyms | Liikux",
    description:
      lang === "fi"
        ? "Vertaa Suomen kuntosaliketjujen hintoja, salien määrää ja sijainteja. Katso ketjun kaikki salit kartalla."
        : "Compare prices, gym counts and locations of gym chains in Finland. See every gym of a chain on the map.",
    path: pathChains(lang),
  });

  useEffect(() => {
    let alive = true;
    fetchGymsAndChains().then(([gyms, chains]) => alive && setData({ gyms, chains }));
    return () => {
      alive = false;
    };
  }, []);

  const hasOrigin = placeLat != null && placeLng != null;

  // Count everything per chain from the gym list.
  const { cards, otherGyms } = useMemo(() => {
    if (!data) return { cards: [] as Card[], otherGyms: 0 };
    const byId = new Map<string, Card & { citySet: Set<string> }>();
    for (const chain of data.chains) {
      if (NOT_A_CHAIN.includes(chain.slug)) continue;
      byId.set(chain.id, { chain, gyms: 0, cities: 0, priceMin: null, priceMax: null, nearestKm: null, citySet: new Set() });
    }
    let others = 0;
    for (const gym of data.gyms) {
      const card = byId.get(gym.chainId);
      if (!card) {
        others++;
        continue;
      }
      card.gyms++;
      if (gym.city) card.citySet.add(gym.city.trim().toLowerCase());
      const price = resolveGymOffer(gym, card.chain).priceFrom;
      if (price != null && price > 0) {
        card.priceMin = card.priceMin == null ? price : Math.min(card.priceMin, price);
        card.priceMax = card.priceMax == null ? price : Math.max(card.priceMax, price);
      }
      if (hasOrigin && gym.lat != null && gym.lng != null) {
        const km = distanceKm(placeLat, placeLng, gym.lat, gym.lng);
        card.nearestKm = card.nearestKm == null ? km : Math.min(card.nearestKm, km);
      }
    }
    const list = [...byId.values()].filter((c) => c.gyms > 0).map(({ citySet, ...c }) => ({ ...c, cities: citySet.size }));
    return { cards: list, otherGyms: others };
  }, [data, hasOrigin, placeLat, placeLng]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards
      .filter((c) => !q || c.chain.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "price") return byNumber(a.priceMin, b.priceMin) || b.gyms - a.gyms;
        if (sort === "near") return byNumber(a.nearestKm, b.nearestKm) || b.gyms - a.gyms;
        return b.gyms - a.gyms || a.chain.name.localeCompare(b.chain.name, "fi");
      });
  }, [cards, query, sort]);

  const sorts: { id: SortId; text: string }[] = [
    { id: "gyms", text: t("chainsSortGyms") },
    { id: "price", text: t("chainsSortPrice") },
    ...(hasOrigin ? [{ id: "near" as const, text: t("chainsSortNear") }] : []),
  ];

  return (
    <main className="chains load-reveal">
      <header className="chains-head">
        <div>
          <h1 className="chains-title">{t("chainsTitle")}</h1>
          <p className="chains-lead">{t("chainsLead")}</p>
        </div>
        <div className="chains-tools">
          <label className="chains-search">
            <Search size={17} strokeWidth={2.3} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={t("chainSearch")}
              aria-label={t("chainSearch")}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="chains-sort" role="group">
            {sorts.map((s) => (
              <button
                key={s.id}
                type="button"
                className={sort === s.id ? "chip is-on" : "chip"}
                aria-pressed={sort === s.id}
                onClick={() => setSort(s.id)}
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      </header>

      {data == null ? (
        <div className="chains-loading">
          <LoadSpin />
        </div>
      ) : shown.length === 0 ? (
        <p className="chains-empty">{t("noResults")}</p>
      ) : (
        <div className="chains-grid">
          {shown.map((c) => {
            const { chain } = c;
            const price = formatPriceRange(c.priceMin, c.priceMax, lang);
            return (
              <Link key={chain.id} className="chains-card" to={pathChain(lang, chain.slug)}>
                <span
                  className={["chain-tile-img", chain.logoFit === "contain" ? "is-contain" : "", chain.logoClass || ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <img src={chain.image} alt="" width={320} height={200} loading="lazy" decoding="async" />
                </span>
                <span className="chains-card-body">
                  <span className="chains-card-name">{chain.name}</span>
                  <span className="chains-card-count">{t("chainsCount", { gyms: c.gyms, cities: c.cities })}</span>
                  <span className={price ? "chains-card-price" : "chains-card-price is-unknown"}>
                    {price ?? t("chainsPriceVaries")}
                  </span>
                  <span className="chains-card-foot">
                    <span className="chains-card-tags">
                      {chain.is247 ? <em>24/7</em> : null}
                      {chain.freeTrial ? <em>{t("freeTrial")}</em> : null}
                    </span>
                    {c.nearestKm != null ? (
                      <span className="chains-card-near">{t("chainsNearest", { km: formatDistanceKm(c.nearestKm) })}</span>
                    ) : null}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {data != null && otherGyms > 0 ? (
        <p className="chains-others">
          {t("chainsOthers", { count: otherGyms })}{" "}
          <Link to={pathGymsFromLocation(lang, placeLabel)}>
            {t("browseGyms")}
            <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </p>
      ) : null}
    </main>
  );
}

export default ChainsPage;
