import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LocateFixed, MapPin, Search } from "lucide-react";
import { useAppLocation } from "../context/LocationContext";
import { fetchGyms } from "../data/api";
import { useAddressSuggest, type GeoHit } from "../data/geocode";
import { pathGyms, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./AreaSelect.css";
import LoadSpin from "./LoadSpin";

const cities = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu"];

function AreaSelect({
  variant = "default",
}: {
  variant?: "default" | "combo";
}) {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { label, lat, lng, setLocation, useMyLocation } = useAppLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [cityCounts, setCityCounts] = useState<Record<string, number> | null>(
    null,
  );
  const { hits: suggestions, loading } = useAddressSuggest(draft, open, {
    lat,
    lng,
  });
  const shortLabel = label.includes(",")
    ? label.split(",")[0].trim()
    : label;

  useEffect(() => {
    fetchGyms().then((gyms) => {
      const next: Record<string, number> = {};
      for (const name of cities) next[name] = 0;
      for (const gym of gyms) {
        const city = gym.city.trim().toLowerCase();
        const key = cities.find((name) => name.toLowerCase() === city);
        if (key) next[key] += 1;
      }
      setCityCounts(next);
    });
  }, []);

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

  function goBrowse(placeLabel: string) {
    setOpen(false);
    const onGyms = /^\/(fi|en)\/(kuntosalit|gyms)/.test(
      routeLocation.pathname,
    );
    navigate(
      {
        pathname: pathGymsFromLocation(lang, placeLabel),
        search: onGyms ? routeLocation.search : "",
      },
      {
        replace: true,
        state: { focusOrigin: true },
      },
    );
  }

  function pickSuggestion(item: GeoHit) {
    flushSync(() => {
      setLocation({ label: item.label, lat: item.lat, lng: item.lng });
    });
    goBrowse(item.label);
  }

  function pickCity(name: string) {
    flushSync(() => {
      setLocation({ label: name });
    });
    goBrowse(name);
  }

  const showSuggestions = draft.trim().length >= 3;

  return (
    <div
      ref={rootRef}
      className={
        variant === "combo" ? "area-select is-combo" : "area-select"
      }
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={
          variant === "combo" ? "area-select-btn is-combo" : "area-select-btn"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <MapPin className="area-select-pin" size={16} strokeWidth={2.2} />
        <span className="area-select-label">
          {variant === "combo" ? shortLabel : label}
        </span>
        <ChevronDown className="area-select-chevron" size={16} strokeWidth={2.2} />
      </button>

      {open ? (
        <div className="area-select-panel" role="dialog" aria-label={t("location")}>
          <div className="area-select-field">
            <Search className="area-select-field-icon" size={16} strokeWidth={2.2} />
            <input
              className="area-select-input"
              type="text"
              placeholder={t("addressPlaceholder")}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const first = suggestions[0];
                if (!first) return;
                pickSuggestion(first);
              }}
            />
            <button
              type="button"
              className="area-select-locate"
              aria-label={t("useMyLocation")}
              onClick={() => {
                void useMyLocation().then(() => {
                  setOpen(false);
                  navigate(pathGyms(lang), { state: { focusOrigin: true } });
                });
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
                <li className="area-select-hint">{t("noResults")}</li>
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
                      <span>{name}</span>
                      {cityCounts ? (
                        <span className="area-select-city-count">
                          {cityCounts[name] === 1
                            ? t("chainGymCountOne")
                            : t("chainGymCount", {
                                count: cityCounts[name] ?? 0,
                              })}
                        </span>
                      ) : null}
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
