import { useEffect, useRef, useState } from "react";
import { LngLatBounds, type Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Gym } from "../../data/types";
import { useLang } from "../../i18n/useLang";
import { buildGymPin, buildOriginPin } from "../../map/gymPin";
import { observeMapContainerResize, waitForMapContainerSize } from "../../map/maplibreSetup";
import { createSmallMap, limitZoomOut, MapZoomButtons } from "../../map/smallMap";
import "../../map/pins.css";

/**
 * Map on the favorites page: one pin per favorite gym and the blue dot for
 * the user's own address. The pins, the + / − buttons and the limits are the
 * same as on the browse page (map/gymPin.ts, map/smallMap.tsx).
 *
 * - `activeSlug` is the gym the mouse is on in the table; its pin lights up.
 * - Clicking a pin calls `onPick`, so the page can highlight that row.
 */

type Props = {
  gyms: Gym[];
  origin: { lat: number; lng: number; label: string } | null;
  activeSlug: string | null;
  onPick: (slug: string) => void;
  onHover: (slug: string | null) => void;
};

const FIT_PADDING = { top: 90, bottom: 60, left: 70, right: 70 };

export default function FavoritesMap({ gyms, origin, activeSlug, onPick, onHover }: Props) {
  const { lang, t } = useLang();
  const boxRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [ready, setReady] = useState(false);
  const pinsRef = useRef<Record<string, { marker: Marker; el: HTMLElement; hit: HTMLElement }>>({});
  const originRef = useRef<Marker | null>(null);
  const boundsRef = useRef<LngLatBounds | null>(null);
  // Latest callbacks, so the pins do not need to be rebuilt when they change.
  const onPickRef = useRef(onPick);
  const onHoverRef = useRef(onHover);
  onPickRef.current = onPick;
  onHoverRef.current = onHover;

  // 1. Create the map once.
  useEffect(() => {
    if (!boxRef.current) return;
    const created = createSmallMap(boxRef.current, [24.94, 60.17], 9);
    let alive = true;
    const stopResize = observeMapContainerResize(created.getContainer(), created);
    created.on("load", () => {
      void waitForMapContainerSize(created.getContainer(), created).then(() => {
        if (!alive) return;
        setMap(created);
        setReady(true);
      });
    });
    return () => {
      alive = false;
      stopResize();
      pinsRef.current = {};
      originRef.current = null;
      setMap(null);
      setReady(false);
      created.remove();
    };
  }, []);

  /** Fits every pin on screen (also the "back" button). */
  function showAll(animate = true) {
    const bounds = boundsRef.current;
    if (!map || !bounds || bounds.isEmpty()) return;
    const fitted = map.cameraForBounds(bounds, { padding: FIT_PADDING, maxZoom: 14 });
    map.setMinZoom(3);
    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 14, duration: animate ? 400 : 0 });
    if (fitted?.zoom != null) limitZoomOut(map, fitted.zoom);
  }

  // 2. Draw the pins again when the list of gyms changes, and fit them all on screen.
  const pinsKey = gyms.map((g) => `${g.slug}:${g.priceFrom ?? ""}`).join("|");
  useEffect(() => {
    if (!map || !ready) return;

    Object.values(pinsRef.current).forEach((p) => p.marker.remove());
    pinsRef.current = {};
    originRef.current?.remove();
    originRef.current = null;

    const bounds = new LngLatBounds();
    for (const gym of gyms) {
      if (gym.lat == null || gym.lng == null) continue;
      const { el, hit } = buildGymPin(gym, gym.chain, { lang });
      hit.addEventListener("click", () => onPickRef.current(gym.slug));
      hit.addEventListener("mouseenter", () => onHoverRef.current(gym.slug));
      hit.addEventListener("mouseleave", () => onHoverRef.current(null));
      const marker = new Marker({ element: el, anchor: "bottom" }).setLngLat([gym.lng, gym.lat]).addTo(map);
      pinsRef.current[gym.slug] = { marker, el, hit };
      bounds.extend([gym.lng, gym.lat]);
    }
    if (origin) {
      originRef.current = new Marker({
        element: buildOriginPin(origin.label, t("fromAddressAria")),
        anchor: "center",
      })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
      bounds.extend([origin.lng, origin.lat]);
    }
    boundsRef.current = bounds;
    showAll();
    // pinsKey stands for `gyms`: it only changes when the gyms or prices change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, pinsKey, origin?.lat, origin?.lng, origin?.label, lang]);

  // 3. Light up the active pin (same look as a hovered pin on the browse map).
  useEffect(() => {
    for (const [slug, pin] of Object.entries(pinsRef.current)) {
      const on = slug === activeSlug;
      pin.hit.classList.toggle("is-hovered", on);
      pin.el.classList.toggle("is-front", on);
      pin.el.style.zIndex = on ? "12000" : "";
    }
  }, [activeSlug, pinsKey, ready]);

  return (
    <div className="fav-map">
      <div className="fav-map-canvas" ref={boxRef} />
      <MapZoomButtons
        map={map}
        zoomInLabel={t("mapZoomIn")}
        zoomOutLabel={t("mapZoomOut")}
        onReset={() => showAll()}
        resetLabel={t("favShowAll")}
      />
    </div>
  );
}
