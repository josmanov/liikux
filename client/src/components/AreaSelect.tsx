import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useAppLocation } from "../context/LocationContext";
import { fetchGyms } from "../data/api";
import { useAddressSuggest, type GeoHit } from "../data/geocode";
import { cityCenterForName, cityFromLabel, nearestCityCenter } from "../data/citySlug";
import { regionForCitySlug } from "../data/regionSlug";
import { pathGyms, pathGymsBrowse, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./AreaSelect.css";
import LoadSpin from "./LoadSpin";

const cities = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu"];
const AREA_MOBILE_MQ = "(max-width: 760px)";

function AreaSelect({
  variant = "default",
}: {
  variant?: "default" | "combo";
}) {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { label, lat, lng, setLocation, locateMe } = useAppLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [mobileSheet, setMobileSheet] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(AREA_MOBILE_MQ).matches,
  );
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
    const mq = window.matchMedia(AREA_MOBILE_MQ);
    function sync() {
      setMobileSheet(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    function close(e: MouseEvent) {
      if (mobileSheet) return;
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("click", close, true);
    return () => window.removeEventListener("click", close, true);
  }, [open, mobileSheet]);

  useEffect(() => {
    if (!open || !mobileSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, mobileSheet]);

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
    const center = cityCenterForName(name);
    flushSync(() => {
      setLocation({
        label: name,
        lat: center?.lat ?? null,
        lng: center?.lng ?? null,
      });
    });
    goBrowse(name);
  }

  const showSuggestions = draft.trim().length >= 3;

  const panelBody = (
    <>
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
            void locateMe().then((place) => {
              setOpen(false);
              if (!place) {
                navigate(pathGyms(lang), { state: { focusOrigin: true } });
                return;
              }
              const fromLabel = cityFromLabel(place.label);
              const city =
                (fromLabel ? cityCenterForName(fromLabel) : null) ||
                nearestCityCenter(place.lat, place.lng);
              const region = city ? regionForCitySlug(city.slug) : null;
              if (city && region) {
                navigate(
                  {
                    pathname: pathGymsBrowse(lang, region.slug, city.slug),
                    search: /^\/(fi|en)\/(kuntosalit|gyms)/.test(
                      routeLocation.pathname,
                    )
                      ? routeLocation.search
                      : "",
                  },
                  { replace: true, state: { focusOrigin: true } },
                );
                return;
              }
              navigate(pathGymsFromLocation(lang, place.label), {
                replace: true,
                state: { focusOrigin: true },
              });
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
    </>
  );

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
          <span className="area-select-label-full">{label}</span>
          <span className="area-select-label-short">{shortLabel}</span>
        </span>
        <ChevronDown className="area-select-chevron" size={16} strokeWidth={2.2} />
      </button>

      {open && mobileSheet
        ? createPortal(
            <div
              className="area-select-sheet-root"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                className="area-select-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={t("location")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="area-select-sheet-head">
                  <h2 className="area-select-sheet-title">{t("location")}</h2>
                  <button
                    type="button"
                    className="area-select-sheet-close"
                    aria-label={t("close")}
                    onClick={() => setOpen(false)}
                  >
                    <X size={20} strokeWidth={2.4} />
                  </button>
                </div>
                <div className="area-select-sheet-body">{panelBody}</div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {open && !mobileSheet ? (
        <div className="area-select-panel" role="dialog" aria-label={t("location")}>
          {panelBody}
        </div>
      ) : null}
    </div>
  );
}

export default AreaSelect;
