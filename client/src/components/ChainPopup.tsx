import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./ChainPopup.css";
import AreaSelect from "./AreaSelect";
import { gymsInCity } from "../data/mockPlaces";

type Props = {
  open: boolean;
  onClose: () => void;
};

function ChainPopup({ open, onClose }: Props) {
  const [area, setArea] = useState("Helsinki");
  const [query, setQuery] = useState("");

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

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const chains = gymsInCity(area).filter((chain) =>
    q ? chain.name.toLowerCase().includes(q) : true,
  );

  return createPortal(
    <div className="chain-popup-overlay" onClick={onClose}>
      <div
        className="chain-popup-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chain-popup-top">
          <AreaSelect value={area} onChange={setArea} />
          <div className="inputBox_container">
            <svg
              className="search_icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path d="M46.599 46.599a4.498 4.498 0 0 1-6.363 0l-7.941-7.941C29.028 40.749 25.167 42 21 42 9.402 42 0 32.598 0 21S9.402 0 21 0s21 9.402 21 21c0 4.167-1.251 8.028-3.342 11.295l7.941 7.941a4.498 4.498 0 0 1 0 6.363zM21 6C12.717 6 6 12.714 6 21s6.717 15 15 15c8.286 0 15-6.714 15-15S29.286 6 21 6z" />
            </svg>
            <input
              className="inputBox"
              type="text"
              placeholder="Etsi ketjua..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <ul className="chain-popup-list">
          {chains.map((chain) => (
            <li key={chain.id} className="chain-popup-row">
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
                <span>{chain.city}</span>
                <p className="chain-popup-blurb">
                  Laaja saliverkosto, ryhmäliikuntaa ja joustavat aukioloajat.
                  Katso ketjun salit kartalla ja vertaa sijainteja alueellasi.
                </p>
              </div>
              <button type="button" className="chain-popup-btn">
                Etsi
              </button>
            </li>
          ))}
          {chains.length === 0 ? (
            <li className="chain-popup-empty">
              Ei ketjuja alueella {area}
              {q ? ` haulla “${query}”` : ""}.
            </li>
          ) : null}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export default ChainPopup;
