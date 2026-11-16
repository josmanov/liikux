import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Search } from "lucide-react";
import LoadSpin from "../components/LoadSpin";
import { useAppLocation } from "../context/LocationContext";
import { fetchGymsAndChains } from "../data/api";
import { cleanGymDisplayName, formatDistanceKm, formatPriceRange } from "../data/format";
import { offerPhrase } from "../data/offerText";
import { type Chain, type Gym, parseMembershipsJson, parseServicesJson, resolveGymOffer } from "../data/types";
import { distanceKm } from "../features/browse/utils/distanceKm";
import { pathChain, pathChains, pathGym, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "../features/home/chain-tiles.css"; // per-chain logo colours and zoom
import "./ChainsPage.css";

/**
 * Chains page (/fi/ketjut, /en/chains).
 *
 *  1. Four numbers about all chains.
 *  2. One panel per chain, in three parts:
 *       - who: small logo, name, gyms and cities, tags, links
 *       - prices: price range, the chain's memberships, what is included
 *       - nearest gyms: the 3 closest gyms of that chain to the user's address
 *
 * Every number is counted from the real gym list. Clicking the chain opens
 * its gyms on the map (/fi/ketju/:slug = the browse page filtered to it).
 */

type SortId = "gyms" | "price" | "near";
type NearGym = { gym: Gym; km: number | null; price: number | null };
type Card = {
  chain: Chain;
  gyms: number;
  cities: number;
  priceMin: number | null;
  priceMax: number | null;
  nearest: NearGym[];
};

const NOT_A_CHAIN = ["muut", "yksityiset"];

function eurText(eur: number) {
  return Number.isInteger(eur) ? String(eur) : String(Number(eur.toFixed(2))).replace(".", ",");
}

/** Smaller number first; cards without a value go last. */
function byNumber(a: number | null | undefined, b: number | null | undefined) {
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
        ? "Vertaa Suomen kuntosaliketjujen hintoja, jäsenyyksiä, salien määrää ja sijainteja. Katso ketjun kaikki salit kartalla."
        : "Compare prices, memberships, gym counts and locations of gym chains in Finland. See every gym of a chain on the map.",
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
    const byId = new Map<string, { chain: Chain; list: NearGym[]; cities: Set<string> }>();
    for (const chain of data.chains) {
      if (!NOT_A_CHAIN.includes(chain.slug)) byId.set(chain.id, { chain, list: [], cities: new Set() });
    }
    let others = 0;
    for (const gym of data.gyms) {
      const row = byId.get(gym.chainId);
      if (!row) {
        others++;
        continue;
      }
      const price = resolveGymOffer(gym, row.chain).priceFrom;
      row.list.push({
        gym,
        price: price != null && price > 0 ? price : null,
        km: hasOrigin && gym.lat != null && gym.lng != null ? distanceKm(placeLat, placeLng, gym.lat, gym.lng) : null,
      });
      if (gym.city) row.cities.add(gym.city.trim().toLowerCase());
    }
    const list: Card[] = [];
    for (const row of byId.values()) {
      if (row.list.length === 0) continue;
      const prices = row.list.map((g) => g.price).filter((p): p is number => p != null);
      list.push({
        chain: row.chain,
        gyms: row.list.length,
        cities: row.cities.size,
        priceMin: prices.length ? Math.min(...prices) : null,
        priceMax: prices.length ? Math.max(...prices) : null,
        nearest: hasOrigin ? [...row.list].sort((a, b) => byNumber(a.km, b.km)).slice(0, 3) : [],
      });
    }
    return { cards: list, otherGyms: others };
  }, [data, hasOrigin, placeLat, placeLng]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards
      .filter((c) => !q || c.chain.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "price") return byNumber(a.priceMin, b.priceMin) || b.gyms - a.gyms;
        if (sort === "near") return byNumber(a.nearest[0]?.km, b.nearest[0]?.km) || b.gyms - a.gyms;
        return b.gyms - a.gyms || a.chain.name.localeCompare(b.chain.name, "fi");
      });
  }, [cards, query, sort]);

  // The four numbers at the top.
  const cheapest = [...cards].sort((a, b) => byNumber(a.priceMin, b.priceMin))[0];
  const totals = {
    chains: cards.length,
    gyms: cards.reduce((sum, c) => sum + c.gyms, 0),
    open247: cards.filter((c) => c.chain.is247).length,
  };

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
      ) : (
        <>
          {/* 1. Numbers */}
          <dl className="chains-stats">
            <div>
              <dd>{totals.chains}</dd>
              <dt>{t("chainsStatChains")}</dt>
            </div>
            <div>
              <dd>{totals.gyms}</dd>
              <dt>{t("chainsStatGyms")}</dt>
            </div>
            {cheapest?.priceMin != null ? (
              <div>
                <dd>{eurText(cheapest.priceMin)} €</dd>
                <dt>{t("chainsStatCheapest", { chain: cheapest.chain.name })}</dt>
              </div>
            ) : null}
            <div>
              <dd>{totals.open247}</dd>
              <dt>{t("chainsStat247")}</dt>
            </div>
          </dl>

          {/* 2. One panel per chain */}
          {shown.length === 0 ? <p className="chains-empty">{t("noResults")}</p> : null}
          <div className="chains-list">
            {shown.map((c) => {
              const { chain } = c;
              const chainPath = pathChain(lang, chain.slug);
              const price = formatPriceRange(c.priceMin, c.priceMax, lang);
              const memberships = parseMembershipsJson(chain.membershipsJson).slice(0, 4);
              const services = parseServicesJson(chain.servicesJson).slice(0, 5);
              return (
                <article key={chain.id} className="chains-row">
                  {/* who */}
                  <div className="chains-who">
                    <Link
                      className={["chain-tile-img chains-logo", chain.logoFit === "contain" ? "is-contain" : "", chain.logoClass || ""]
                        .filter(Boolean)
                        .join(" ")}
                      to={chainPath}
                      aria-label={chain.name}
                    >
                      <img src={chain.image} alt="" width={160} height={100} loading="lazy" decoding="async" />
                    </Link>
                    <div className="chains-who-text">
                      <h2>
                        <Link to={chainPath}>{chain.name}</Link>
                      </h2>
                      <p>{t("chainsCount", { gyms: c.gyms, cities: c.cities })}</p>
                      {chain.is247 || chain.freeTrial || chain.dayPass ? (
                        <ul className="chains-tags">
                          {chain.is247 ? <li>24/7</li> : null}
                          {chain.freeTrial ? <li>{t("freeTrial")}</li> : null}
                          {chain.dayPass ? <li>{t("priceDayPass")}</li> : null}
                        </ul>
                      ) : null}
                    </div>
                    <div className="chains-links">
                      <Link className="btn btn-soft" to={chainPath}>
                        {t("chainsOnMap", { count: c.gyms })}
                        <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                      </Link>
                      {chain.website ? (
                        <a className="chains-site" href={chain.website} target="_blank" rel="noreferrer">
                          {t("chainsWebsite")}
                          <ArrowUpRight size={14} strokeWidth={2.4} aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* prices */}
                  <div className="chains-col">
                    <h3>{t("chainsPrices")}</h3>
                    <p className={price ? "chains-price" : "chains-price is-unknown"}>{price ?? t("chainsPriceVaries")}</p>
                    {memberships.length > 0 ? (
                      <ul className="chains-rows">
                        {memberships.map((m) => (
                          <li key={m.name}>
                            <span>{offerPhrase(lang, m.name)}</span>
                            <strong>{typeof m.priceEur === "number" ? `${eurText(m.priceEur)} €` : "–"}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {services.length > 0 ? (
                      <ul className="chains-services">
                        {services.map((s) => (
                          <li key={s}>
                            <Check size={13} strokeWidth={2.8} aria-hidden="true" />
                            {offerPhrase(lang, s)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  {/* nearest gyms */}
                  {c.nearest.length > 0 ? (
                    <div className="chains-col">
                      <h3>{t("chainsNearGyms")}</h3>
                      <ul className="chains-rows chains-near">
                        {c.nearest.map((n) => (
                          <li key={n.gym.slug}>
                            <Link to={pathGym(lang, n.gym.slug)}>
                              <span>{cleanGymDisplayName(n.gym.name)}</span>
                              <em>
                                {n.price != null ? `${eurText(n.price)} € · ` : ""}
                                {n.km != null ? formatDistanceKm(n.km) : n.gym.city}
                              </em>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {otherGyms > 0 ? (
            <p className="chains-others">
              {t("chainsOthers", { count: otherGyms })}{" "}
              <Link to={pathGymsFromLocation(lang, placeLabel)}>
                {t("browseGyms")}
                <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}

export default ChainsPage;
