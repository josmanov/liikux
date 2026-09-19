import { useEffect, useState } from "react";
import { ChevronDown, LocateFixed, MapPin, Search } from "lucide-react";
import { useAppLocation } from "../context/LocationContext";
import "./AreaSelect.css";

const cities = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu"];

type Suggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

function shortLabel(label: string) {
  if (label.length <= 22) return label;
  return label.slice(0, 20) + "…";
}

function AreaSelect() {
  const { label, setLabel, useMyLocation } = useAppLocation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setSuggestions([]);
    function close() {
      setOpen(false);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = draft.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = window.setTimeout(() => {
      fetch(`http://localhost:3001/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: Suggestion[]) => {
          setSuggestions(Array.isArray(data) ? data : []);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 280);

    return () => window.clearTimeout(t);
  }, [draft, open]);

  function pickSuggestion(item: Suggestion) {
    setLabel(item.label);
    setOpen(false);
  }

  function pickCity(name: string) {
    setLabel(name);
    setOpen(false);
  }

  const showSuggestions = draft.trim().length >= 2;

  return (
    <div className="area-select" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="area-select-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <MapPin className="area-select-pin" size={16} strokeWidth={2.2} />
        <span className="area-select-label">{shortLabel(label)}</span>
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
                if (e.key === "Enter" && suggestions[0]) {
                  pickSuggestion(suggestions[0]);
                }
              }}
            />
            <button
              type="button"
              className="area-select-locate"
              aria-label="Käytä sijaintiani"
              onClick={() => {
                useMyLocation();
                setOpen(false);
              }}
            >
              <LocateFixed size={16} strokeWidth={2.2} />
            </button>
          </div>

          {showSuggestions ? (
            <ul className="area-select-suggestions" role="listbox">
              {loading && suggestions.length === 0 ? (
                <li className="area-select-hint">Haetaan…</li>
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
