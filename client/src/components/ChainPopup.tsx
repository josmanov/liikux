import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import "./ChainPopup.css";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import { cleanGymDisplayName, formatPriceFrom } from "../data/format";
import { useAppLocation } from "../context/LocationContext";
import { useChainPopup } from "../context/ChainPopupContext";

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

function ChainPopup() {
  const { open, chainSlug, close, openChain } = useChainPopup();
  const location = useAppLocation();
  const [query, setQuery] = useState("");
  const [chains, setChains] = useState<Chain[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    fetchGymsAndChains()
      .then(([gymData, chainData]) => {
        if (cancelled) return;
        setGyms(gymData);
        setChains(chainData);
      })
      .catch(() => {
        if (cancelled) return;
        setGyms([]);
        setChains([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
    return chains.filter((chain) => {
      if (chain.slug === "muut") return false;
      if (!q) return true;
      return chain.name.toLowerCase().includes(q);
    });
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
        <div className="chain-popup-top">
          {showingGyms ? (
            <button
              type="button"
              className="chain-popup-back"
              onClick={() => {
                setSelectedSlug(null);
                setQuery("");
              }}
              aria-label="Takaisin ketjuihin"
            >
              <ArrowLeft size={18} strokeWidth={2.4} />
            </button>
          ) : null}
          <div className="group">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
              <g>
                <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
              </g>
            </svg>
            <input
              className="input"
              type="search"
              placeholder={showingGyms ? "Etsi salia..." : "Etsi ketjua..."}
              name="searchbar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="chain-popup-close"
            onClick={close}
            aria-label="Sulje"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {showingGyms && selectedChain ? (
          <div className="chain-popup-heading">
            <strong>{selectedChain.name}</strong>
            <span>
              {gymList.length} salia
              {location.label ? ` · lähimmät ensin (${location.label})` : ""}
            </span>
          </div>
        ) : null}

        <ul className="chain-popup-list">
          {!showingGyms
            ? chainList.map((chain) => (
                <li key={chain.id}>
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
                        chain.logoFit === "contain" ? "is-logo" : "",
                        chain.logoClass || "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <img src={chain.image} alt="" />
                    </span>
                    <div className="chain-popup-text">
                      <strong>{chain.name}</strong>
                      <p className="chain-popup-blurb">
                        Näytä kaikki ketjun kuntosalit etäisyyden mukaan.
                      </p>
                    </div>
                  </button>
                </li>
              ))
            : gymList.map(({ gym, km }) => {
                const offer = resolveGymOffer(gym, selectedChain);
                const priceLabel = formatPriceFrom(offer.priceFrom);
                const hours =
                  offer.is247 === true
                    ? "24/7"
                    : offer.hoursWeekday || null;
                return (
                  <li key={gym.id}>
                    <Link
                      to={`/fi/sali/${gym.slug}`}
                      className="chain-popup-row"
                      onClick={close}
                    >
                      <span
                        className={[
                          "chain-popup-media",
                          selectedChain?.logoFit === "contain"
                            ? "is-logo"
                            : "",
                          selectedChain?.logoClass || "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <img
                          src={selectedChain?.image || "/pins/gym-pin.png"}
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
                          <span>{priceLabel ?? "Hinta ei tiedossa"}</span>
                          {hours ? <span>{hours}</span> : null}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
          {!showingGyms && chainList.length === 0 ? (
            <li className="chain-popup-empty">
              Ei ketjuja{q ? ` haulla “${query}”` : ""}.
            </li>
          ) : null}
          {showingGyms && gymList.length === 0 ? (
            <li className="chain-popup-empty">
              Ei saleja{q ? ` haulla “${query}”` : ""} tässä ketjussa.
            </li>
          ) : null}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export default ChainPopup;
