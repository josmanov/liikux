import { useEffect, useRef, useState } from "react";
import { ChevronDown, LocateFixed, MapPin, Search } from "lucide-react";
import { useAppLocation } from "../context/LocationContext";
import { useAddressSuggest, type GeoHit } from "../data/geocode";
import "./AreaSelect.css";
import LoadSpin from "./LoadSpin";

const cities = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu"];

function AreaSelect() {
  const { label, lat, lng, setLocation, useMyLocation } = useAppLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { hits: suggestions, loading } = useAddressSuggest(draft, open, {
    lat,
    lng,
  });

  useEffect(() => {
    if (!open) return;
    setDraft("");
    function close(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("click", close, true);
    return () => window.removeEventListener("click", close, true);
  }, [open]);

  function pickSuggestion(item: GeoHit) {
    setLocation({ label: item.label, lat: item.lat, lng: item.lng });
    setOpen(false);
  }

  function pickCity(name: string) {
    setLocation({ label: name });
    setOpen(false);
  }

  const showSuggestions = draft.trim().length >= 3;

  return (
    <div ref={rootRef} className="area-select" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="area-select-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <MapPin className="area-select-pin" size={16} strokeWidth={2.2} />
        <span className="area-select-label">{label}</span>
        <ChevronDown className="area-select-chevron" size={16} strokeWidth={2.2} />
      </button>

      {open ? (
        <div className="area-select-panel" role="dialog" aria-label="Sijainti">
          <div className="area-select-field">
            <Search className="area-select-field-icon" size={16} strokeWidth={2.2} />
            <input
              className="area-select-input"
              type="text"
              placeholder="Syötä osoite…"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            />
            <button
              type="button"
              className="area-select-locate"
              aria-label="Käytä sijaintiani"
              onClick={() => {
                void useMyLocation().then(() => setOpen(false));
              }}
            >
              <LocateFixed size={16} strokeWidth={2.2} />
            </button>
          </div>

          {showSuggestions ? (
            <ul className="area-select-suggestions" role="listbox">
              {loading && suggestions.length === 0 ? (
                <li className="area-select-hint">
                  <LoadSpin size="sm" />
                </li>
              ) : null}
              {!loading && suggestions.length === 0 ? (
                <li className="area-select-hint">Ei tuloksia</li>
              ) : null}
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => pickSuggestion(item)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="area-select-divider" aria-hidden="true" />

              <ul className="area-select-cities" role="listbox">
                {cities.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={name === label ? "is-on" : ""}
                      role="option"
                      aria-selected={name === label}
                      onClick={() => pickCity(name)}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default AreaSelect;
