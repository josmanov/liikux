import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { observeMapContainerResize, waitForMapContainerSize } from "../../map/maplibreSetup";
import { MAP_STYLE_URL } from "../browse/utils/mapConstants";

/**
 * Map on the favorites page: one pin per favorite gym (showing its price)
 * and a blue dot for the user's own address.
 *
 * - `activeSlug` is the gym the mouse is on in the table; its pin lights up.
 * - Clicking a pin calls `onPick`, so the page can highlight that row.
 */

export type FavPin = { slug: string; lat: number; lng: number; label: string };

type Props = {
  pins: FavPin[];
  origin: { lat: number; lng: number } | null;
  activeSlug: string | null;
  onPick: (slug: string) => void;
};

export default function FavoritesMap({ pins, origin, activeSlug, onPick }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const originRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);

  // 1. Create the map once.
  useEffect(() => {
    if (!boxRef.current) return;
    const map = new Map({
      container: boxRef.current,
      style: MAP_STYLE_URL,
      center: [24.94, 60.17],
      zoom: 9,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.cooperativeGestures.enable();
    mapRef.current = map;

    let alive = true;
    const stopResize = observeMapContainerResize(map.getContainer(), map);
    map.on("load", () => {
      void waitForMapContainerSize(map.getContainer(), map).then(() => alive && setReady(true));
    });
    return () => {
      alive = false;
      stopResize();
      markersRef.current = {};
      originRef.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  // 2. Draw the pins again when the list of gyms changes, and fit them all on screen.
  const pinsKey = pins.map((p) => `${p.slug}:${p.label}`).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    originRef.current?.remove();
    originRef.current = null;

    const bounds = new LngLatBounds();
    for (const pin of pins) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "fav-pin";
      el.textContent = pin.label;
      el.addEventListener("click", () => onPickRef.current(pin.slug));
      markersRef.current[pin.slug] = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      bounds.extend([pin.lng, pin.lat]);
    }
    if (origin) {
      const el = document.createElement("div");
      el.className = "fav-origin";
      originRef.current = new Marker({ element: el, anchor: "center" }).setLngLat([origin.lng, origin.lat]).addTo(map);
      bounds.extend([origin.lng, origin.lat]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 400 });
    // pinsKey stands for `pins`: it only changes when the gyms or prices change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinsKey, origin?.lat, origin?.lng]);

  // 3. Light up the active pin.
  useEffect(() => {
    for (const [slug, marker] of Object.entries(markersRef.current)) {
      marker.getElement().classList.toggle("is-active", slug === activeSlug);
    }
  }, [activeSlug, pinsKey, ready]);

  return (
    <div className="fav-map">
      <div className="fav-map-canvas" ref={boxRef} />
    </div>
  );
}
