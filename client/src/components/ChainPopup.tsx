import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import "./ChainPopup.css";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { fetchChains, fetchChainGyms, fetchGyms } from "../data/api";
import { cleanGymDisplayName, formatPriceFrom } from "../data/format";
import { useAppLocation } from "../context/LocationContext";
import { useChainPopup } from "../context/ChainPopupContext";
import { pathGym } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import LoadSpin from "./LoadSpin";
import { useLockPageScroll } from "../hooks/useLockPageScroll";

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatKm(km: number) {
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

function statsByChain(rows: Gym[]) {
  const map = new Map<string, { gyms: number; cities: Set<string> }>();
  for (const g of rows) {
    let row = map.get(g.chainId);
    if (!row) {
      row = { gyms: 0, cities: new Set() };
      map.set(g.chainId, row);
    }
    row.gyms += 1;
    const city = g.city.trim().toLowerCase();
    if (city) row.cities.add(city);
  }
  const out: Record<string, { gyms: number; cities: number }> = {};
  for (const [id, row] of map) {
    out[id] = { gyms: row.gyms, cities: row.cities.size };
  }
  return out;
}

function ChainPopup() {
  const { open, chainSlug, close, openChain } = useChainPopup();
  const location = useAppLocation();
  const { lang, t } = useLang();
  const [query, setQuery] = useState("");
  const [chains, setChains] = useState<Chain[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chainStats, setChainStats] = useState<
    Record<string, { gyms: number; cities: number }>
  >({});
  const [chainsReady, setChainsReady] = useState(false);
  const [gymsReady, setGymsReady] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  useLockPageScroll(open);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedSlug(null);
      return;
    }
    setSelectedSlug(chainSlug);
    setQuery("");
  }, [open, chainSlug]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([fetchChains(), fetchGyms()])
      .then(([chainData, gymData]) => {
        if (cancelled) return;
        setChains(chainData);
        setChainStats(statsByChain(gymData));
      })
      .catch(() => {
        if (cancelled) return;
        setChains([]);
        setChainStats({});
      })
      .finally(() => {
        if (!cancelled) setChainsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedSlug) {
      setGyms([]);
      setGymsReady(true);
      return;
    }
    let cancelled = false;
    setGymsReady(false);
    fetchChainGyms(selectedSlug)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setGyms([]);
          return;
        }
        setGyms(data.gyms);
        setChains((prev) => {
          const exists = prev.some((c) => c.id === data.chain.id);
          if (exists) {
            return prev.map((c) => (c.id === data.chain.id ? data.chain : c));
          }
          return [...prev, data.chain];
        });
      })
      .catch(() => {
        if (cancelled) return;
        setGyms([]);
      })
      .finally(() => {
        if (!cancelled) setGymsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedSlug]);

  const selectedChain = useMemo(
    () =>
      selectedSlug
        ? chains.find((c) => c.slug === selectedSlug) ?? null
        : null,
    [chains, selectedSlug],
  );

  const origin =
    location.lat != null && location.lng != null
      ? { lat: location.lat, lng: location.lng }
      : null;

  const q = query.trim().toLowerCase();

  const chainList = useMemo(() => {
    const list = chains.filter((chain) => {
      if (!q) return true;
      const name =
        chain.slug === "muut" ? "muut kuntosalit" : chain.name.toLowerCase();
      return name.includes(q) || chain.name.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      if (a.slug === "muut") return 1;
      if (b.slug === "muut") return -1;
      return a.name.localeCompare(b.name, "fi");
    });
    return list;
  }, [chains, q]);

  const gymList = useMemo(() => {
    if (!selectedChain) return [];
    const rows = gyms
      .filter((g) => g.chainId === selectedChain.id)
      .filter((g) => {
        if (!q) return true;
        return (
          g.name.toLowerCase().includes(q) ||
          g.city.toLowerCase().includes(q) ||
          g.address.toLowerCase().includes(q)
        );
      })
      .map((g) => {
        const km =
          origin && g.lat != null && g.lng != null
            ? distanceKm(origin.lat, origin.lng, g.lat, g.lng)
            : null;
        return { gym: g, km };
      });
    rows.sort((a, b) => {
      if (a.km == null && b.km == null) {
        return a.gym.name.localeCompare(b.gym.name, "fi");
      }
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
    return rows;
  }, [gyms, selectedChain, q, origin]);

  if (!open) return null;

  const showingGyms = Boolean(selectedChain);

  return createPortal(
    <div className="chain-popup-overlay" onClick={close}>
      <div className="chain-popup-card" onClick={(e) => e.stopPropagation()}>
        <div className="chain-popup-banner">
          <div className="chain-popup-banner-row">
            {showingGyms ? (
              <button
                type="button"
                className="chain-popup-back"
                onClick={() => {
                  setSelectedSlug(null);
                  setQuery("");
                }}
                aria-label={t("backToChains")}
              >
                <ArrowLeft size={18} strokeWidth={2.4} />
              </button>
            ) : null}
            <h2 className="chain-popup-title">
              {showingGyms && selectedChain
                ? selectedChain.slug === "muut"
                  ? t("otherGyms")
                  : selectedChain.name
                : t("allGymChains")}
            </h2>
            <button
              type="button"
              className="chain-popup-close"
              onClick={close}
              aria-label={t("close")}
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
          <div className="chain-popup-top">
            <div className="group">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
                <g>
                  <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
                </g>
              </svg>
              <input
                className="input"
                type="search"
                placeholder={showingGyms ? t("gymSearch") : t("chainSearch")}
                name="searchbar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {showingGyms && selectedChain ? (
            <p className="chain-popup-sub">
              {t("gymsCount", { count: gymList.length })}
              {location.label
                ? ` ${t("nearestFirstAt", { label: location.label })}`
                : ""}
            </p>
          ) : null}
        </div>

        {!chainsReady || (showingGyms && !gymsReady) ? (
          <div className="load-box">
            <LoadSpin />
          </div>
        ) : (
        <div className="chain-popup-scroll">
        <ul
          className="chain-popup-list load-reveal list-pop"
          onScroll={(e) => {
            e.currentTarget.parentElement?.classList.toggle(
              "is-scrolled",
              e.currentTarget.scrollTop > 6,
            );
          }}
        >
          {!showingGyms
            ? chainList.map((chain, i) => (
                <li
                  key={chain.id}
                  style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                >
                  <button
                    type="button"
                    className="chain-popup-row"
                    onClick={() => {
                      openChain(chain.slug);
                      setSelectedSlug(chain.slug);
                      setQuery("");
                    }}
                  >
                    <span
                      className={[
                        "chain-popup-media",
                        chain.image?.includes("/pins/")
                          ? "is-pin"
                          : chain.logoFit === "contain"
                            ? "is-logo"
                            : "",
                        chain.image?.includes("/pins/")
                          ? ""
                          : chain.logoClass || "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <img src={chain.image || "/pins/gym-pin.png"} alt="" />
                    </span>
                    <div className="chain-popup-text">
                      <strong>
                        {chain.slug === "muut"
                          ? t("otherGyms")
                          : chain.name}
                      </strong>
                      <p className="chain-popup-blurb">
                        {(chainStats[chain.id]?.gyms ?? 0) === 1
                          ? t("chainGymCountOne")
                          : t("chainGymCount", {
                              count: chainStats[chain.id]?.gyms ?? 0,
                            })}
                      </p>
                      <p className="chain-popup-cities">
                        {(chainStats[chain.id]?.cities ?? 0) === 1
                          ? t("chainCityCountOne")
                          : t("chainCityCount", {
                              count: chainStats[chain.id]?.cities ?? 0,
                            })}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            : gymList.map(({ gym, km }, i) => {
                const offer = resolveGymOffer(gym, selectedChain);
                const priceLabel = formatPriceFrom(offer.priceFrom, lang);
                const hours =
                  offer.is247 === true
                    ? "24/7"
                    : offer.hoursWeekday || null;
                return (
                  <li
                    key={gym.id}
                    style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                  >
                    <Link
                      to={pathGym(lang, gym.slug)}
                      className="chain-popup-row"
                      onClick={close}
                    >
                      <span
                        className={[
                          "chain-popup-media",
                          selectedChain?.image?.includes("/pins/")
                            ? "is-pin"
                            : selectedChain?.logoFit === "contain"
                              ? "is-logo"
                              : "",
                          selectedChain?.image?.includes("/pins/")
                            ? ""
                            : selectedChain?.logoClass || "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <img
                          src={
                            selectedChain?.image &&
                            !selectedChain.image.includes("/pins/")
                              ? selectedChain.image
                              : "/pins/gym-pin.png"
                          }
                          alt=""
                        />
                      </span>
                      <div className="chain-popup-text">
                        <strong>{cleanGymDisplayName(gym.name)}</strong>
                        <p className="chain-popup-blurb">
                          {gym.address}
                          {gym.city ? ` · ${gym.city}` : ""}
                        </p>
                        <p className="chain-popup-meta">
                          {km != null ? <span>{formatKm(km)}</span> : null}
                          <span>{priceLabel ?? t("priceUnknown")}</span>
                          {hours ? <span>{hours}</span> : null}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
          {!showingGyms && chainList.length === 0 ? (
            <li className="chain-popup-empty">
              {q ? t("noChainsQuery", { q: query }) : t("noChains")}
            </li>
          ) : null}
          {showingGyms && gymList.length === 0 ? (
            <li className="chain-popup-empty">
              {q
                ? t("noGymsInChainQuery", { q: query })
                : t("noGymsInChain")}
            </li>
          ) : null}
        </ul>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default ChainPopup;
