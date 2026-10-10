import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { type Chain, type Gym } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import { useChainPopup } from "../context/ChainPopupContext";
import { pathGym } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./HeaderSearch.css";
import LoadSpin from "./LoadSpin";

function HeaderSearch() {
  const navigate = useNavigate();
  const { openChain } = useChainPopup();
  const { lang, t } = useLang();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [chains, setChains] = useState<Chain[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    function sync() {
      setIsMobile(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!expanded || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded, isMobile]);

  function ensureData() {
    if (dataReady) return;
    setDataReady(true);
    fetchGymsAndChains()
      .then(([gymData, chainData]) => {
        setChains(chainData);
        setGyms(gymData);
        setSearchLoaded(true);
      })
      .catch(() => {
        setChains([]);
        setGyms([]);
        setDataReady(false);
      });
  }

  function collapse() {
    setExpanded(false);
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!expanded || isMobile) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        collapse();
      }
    }
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, [expanded, isMobile]);

  useEffect(() => {
    if (expanded) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [expanded, isMobile]);

  const q = query.trim().toLowerCase();
  const chainHits =
    q.length < 1
      ? []
      : chains
          .filter((c) => c.name.toLowerCase().includes(q) && c.slug !== "muut")
          .slice(0, 5);
  const gymHits =
    q.length < 1
      ? []
      : gyms
          .filter(
            (g) =>
              g.name.toLowerCase().includes(q) ||
              g.city.toLowerCase().includes(q) ||
              g.address.toLowerCase().includes(q),
          )
          .slice(0, 8);
  const showPanel = expanded && open && q.length >= 1;
  const hasHits = chainHits.length > 0 || gymHits.length > 0;

  function goFirst() {
    if (chainHits[0]) {
      openChain(chainHits[0].slug);
      collapse();
      return;
    }
    if (gymHits[0]) {
      navigate(pathGym(lang, gymHits[0].slug));
      collapse();
    }
  }

  function openField(e?: MouseEvent) {
    e?.stopPropagation();
    ensureData();
    setExpanded(true);
    setOpen(true);
  }

  function renderHits() {
    if (!showPanel) {
      return (
        <p className="header-search-empty">{t("searchNameOrAddress")}</p>
      );
    }
    if (!searchLoaded) {
      return (
        <div className="load-box">
          <LoadSpin size="sm" />
        </div>
      );
    }
    if (!hasHits) {
      return <p className="header-search-empty">{t("noResults")}</p>;
    }
    return (
      <>
        {chainHits.length > 0 ? (
          <div className="header-search-section">
            <p className="header-search-section-label">{t("chains")}</p>
            <ul className="list-pop">
              {chainHits.map((chain, i) => (
                <li
                  key={chain.id}
                  style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                >
                  <button
                    type="button"
                    className="header-search-hit"
                    onClick={() => {
                      openChain(chain.slug);
                      collapse();
                    }}
                  >
                    {chain.image ? (
                      <img src={chain.image} alt="" />
                    ) : (
                      <span className="header-search-hit-fallback" />
                    )}
                    <span>{chain.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {gymHits.length > 0 ? (
          <div className="header-search-section">
            <p className="header-search-section-label">{t("gymsShort")}</p>
            <ul className="list-pop">
              {gymHits.map((gym, i) => (
                <li
                  key={gym.id}
                  style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
                >
                  <Link
                    to={pathGym(lang, gym.slug)}
                    className="header-search-hit"
                    onClick={() => {
                      collapse();
                    }}
                  >
                    <span className="header-search-hit-fallback" />
                    <span>
                      {gym.name}
                      {gym.city ? ` · ${gym.city}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </>
    );
  }

  const input = (
    <input
      ref={inputRef}
      className="header-search-input"
      type="text"
      placeholder={t("searchShort")}
      aria-label={t("search")}
      value={query}
      tabIndex={expanded ? 0 : -1}
      onChange={(e) => {
        ensureData();
        setQuery(e.target.value);
        setOpen(true);
      }}
      onFocus={() => {
        ensureData();
        setOpen(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          goFirst();
        }
        if (e.key === "Escape") {
          collapse();
        }
      }}
    />
  );

  if (isMobile) {
    return (
      <div className="header-search" ref={wrapRef}>
        <button
          type="button"
          className="header-search-trigger"
          aria-label={t("search")}
          onClick={openField}
        >
          <Search size={20} strokeWidth={2.5} />
        </button>
        {expanded
          ? createPortal(
              <div className="header-search-popup" role="dialog" aria-modal="true">
                <button
                  type="button"
                  className="header-search-popup-bg"
                  aria-label={t("search")}
                  onClick={collapse}
                />
                <div className="header-search-popup-card">
                  <div className="header-search-popup-bar">
                    <Search
                      className="header-search-popup-icon"
                      size={18}
                      strokeWidth={2.5}
                    />
                    {input}
                    <button
                      type="button"
                      className="header-search-popup-close"
                      aria-label={t("closeMenu")}
                      onClick={collapse}
                    >
                      <X size={18} strokeWidth={2.4} />
                    </button>
                  </div>
                  <div className="header-search-popup-list" role="listbox">
                    {renderHits()}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div
      className={expanded ? "header-search is-open" : "header-search"}
      ref={wrapRef}
      onClick={(e) => {
        e.stopPropagation();
        openField(e);
      }}
    >
      <div className="header-search-field">
        <Search className="header-search-icon" size={20} strokeWidth={2.5} />
        {input}
      </div>
      {showPanel ? (
        <div className="header-search-panel" role="listbox">
          {renderHits()}
        </div>
      ) : null}
    </div>
  );
}

export default HeaderSearch;
