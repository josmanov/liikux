import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { type Chain, type Gym } from "../data/types";
import { fetchGymsAndChains } from "../data/api";
import { useChainPopup } from "../context/ChainPopupContext";
import { pathGym } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./HeaderSearch.css";

function HeaderSearch() {
  const navigate = useNavigate();
  const { openChain } = useChainPopup();
  const { lang } = useLang();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [chains, setChains] = useState<Chain[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [dataReady, setDataReady] = useState(false);

  function ensureData() {
    if (dataReady) return;
    setDataReady(true);
    fetchGymsAndChains()
      .then(([gymData, chainData]) => {
        setChains(chainData);
        setGyms(gymData);
      })
      .catch(() => {
        setChains([]);
        setGyms([]);
        setDataReady(false);
      });
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, []);

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
  const showPanel = open && q.length >= 1;
  const hasHits = chainHits.length > 0 || gymHits.length > 0;

  function goFirst() {
    if (chainHits[0]) {
      openChain(chainHits[0].slug);
      setQuery("");
      setOpen(false);
      return;
    }
    if (gymHits[0]) {
      navigate(pathGym(lang, gymHits[0].slug));
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div
      className="header-search"
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
    >
      <Search className="header-search-icon" size={16} strokeWidth={2.2} />
      <input
        className="header-search-input"
        type="search"
        placeholder="Etsi..."
        value={query}
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
            setOpen(false);
          }
        }}
      />

      {showPanel ? (
        <div className="header-search-panel" role="listbox">
          {!hasHits ? (
            <p className="header-search-empty">Ei tuloksia</p>
          ) : (
            <>
              {chainHits.length > 0 ? (
                <div className="header-search-section">
                  <p className="header-search-section-label">Ketjut</p>
                  <ul>
                    {chainHits.map((chain) => (
                      <li key={chain.id}>
                        <button
                          type="button"
                          className="header-search-hit"
                          onClick={() => {
                            openChain(chain.slug);
                            setQuery("");
                            setOpen(false);
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
                  <p className="header-search-section-label">Salit</p>
                  <ul>
                    {gymHits.map((gym) => (
                      <li key={gym.id}>
                        <Link
                          to={pathGym(lang, gym.slug)}
                          className="header-search-hit"
                          onClick={() => {
                            setQuery("");
                            setOpen(false);
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
          )}
        </div>
      ) : null}
    </div>
  );
}

export default HeaderSearch;
