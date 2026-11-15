import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, MapPin, Minus, Navigation, Plus } from "lucide-react";
import LoadSpin from "../../../components/LoadSpin";
import { useAddressSuggest, type GeoHit } from "../../../data/geocode";
import { formatDistanceKm } from "../../../data/format";
import { useLang } from "../../../i18n/useLang";
import { observeMapContainerResize, waitForMapContainerSize } from "../../../map/maplibreSetup";
import { MAP_STYLE_URL } from "../../browse/utils/mapConstants";

/**
 * The map on the gym page.
 *
 * Shows the gym (yellow pin) and, if we know it, where the user starts from
 * (blue dot). The box at the top lets the user type another starting address;
 * the bar at the bottom shows the distance and opens the route in Google Maps.
 */

const DUMBBELL_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg>';

function makeGymPin() {
  const el = document.createElement("div");
  el.className = "gp-pin";
  el.innerHTML = DUMBBELL_SVG;
  return el;
}

function makeFromPin(label: string) {
  const el = document.createElement("div");
  el.className = "gp-from-pin";
  if (label) {
    const text = document.createElement("span");
    text.textContent = label;
    el.appendChild(text);
  }
  return el;
}

type Props = {
  gymLat: number;
  gymLng: number;
  from: GeoHit | null;
  tripKm: number | null;
  routeUrl: string;
  onPickFrom: (hit: GeoHit) => void;
  onLocate: () => void;
};

export default function GymRouteMap({ gymLat, gymLng, from, tripKm, routeUrl, onPickFrom, onLocate }: Props) {
  const { t } = useLang();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const fromMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Starting-address box
  const [draft, setDraft] = useState(from?.label ?? "");
  const [open, setOpen] = useState(false);
  const { hits, loading } = useAddressSuggest(draft, open, { lat: gymLat, lng: gymLng });
  const showList = open && draft.trim().length >= 3;

  useEffect(() => setDraft(from?.label ?? ""), [from?.label]);

  // 1. Create the map once per gym.
  useEffect(() => {
    if (!boxRef.current) return;
    const map = new Map({
      container: boxRef.current,
      style: MAP_STYLE_URL,
      center: [gymLng, gymLat],
      zoom: 14,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    // On phones one finger scrolls the page; the map moves with two fingers.
    map.cooperativeGestures.enable();
    mapRef.current = map;

    let alive = true;
    const stopResize = observeMapContainerResize(map.getContainer(), map);
    map.on("load", () => {
      void waitForMapContainerSize(map.getContainer(), map).then(() => {
        if (!alive) return;
        new Marker({ element: makeGymPin(), anchor: "bottom" }).setLngLat([gymLng, gymLat]).addTo(map);
        setReady(true);
      });
    });

    return () => {
      alive = false;
      stopResize();
      fromMarkerRef.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, [gymLat, gymLng]);

  // 2. Show the starting point and fit both points on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    fromMarkerRef.current?.remove();
    fromMarkerRef.current = null;

    if (!from) {
      map.easeTo({ center: [gymLng, gymLat], zoom: 14 });
      return;
    }
    fromMarkerRef.current = new Marker({ element: makeFromPin(from.label), anchor: "center" })
      .setLngLat([from.lng, from.lat])
      .addTo(map);
    const bounds = new LngLatBounds().extend([gymLng, gymLat]).extend([from.lng, from.lat]);
    map.fitBounds(bounds, { padding: { top: 96, bottom: 96, left: 56, right: 56 }, maxZoom: 15 });
  }, [ready, from, gymLat, gymLng]);

  function zoomBy(step: number) {
    const map = mapRef.current;
    if (map) map.easeTo({ zoom: map.getZoom() + step, duration: 200 });
  }

  function pick(hit: GeoHit) {
    setOpen(false);
    onPickFrom(hit);
  }

  return (
    <div className="gp-map">
      <div className="gp-map-canvas" ref={boxRef} />

      <form
        className="gp-map-from"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) pick(hits[0]);
        }}
      >
        <MapPin size={17} strokeWidth={2.2} aria-hidden="true" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={draft}
          placeholder={t("fromAddressPlaceholder")}
          aria-label={t("fromAddressAria")}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setDraft(from?.label ?? "");
          }}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        />
        <button type="button" aria-label={t("useMyLocation")} title={t("useMyLocation")} onClick={onLocate}>
          <LocateFixed size={17} strokeWidth={2.2} />
        </button>

        {showList ? (
          <div className="gp-map-hits" role="listbox">
            {loading && hits.length === 0 ? (
              <div className="gp-map-hint">
                <LoadSpin size="sm" />
              </div>
            ) : null}
            {!loading && hits.length === 0 ? <div className="gp-map-hint">{t("noResults")}</div> : null}
            {hits.slice(0, 5).map((hit) => (
              <button
                key={hit.id}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
              >
                {hit.label}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div className="gp-map-zoom">
        <button type="button" aria-label={t("mapZoomIn")} onClick={() => zoomBy(1)}>
          <Plus size={18} strokeWidth={2.4} />
        </button>
        <button type="button" aria-label={t("mapZoomOut")} onClick={() => zoomBy(-1)}>
          <Minus size={18} strokeWidth={2.4} />
        </button>
      </div>

      <div className="gp-map-foot">
        <span className="gp-map-trip">
          {tripKm != null ? (
            <>
              <strong>{formatDistanceKm(tripKm)}</strong>
              {from ? ` ${t("gymFrom", { from: from.label })}` : ""}
            </>
          ) : (
            t("gymAddStart")
          )}
        </span>
        <a className="btn btn-soft gp-map-route" href={routeUrl} target="_blank" rel="noreferrer">
          <Navigation size={15} strokeWidth={2.4} aria-hidden="true" />
          {t("mapsRoute")}
        </a>
      </div>
    </div>
  );
}
