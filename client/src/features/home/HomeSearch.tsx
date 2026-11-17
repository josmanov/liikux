import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { LocateFixed, MapPin } from "lucide-react";
import LoadSpin from "../../components/LoadSpin";
import { useAppLocation } from "../../context/LocationContext";
import { useAddressSuggest, type GeoHit } from "../../data/geocode";
import { pathGyms, pathGymsFromLocation } from "../../i18n/lang";
import { useLang } from "../../i18n/useLang";
import "./HomeSearch.css";

/**
 * The big address box on the home page.
 *
 * Type 3+ letters → suggestions come from /api/geocode → pick one (click
 * or Enter) → we save it as the user's location and
 * open the browse page for that city.
 */
function HomeSearch() {
  const navigate = useNavigate();
  const { lang, t } = useLang();
  const { label, lat, lng, setLocation, locateMe } = useAppLocation();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { hits, loading } = useAddressSuggest(draft, open, { lat, lng });
  const showList = open && draft.trim().length >= 3;

  // Show the last chosen address in the box (but not the default "Helsinki").
  useEffect(() => {
    setDraft(label === "Helsinki" || label === "Lähellä minua" ? "" : label);
  }, [label]);

  useEffect(() => setActive(0), [hits]);

  function go(hit: GeoHit) {
    flushSync(() => setLocation({ label: hit.label, lat: hit.lat, lng: hit.lng }));
    setOpen(false);
    navigate(pathGymsFromLocation(lang, hit.label, hit), {
      state: { focusOrigin: true },
    });
  }

  function submit() {
    const hit = hits[active] ?? hits[0];
    if (hit) go(hit);
    else setOpen(true);
  }

  return (
    <form
      className="home-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="home-search-box">
        <MapPin className="home-search-icon" size={20} strokeWidth={2.2} aria-hidden="true" />
        <input
          className="home-search-input"
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder={t("addressPlaceholder")}
          aria-label={t("addressAria")}
          aria-expanded={showList}
          aria-controls="home-search-list"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="home-search-locate"
          aria-label={t("useMyLocation")}
          title={t("useMyLocation")}
          onClick={() => {
            void locateMe().then(() =>
              navigate(pathGyms(lang), { state: { focusOrigin: true } }),
            );
          }}
        >
          <LocateFixed size={18} strokeWidth={2.2} />
        </button>
      </div>

      {showList ? (
        <div className="home-search-list" id="home-search-list" role="listbox">
          {loading && hits.length === 0 ? (
            <div className="home-search-hint">
              <LoadSpin size="sm" />
            </div>
          ) : null}
          {!loading && hits.length === 0 ? (
            <div className="home-search-hint">{t("noResults")}</div>
          ) : null}
          {hits.slice(0, 6).map((hit, i) => {
            const comma = hit.label.lastIndexOf(",");
            const main = comma >= 0 ? hit.label.slice(0, comma) : hit.label;
            const city = comma >= 0 ? hit.label.slice(comma + 1).trim() : "";
            return (
              <button
                key={hit.id}
                type="button"
                role="option"
                aria-selected={i === active}
                className={i === active ? "home-search-hit is-active" : "home-search-hit"}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
              >
                <MapPin size={16} strokeWidth={2.2} aria-hidden="true" />
                <span className="home-search-hit-main">{main}</span>
                {city ? <span className="home-search-hit-city">{city}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

export default HomeSearch;
