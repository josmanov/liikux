import { Map } from "maplibre-gl";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { MAP_MAX_BOUNDS, MAP_STYLE_URL } from "../features/browse/utils/mapConstants";

/**
 * The small maps (gym page, favorites) are set up here so they behave like
 * the big one on the browse page: same style, same limits, same buttons.
 */

/** Creates a map with the Liikux look that cannot be dragged away from Finland. */
export function createSmallMap(container: HTMLElement, center: [number, number], zoom: number) {
  const map = new Map({
    container,
    style: MAP_STYLE_URL,
    center,
    zoom,
    maxBounds: MAP_MAX_BOUNDS,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();
  // Phones: one finger scrolls the page, two fingers move the map.
  // With a mouse the wheel zooms the map straight away, like on the browse page.
  if (window.matchMedia("(pointer: coarse)").matches) map.cooperativeGestures.enable();
  return map;
}

/**
 * Stops the user from zooming far out from what the map is showing: call it
 * after the map has been fitted to its pins. Zooming out stops softly one
 * step above that view, the same "wall" the browse map has.
 */
export function limitZoomOut(map: Map, fittedZoom: number) {
  map.setMinZoom(Math.max(3, fittedZoom - 1.5));
}

type ZoomButtonsProps = {
  map: Map | null;
  zoomInLabel: string;
  zoomOutLabel: string;
  /** Optional third button: back to the starting view. */
  onReset?: () => void;
  resetLabel?: string;
};

/** The round + / − buttons in the top right corner of a map. */
export function MapZoomButtons({ map, zoomInLabel, zoomOutLabel, onReset, resetLabel }: ZoomButtonsProps) {
  const zoomBy = (step: number) => map?.easeTo({ zoom: map.getZoom() + step, duration: 220 });
  return (
    <div className="map-ctrls">
      <button type="button" className="map-ctrl" aria-label={zoomInLabel} onClick={() => zoomBy(1)}>
        <Plus size={20} strokeWidth={2.4} />
      </button>
      <button type="button" className="map-ctrl" aria-label={zoomOutLabel} onClick={() => zoomBy(-1)}>
        <Minus size={20} strokeWidth={2.4} />
      </button>
      {onReset ? (
        <button type="button" className="map-ctrl is-locate" aria-label={resetLabel} title={resetLabel} onClick={onReset}>
          <LocateFixed size={19} strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}
