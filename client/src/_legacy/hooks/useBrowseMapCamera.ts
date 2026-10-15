import type { MutableRefObject } from "react";
import type { Map } from "maplibre-gl";
import type { Gym } from "../../data/types";
import {
  applyFinlandMinZoom,
  applyPinsMinZoom,
  expandBoundsByKm,
  boundsFromPins,
  framePadForOverlays,
} from "../../features/browse/utils/mapBounds";

export type BrowseMapCameraRefs = {
  mapInstanceRef: MutableRefObject<Map | null>;
  cityBounceLockRef: MutableRefObject<boolean>;
  preCompareCameraRef: MutableRefObject<{
    lng: number;
    lat: number;
    zoom: number;
    minZoom: number;
  } | null>;
  browseCitySlugRef: MutableRefObject<string | null>;
};

export function fitBrowseCityGyms(
  map: Map,
  pins: Gym[],
  refs: BrowseMapCameraRefs,
) {
  if (pins.length === 0) {
    applyFinlandMinZoom(map);
    return;
  }
  map.resize();
  refs.cityBounceLockRef.current = true;
  const coords = pins
    .filter((g) => g.lat != null && g.lng != null)
    .map((g) => ({ lat: g.lat!, lng: g.lng! }));
  const padded = expandBoundsByKm(boundsFromPins(coords), 2.5);
  map.fitBounds(padded, {
    padding: framePadForOverlays(map, { labelTop: 36 }),
    duration: 650,
  });
  applyPinsMinZoom(map, coords, framePadForOverlays(map, { labelTop: 36 }));
  window.setTimeout(() => {
    refs.cityBounceLockRef.current = false;
  }, 700);
}
