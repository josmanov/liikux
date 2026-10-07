import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import "./ChainPopup.css";
import { type Chain, type Gym } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import { cleanGymDisplayName } from "../data/format";
import { readFavoriteSlugs } from "../data/favorites";
import { pathGym } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import LoadSpin from "./LoadSpin";

type Props = {
  open: boolean;
  onClose: () => void;
};

function FavoritesPopup({ open, onClose }: Props) {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [favReady, setFavReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setFavoriteSlugs(readFavoriteSlugs());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
  const favorites = favoriteSlugs
    .map((slug) => bySlug.get(slug))
    .filter((g): g is Gym => Boolean(g));

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
    <div className="chain-popup-overlay" onClick={onClose}>
      <div className="chain-popup-card" onClick={(e) => e.stopPropagation()}>
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
          <button
            type="button"
            className="chain-popup-close"
            onClick={onClose}
            aria-label="Sulje"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {!favReady ? (
          <div className="load-box">
            <LoadSpin />
          </div>
        ) : (
        <div className="chain-popup-scroll">
        <ul
          className="chain-popup-list load-reveal"
          onScroll={(e) => {
            e.currentTarget.parentElement?.classList.toggle(
              "is-scrolled",
              e.currentTarget.scrollTop > 6,
            );
          }}
        >
          {list.map((gym) => {
            const chain = chainsById.get(gym.chainId);
            const img =
              chain?.image && !chain.image.includes("/pins/")
                ? chain.image
                : "/pins/gym-pin.png";
            return (
              <li key={gym.id}>
                <Link
                  to={pathGym(lang, gym.slug)}
                  className="chain-popup-row"
                  onClick={onClose}
                >
                  <span
                    className={[
                      "chain-popup-media",
                      chain?.logoFit === "contain" ? "is-logo" : "",
                      chain?.logoClass || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <img src={img} alt="" />
                  </span>
                  <div className="chain-popup-text">
                    <strong>{cleanGymDisplayName(gym.name)}</strong>
                    <p className="chain-popup-blurb">
                      {gym.address}
                      {gym.city ? ` · ${gym.city}` : ""}
                    </p>
                  </div>
                </Link>
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
