import { LngLatBounds, type Map } from "maplibre-gl";
import {
  FINLAND_CENTER,
  FINLAND_VIEW,
  FRAME_ZOOM,
  PIN_ZOOM_OUT_PAD_KM,
} from "./mapConstants";

export function framePadForOverlays(
  map: Map,
  opts?: { labelTop?: number; labelBottom?: number },
) {
  const mapEl = map.getContainer();
  const col = mapEl.closest(".browse-map-col") ?? mapEl.parentElement;
  const mapRect = mapEl.getBoundingClientRect();
  const w = mapRect.width;
  const h = mapRect.height;
  const gap = 18;
  const labelTop = opts?.labelTop ?? 36;
  const labelBottom = opts?.labelBottom ?? 20;
  let left = 28;
  let right = 28;
  let top = 28 + labelTop;
  let bottom = 36 + labelBottom;

  const selectors = [
    ".browse-map-side",
    ".browse-map-chips",
    ".browse-map-desk-city",
    ".browse-map-desk-tools",
    ".browse-map-controls",
    ".browse-map-locate-fab",
    ".browse-map-preview",
    ".browse-map-open-btn",
  ];

  for (const sel of selectors) {
    const el = col?.querySelector(sel);
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (style.opacity === "0") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const nearTop = r.top - mapRect.top < h * 0.45;
    const nearBottom = mapRect.bottom - r.bottom < h * 0.45;
    const nearLeft = r.left - mapRect.left < w * 0.45;
    const nearRight = mapRect.right - r.right < w * 0.45;

    if (nearTop) {
      top = Math.max(top, Math.ceil(r.bottom - mapRect.top + gap + labelTop));
    }
    if (nearBottom) {
      bottom = Math.max(
        bottom,
        Math.ceil(mapRect.bottom - r.top + gap + labelBottom),
      );
    }
    if (nearLeft) {
      left = Math.max(left, Math.ceil(r.right - mapRect.left + gap));
    }
    if (nearRight) {
      right = Math.max(right, Math.ceil(mapRect.right - r.left + gap));
    }
  }

  const maxL = Math.floor(w * 0.4);
  const maxR = Math.floor(w * 0.4);
  const maxT = Math.floor(h * 0.4);
  const maxB = Math.floor(h * 0.4);
  return {
    top: Math.min(Math.max(top, 40), maxT),
    bottom: Math.min(Math.max(bottom, 40), maxB),
    left: Math.min(Math.max(left, 28), maxL),
    right: Math.min(Math.max(right, 28), maxR),
  };
}

export function frameOriginAndGym(
  map: Map,
  originLng: number,
  originLat: number,
  gymLng: number,
  gymLat: number,
  bounceLockRef?: { current: boolean },
  cameraSaveRef?: {
    current: {
      lng: number;
      lat: number;
      zoom: number;
      minZoom: number;
    } | null;
  },
) {
  if (cameraSaveRef && !cameraSaveRef.current) {
    const c = map.getCenter();
    cameraSaveRef.current = {
      lng: c.lng,
      lat: c.lat,
      zoom: map.getZoom(),
      minZoom: map.getMinZoom(),
    };
  }
  map.stop();
  map.resize();
  map.setMinZoom(1);
  if (bounceLockRef) bounceLockRef.current = true;
  const bounds = new LngLatBounds();
  bounds.extend([originLng, originLat]);
  bounds.extend([gymLng, gymLat]);
  map.fitBounds(bounds, {
    padding: framePadForOverlays(map, {
      labelTop: 110,
      labelBottom: 28,
    }),
    maxZoom: FRAME_ZOOM,
    duration: 700,
    easing: (t) => 1 - (1 - t) ** 3,
  });
  window.setTimeout(() => {
    const savedMin = cameraSaveRef?.current?.minZoom;
    const floor = Math.min(map.getZoom(), savedMin ?? map.getZoom());
    map.setMinZoom(Math.max(1, floor));
    if (bounceLockRef) bounceLockRef.current = false;
  }, 850);
}

export function expandBoundsByKm(bounds: LngLatBounds, km: number) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const midLat = (sw.lat + ne.lat) / 2;
  const dLat = km / 111;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const dLng = km / (111 * Math.max(0.2, cos));
  return new LngLatBounds(
    [sw.lng - dLng, sw.lat - dLat],
    [ne.lng + dLng, ne.lat + dLat],
  );
}

export function boundsFromPins(pins: { lat: number; lng: number }[]) {
  const bounds = new LngLatBounds();
  for (const p of pins) bounds.extend([p.lng, p.lat]);
  return bounds;
}

export function applyFinlandMinZoom(map: Map) {
  const cam = map.cameraForBounds(FINLAND_VIEW, { padding: 36 });
  if (cam?.zoom == null) return;
  map.setMinZoom(Math.max(1, cam.zoom - 0.65));
}

export function applyPinsMinZoom(
  map: Map,
  pins: { lat: number; lng: number }[],
  pad?: { top: number; bottom: number; left: number; right: number },
) {
  if (pins.length === 0) {
    applyFinlandMinZoom(map);
    return;
  }
  const padding = pad ?? framePadForOverlays(map, { labelTop: 36 });
  const padded = expandBoundsByKm(boundsFromPins(pins), PIN_ZOOM_OUT_PAD_KM);
  const cam = map.cameraForBounds(padded, { padding });
  if (cam?.zoom == null) return;
  map.setMinZoom(Math.max(1, cam.zoom));
}

export function centerFinlandIfMaxOut(map: Map) {
  if (map.getZoom() > map.getMinZoom() + 0.12) return;
  const c = map.getCenter();
  if (
    Math.abs(c.lng - FINLAND_CENTER[0]) < 0.08 &&
    Math.abs(c.lat - FINLAND_CENTER[1]) < 0.08
  ) {
    return;
  }
  map.easeTo({ center: FINLAND_CENTER, duration: 280 });
}
