import type { Map } from "maplibre-gl";
import type { Gym } from "../../../data/types";

export function markerScaleForZoom(zoom: number) {
  const t = Math.min(1, Math.max(0, (zoom - 4.2) / 8));
  return 0.78 + t * 0.32;
}

export function pinTouchPx(scale: number) {
  return 26 * scale;
}

export function pinStackZ(lat: number, kind: "pin" | "price" | "cluster") {
  const base = Math.max(1, Math.round((72 - lat) * 80));
  if (kind === "cluster") return base;
  if (kind === "price") return base + 2500;
  return base + 400;
}

export function zoomWhereClusterSplits(map: Map, group: Gym[]) {
  const z0 = map.getZoom();
  const maxZoom = Math.min(map.getMaxZoom(), z0 + 7);
  const pts = group.map((g) => map.project([g.lng, g.lat]));
  let minD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < minD) minD = d;
    }
  }
  if (!Number.isFinite(minD) || minD < 0.5) {
    return Math.min(z0 + 2.8, maxZoom);
  }

  let lo = z0;
  let hi = maxZoom;
  for (let n = 0; n < 18; n++) {
    const mid = (lo + hi) / 2;
    const spread = minD * 2 ** (mid - z0);
    const need = pinTouchPx(markerScaleForZoom(mid)) + 28;
    if (spread > need) hi = mid;
    else lo = mid;
  }
  return Math.min(hi + 0.35, maxZoom);
}

export function gymsNearViewport(gyms: Gym[], map: Map) {
  const b = map.getBounds();
  const padX = (b.getEast() - b.getWest()) * 0.4;
  const padY = (b.getNorth() - b.getSouth()) * 0.4;
  const west = b.getWest() - padX;
  const east = b.getEast() + padX;
  const south = b.getSouth() - padY;
  const north = b.getNorth() + padY;
  return gyms.filter(
    (g) =>
      g.lng != null &&
      g.lat != null &&
      g.lng >= west &&
      g.lng <= east &&
      g.lat >= south &&
      g.lat <= north,
  );
}

export function clusterMarkerKey(group: Gym[]) {
  return "c:" + group.map((g) => g.id).sort().join("|");
}

export function clusterGymsByScreenTouch(gyms: Gym[], map: Map, touchPx: number) {
  const n = gyms.length;
  if (n === 0) return [] as Gym[][];

  const pts = [...gyms]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((g) => {
      const p = map.project([g.lng, g.lat]);
      return { g, x: p.x, y: p.y };
    });

  const limit = touchPx * touchPx;
  const used = new Array(n).fill(false);
  const groups: Gym[][] = [];

  function dist2(a: number, b: number) {
    const dx = pts[a].x - pts[b].x;
    const dy = pts[a].y - pts[b].y;
    return dx * dx + dy * dy;
  }

  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const members = [i];
    used[i] = true;
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        const touchesAll = members.every((m) => dist2(m, j) <= limit);
        if (!touchesAll) continue;
        members.push(j);
        used[j] = true;
        grew = true;
      }
    }
    groups.push(members.map((idx) => pts[idx].g));
  }

  return groups;
}
