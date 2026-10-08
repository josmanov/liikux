import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Heart, X } from "lucide-react";
import "./ChainPopup.css";
import AreaSelect from "./AreaSelect";
import { type Chain, type Gym, resolveGymOffer } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import {
  cleanGymDisplayName,
  formatDistanceKm,
  formatPriceFrom,
} from "../data/format";
import { readFavoriteSlugs, writeFavoriteSlugs } from "../data/favorites";
import { useAppLocation } from "../context/LocationContext";
import { pathGym } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import LoadSpin from "./LoadSpin";
import { useLockPageScroll } from "../hooks/useLockPageScroll";

function streetLine(gym: Gym) {
  let street = gym.address || "";
  if (gym.city) {
    street = street
      .replace(new RegExp(`,?\\s*\\d{5}\\s+${gym.city}\\s*$`, "i"), "")
      .replace(new RegExp(`,\\s*${gym.city}\\s*$`, "i"), "")
      .trim();
  }
  return street;
}

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

type Props = {
  open: boolean;
  onClose: () => void;
};

function FavoritesPopup({ open, onClose }: Props) {
  const { lang, t } = useLang();
  const { lat: originLat, lng: originLng } = useAppLocation();
  const [query, setQuery] = useState("");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [sessionSlugs, setSessionSlugs] = useState<string[]>([]);
  const [keptSlugs, setKeptSlugs] = useState<string[]>([]);
  const keptRef = useRef(keptSlugs);
  keptRef.current = keptSlugs;
  const [favReady, setFavReady] = useState(false);

  useLockPageScroll(open);

  useEffect(() => {
    if (!open) return;
    const slugs = readFavoriteSlugs();
    setSessionSlugs(slugs);
    setKeptSlugs(slugs);
  }, [open]);

  function handleClose() {
    const next = keptRef.current;
    writeFavoriteSlugs(next);
    setSessionSlugs(next);
    setKeptSlugs(next);
    onClose();
  }

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFavReady(false);
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
      })
      .finally(() => {
        if (!cancelled) setFavReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const bySlug = new Map(gyms.map((g) => [g.slug, g]));
  const chainsById = new Map(chains.map((c) => [c.id, c]));
  const favorites = sessionSlugs
    .map((slug) => bySlug.get(slug))
    .filter((g): g is Gym => Boolean(g));
  const keptCount = keptSlugs.length;

  const q = query.trim().toLowerCase();
  const list = favorites.filter((g) => {
    if (!q) return true;
    return (
      g.name.toLowerCase().includes(q) ||
      g.city.toLowerCase().includes(q) ||
      g.address.toLowerCase().includes(q)
    );
  });

  return createPortal(
    <div className="chain-popup-overlay is-fav" onClick={handleClose}>
      <div className="chain-popup-card is-fav" onClick={(e) => e.stopPropagation()}>
        <div className="chain-popup-banner">
          <div className="chain-popup-banner-row">
            <h2 className="chain-popup-title">
              {t("favorites")}
              <Heart size={22} strokeWidth={2.4} />
            </h2>
            <button
              type="button"
              className="chain-popup-close"
              onClick={handleClose}
              aria-label="Sulje"
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
                placeholder="Etsi suosikkia..."
                name="searchbar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <AreaSelect />
          </div>
          <p className="chain-popup-sub">
            {t("favoriteCount", { count: keptCount })}
          </p>
        </div>

        {!favReady ? (
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
              {list.map((gym, i) => {
                const chain = chainsById.get(gym.chainId);
                const img =
                  chain?.image && !chain.image.includes("/pins/")
                    ? chain.image
                    : "/pins/gym-pin.png";
                const isPin = img.includes("/pins/");
                const offer = resolveGymOffer(gym, chain ?? null);
                const priceLabel = formatPriceFrom(offer.priceFrom);
                const distKm =
                  originLat != null &&
                  originLng != null &&
                  gym.lat != null &&
                  gym.lng != null
                    ? distanceKm(originLat, originLng, gym.lat, gym.lng)
                    : null;
                return (
                  <li
                    key={gym.id}
                    style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                  >
                    <div className="chain-popup-item">
                      <div className="chain-popup-shot">
                        <Link
                          to={pathGym(lang, gym.slug)}
                          className={[
                            "chain-popup-media",
                            isPin
                              ? "is-pin"
                              : chain?.logoFit === "contain"
                                ? "is-logo"
                                : "",
                            isPin ? "" : chain?.logoClass || "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={handleClose}
                        >
                          <img src={img} alt="" />
                        </Link>
                        <button
                          type="button"
                          className={
                            "chain-popup-fav" +
                            (keptSlugs.includes(gym.slug) ? " is-on" : "")
                          }
                          aria-label={
                            keptSlugs.includes(gym.slug)
                              ? t("removeFavorite")
                              : t("addFavorite")
                          }
                          onClick={() => {
                            setKeptSlugs((cur) =>
                              cur.includes(gym.slug)
                                ? cur.filter((s) => s !== gym.slug)
                                : [...cur, gym.slug],
                            );
                          }}
                        >
                          <Heart size={18} strokeWidth={2.3} />
                        </button>
                      </div>
                      <Link
                        to={pathGym(lang, gym.slug)}
                        className="chain-popup-text"
                        onClick={handleClose}
                      >
                        <strong>{cleanGymDisplayName(gym.name)}</strong>
                        <p className="chain-popup-blurb">{streetLine(gym)}</p>
                        {gym.city ? (
                          <p className="chain-popup-cities">{gym.city}</p>
                        ) : null}
                        <p className="chain-popup-meta">
                          <span>{priceLabel ?? t("priceUnknown")}</span>
                          {distKm != null ? (
                            <span>{formatDistanceKm(distKm)}</span>
                          ) : null}
                        </p>
                      </Link>
                    </div>
                  </li>
                );
              })}
              {list.length === 0 ? (
                <li className="chain-popup-empty">
                  {q
                    ? `Ei suosikkeja haulla “${query}”.`
                    : "Ei suosikkeja vielä. Merkitse sali suosikiksi, niin se näkyy täällä."}
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

export default FavoritesPopup;
