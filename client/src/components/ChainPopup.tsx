import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import "./ChainPopup.css";
import { type Chain } from "../data/types";

type Props = {
  open: boolean;
  onClose: () => void;
};

function ChainPopup({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [chains, setChains] = useState<Chain[]>([]);

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
    }
  }, [open]);

  useEffect(() => {
    fetch("http://localhost:3001/api/chains")
      .then((r) => r.json())
      .then((data: Chain[]) => setChains(data))
      .catch(() => setChains([]));
  }, []);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const list = chains.filter((chain) => {
    if (chain.slug === "muut") return false;
    if (!q) return true;
    return chain.name.toLowerCase().includes(q);
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
              placeholder="Etsi ketjua..."
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

        <ul className="chain-popup-list">
          {list.map((chain) => (
            <li key={chain.id}>
              <Link
                to={`/fi/ketju/${chain.slug}`}
                className="chain-popup-row"
                onClick={onClose}
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
                    Laaja saliverkosto, ryhmäliikuntaa ja joustavat aukioloajat.
                    Katso ketjun salit kartalla ja vertaa sijainteja alueellasi.
                  </p>
                </div>
              </Link>
            </li>
          ))}
          {list.length === 0 ? (
            <li className="chain-popup-empty">
              Ei ketjuja{q ? ` haulla “${query}”` : ""}.
            </li>
          ) : null}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export default ChainPopup;
