import { useEffect, useRef, useState } from "react";
import { LngLatBounds, type Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import LoadSpin from "../../../components/LoadSpin";
import { useAddressSuggest, type GeoHit } from "../../../data/geocode";
import { formatDistanceKm } from "../../../data/format";
import { useLang } from "../../../i18n/useLang";
import type { Chain, Gym } from "../../../data/types";
import { buildGymPin, buildOriginPin } from "../../../map/gymPin";
import { observeMapContainerResize, waitForMapContainerSize } from "../../../map/maplibreSetup";
import { createSmallMap, limitZoomOut, MapZoomButtons } from "../../../map/smallMap";
import "../../../map/pins.css";

/**
 * The map on the gym page.
 *
 * Shows the gym and, if we know it, where the user starts from. The pins,
 * the + / − buttons and the limits are the same as on the browse page
 * (map/gymPin.ts, map/smallMap.tsx). The box at the top lets the user type
 * another starting address; the bar at the bottom shows the distance and
 * opens the route in Google Maps.
 */

type Props = {
  gym: Gym;
  chain: Chain | null;
  from: GeoHit | null;
  tripKm: number | null;
  routeUrl: string;
  onPickFrom: (hit: GeoHit) => void;
  onLocate: () => void;
};

export default function GymRouteMap({ gym, chain, from, tripKm, routeUrl, onPickFrom, onLocate }: Props) {
  const { lang, t } = useLang();
  const gymLat = gym.lat;
  const gymLng = gym.lng;
  const [map, setMap] = useState<Map | null>(null);
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
    const map = createSmallMap(boxRef.current, [gymLng, gymLat], 14);
    mapRef.current = map;
    setMap(map);

    let alive = true;
    const stopResize = observeMapContainerResize(map.getContainer(), map);
    map.on("load", () => {
      void waitForMapContainerSize(map.getContainer(), map).then(() => {
        if (!alive) return;
        // The same pin as on the browse map, shown as the selected one.
        const pin = buildGymPin(gym, chain, { lang, selected: true });
        pin.el.classList.add("is-front");
        new Marker({ element: pin.el, anchor: "bottom" }).setLngLat([gymLng, gymLat]).addTo(map);
        setReady(true);
      });
    });

    return () => {
      alive = false;
      stopResize();
      fromMarkerRef.current = null;
      mapRef.current = null;
      setMap(null);
      setReady(false);
      map.remove();
    };
    // The map is rebuilt only when the page shows another gym.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym.id, gymLat, gymLng, lang]);

  // 2. Show the starting point and fit both points on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    fromMarkerRef.current?.remove();
    fromMarkerRef.current = null;

    map.setMinZoom(3);
    if (!from) {
      map.easeTo({ center: [gymLng, gymLat], zoom: 14 });
      limitZoomOut(map, 12);
      return;
    }
    fromMarkerRef.current = new Marker({
      element: buildOriginPin(from.label, t("fromAddressAria")),
      anchor: "center",
    })
      .setLngLat([from.lng, from.lat])
      .addTo(map);
    showBoth();
    // showBoth reads the latest values itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, from, gymLat, gymLng]);

  /** Fits the gym and the starting point on screen (also the "back" button). */
  function showBoth() {
    const map = mapRef.current;
    if (!map) return;
    if (!from) {
      map.easeTo({ center: [gymLng, gymLat], zoom: 14 });
      return;
    }
    const bounds = new LngLatBounds().extend([gymLng, gymLat]).extend([from.lng, from.lat]);
    const padding = { top: 110, bottom: 96, left: 64, right: 64 };
    const fitted = map.cameraForBounds(bounds, { padding, maxZoom: 15 });
    map.setMinZoom(3);
    map.fitBounds(bounds, { padding, maxZoom: 15 });
    if (fitted?.zoom != null) limitZoomOut(map, fitted.zoom);
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

      <MapZoomButtons
        map={map}
        zoomInLabel={t("mapZoomIn")}
        zoomOutLabel={t("mapZoomOut")}
        onReset={showBoth}
        resetLabel={t("mapGoToLocation")}
      />

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
