import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import type { Chain, Gym } from "../../../data/types";
import type { MessageKey } from "../../../i18n/messages";
import {
  formatGymStreetLine,
  formatPricePill,
} from "../../../data/format";
import {
  clusterGymsByScreenTouch,
  clusterMarkerKey,
  gymsNearViewport,
  markerScaleForZoom,
  pinStackZ,
  pinTouchPx,
  zoomWhereClusterSplits,
} from "../utils/pinCluster";
import { frameOriginAndGym, framePadForOverlays } from "../utils/mapBounds";
import { flushSync } from "react-dom";

export type BrowseMapMarkersCtx = {
  mapInstanceRef: MutableRefObject<MapLibreMap | null>;
  mapReady: boolean;
  visibleGyms: Gym[];
  origin: { lat: number; lng: number };
  locationLabel: string;
  selectedMaakunta: string | null;
  chains: Chain[];
  lang: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  markersRef: MutableRefObject<globalThis.Map<string, Marker>>;
  originMarkerRef: MutableRefObject<Marker | null>;
  chainsByIdRef: MutableRefObject<globalThis.Map<string, Chain>>;
  visibleGymsRef: MutableRefObject<Gym[]>;
  regionPickModeRef: MutableRefObject<boolean>;
  explodeClusterIdsRef: MutableRefObject<Set<string> | null>;
  favoriteSlugsRef: MutableRefObject<string[]>;
  selectedIdRef: MutableRefObject<string | null>;
  hoveredIdRef: MutableRefObject<string | null>;
  inViewGymsRef: MutableRefObject<Gym[]>;
  pageGymsRef: MutableRefObject<Gym[]>;
  pageSizeRef: MutableRefObject<number>;
  originRef: MutableRefObject<{ lat: number; lng: number }>;
  cityBounceLockRef: MutableRefObject<boolean>;
  preCompareCameraRef: MutableRefObject<{
    lng: number;
    lat: number;
    zoom: number;
    minZoom: number;
  } | null>;
  freezeListBoundsRef: MutableRefObject<boolean>;
  selectFromMapRef: MutableRefObject<boolean>;
  mapPinchRef: MutableRefObject<boolean>;
  mapTouchCountRef: MutableRefObject<number>;
  afterPinchSyncRef: MutableRefObject<(() => void) | null>;
  setHoveredId: Dispatch<SetStateAction<string | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setPage: Dispatch<SetStateAction<number>>;
  setMapSelectPending: Dispatch<SetStateAction<boolean>>;
  setListRevealKey: Dispatch<SetStateAction<number>>;
  setMapBounds: Dispatch<
    SetStateAction<{
      west: number;
      south: number;
      east: number;
      north: number;
    } | null>
  >;
};

export function useBrowseMapMarkers(ctx: BrowseMapMarkersCtx) {
  useEffect(() => {
    const {
      mapInstanceRef,
      mapReady,
      visibleGyms,
      origin,
      locationLabel,
      selectedMaakunta,
      chains,
      lang,
      t,
      markersRef,
      originMarkerRef,
      chainsByIdRef,
      visibleGymsRef,
      regionPickModeRef,
      explodeClusterIdsRef,
      favoriteSlugsRef,
      selectedIdRef,
      hoveredIdRef,
      inViewGymsRef,
      pageGymsRef,
      pageSizeRef,
      originRef,
      cityBounceLockRef,
      preCompareCameraRef,
      freezeListBoundsRef,
      selectFromMapRef,
      mapPinchRef,
      mapTouchCountRef,
      afterPinchSyncRef,
      setHoveredId,
      setSelectedId,
      setPage,
      setMapSelectPending,
      setListRevealKey,
      setMapBounds,
    } = ctx;

    const mapRefCurrent = mapInstanceRef.current;
    if (!mapRefCurrent || !mapReady) return;
    const map = mapRefCurrent;

    function clearMarkers() {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
    }

    function readBounds() {
      const b = map.getBounds();
      return {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      };
    }

    function putPin(g: Gym, scale: number) {
      const old = markersRef.current.get(g.id);
      if (old) {
        old.getElement().style.setProperty("--pin-scale", String(scale));
        return;
      }

      const chain =
        g.chain ?? chainsByIdRef.current.get(g.chainId) ?? undefined;
      const brandImg =
        chain?.image && !chain.image.includes("/pins/")
          ? chain.image
          : null;
      const el = document.createElement("div");
      el.className = ["gym-pin", brandImg ? "is-brand-pin" : "is-plain-pin"]
        .filter(Boolean)
        .join(" ");
      el.dataset.gymId = g.id;
      el.dataset.gymSlug = g.slug;
      if (favoriteSlugsRef.current.includes(g.slug)) el.classList.add("is-fav");
      el.style.setProperty("--pin-scale", String(scale));
      const stackZ = pinStackZ(
        g.lat,
        g.priceFrom != null ? "price" : "pin",
      );
      el.dataset.stackZ = String(stackZ);
      if (g.id === selectedIdRef.current) {
        el.classList.add("is-front");
        el.style.zIndex = "12000";
      } else {
        el.style.zIndex = String(stackZ);
      }

      const hit = document.createElement("button");
      hit.type = "button";
      hit.className = [
        "gym-pin-hit",
        brandImg ? "is-brand" : "",
        brandImg && chain?.logoFit === "contain" ? "is-logo" : "",
        brandImg && chain?.logoClass ? chain.logoClass : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (g.id === selectedIdRef.current) hit.classList.add("is-selected");
      if (g.id === hoveredIdRef.current) hit.classList.add("is-hovered");
      hit.setAttribute("aria-label", g.name);

      const media = document.createElement("span");
      media.className = "gym-pin-media";
      const img = document.createElement("img");
      img.src = brandImg || "/pins/gym-pin.png";
      img.alt = "";
      img.decoding = "async";
      media.appendChild(img);
      hit.appendChild(media);

      const fav = document.createElement("span");
      fav.className = "gym-pin-fav";
      fav.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2C5 8 6.8 6.2 9.1 6.2c1.3 0 2.3.6 2.9 1.6.6-1 1.6-1.6 2.9-1.6 2.3 0 4.1 1.8 4.1 4.6C19 15.6 12 20 12 20z"/></svg>';
      hit.appendChild(fav);

      el.appendChild(hit);

      const street = formatGymStreetLine(g);
      if (street) {
        const address = document.createElement("span");
        address.className = "gym-pin-address";
        address.textContent = street;
        el.appendChild(address);
      }

      if (g.priceFrom != null) {
        const priceText = formatPricePill(g.priceFrom, lang);
        if (priceText) {
          const pill = document.createElement("span");
          pill.className = "gym-pin-price";
          pill.textContent = priceText;
          el.appendChild(pill);
        }
      }

      hit.addEventListener("mouseenter", () => setHoveredId(g.id));
      hit.addEventListener("mouseleave", () => setHoveredId(null));
      hit.addEventListener("click", (e) => {
        e.stopPropagation();
        markersRef.current.forEach((m, mid) => {
          const node = m.getElement();
          const base = Number(node.dataset.stackZ) || 1;
          if (mid === g.id) {
            node.classList.add("is-front");
            node.style.zIndex = "12000";
          } else if (mid !== hoveredIdRef.current) {
            node.classList.remove("is-front");
            node.style.zIndex = String(base);
          }
        });
        const idx = inViewGymsRef.current.findIndex((x) => x.id === g.id);
        const onPage = pageGymsRef.current.some((x) => x.id === g.id);
        if (idx >= 0) {
          setPage(Math.floor(idx / pageSizeRef.current) + 1);
        }
        setMapSelectPending(!onPage);
        selectFromMapRef.current = true;
        freezeListBoundsRef.current = true;
        selectedIdRef.current = g.id;
        setSelectedId(g.id);
        setListRevealKey((n) => n + 1);
        const here = originRef.current;
        if (g.lat != null && g.lng != null) {
          frameOriginAndGym(
            map,
            here.lng,
            here.lat,
            g.lng,
            g.lat,
            cityBounceLockRef,
            preCompareCameraRef,
          );
        }
      });

      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([g.lng, g.lat])
        .addTo(map);
      markersRef.current.set(g.id, marker);
    }

    function putCluster(group: Gym[], scale: number) {
      const key = clusterMarkerKey(group);
      const old = markersRef.current.get(key);
      if (old) {
        old.getElement().style.setProperty("--pin-scale", String(scale));
        return key;
      }

      let lng = 0;
      let lat = 0;
      group.forEach((g) => {
        lng += g.lng;
        lat += g.lat;
      });
      lng /= group.length;
      lat /= group.length;

      const el = document.createElement("button");
      el.type = "button";
      el.className = "gym-cluster";
      el.style.setProperty("--pin-scale", String(scale));
      const stackZ = pinStackZ(lat, "cluster");
      el.dataset.stackZ = String(stackZ);
      el.style.zIndex = String(stackZ);
      const visual = document.createElement("span");
      visual.className = "gym-cluster-visual";
      const img = document.createElement("img");
      img.src = "/pins/cluster-kettlebell.png";
      img.alt = "";
      const count = document.createElement("span");
      count.className =
        group.length > 9 ? "gym-cluster-count is-long" : "gym-cluster-count";
      count.textContent = String(group.length);
      visual.append(img, count);
      el.append(visual);
      el.setAttribute(
        "aria-label",
        t("gymsCount", { count: group.length }),
      );
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        explodeClusterIdsRef.current = null;
        const bounds = new LngLatBounds([lng, lat], [lng, lat]);
        for (const g of group) {
          if (g.lng != null && g.lat != null) bounds.extend([g.lng, g.lat]);
        }
        const pad = framePadForOverlays(map, {
          labelTop: 44,
          labelBottom: 80,
        });
        const cam = map.cameraForBounds(bounds, { padding: pad });
        const zoom = Math.min(
          map.getMaxZoom(),
          cam?.zoom != null
            ? cam.zoom
            : Math.max(map.getZoom() + 0.35, zoomWhereClusterSplits(map, group)),
        );
        const center: [number, number] = cam?.center
          ? [cam.center.lng, cam.center.lat]
          : [lng, lat];
        cityBounceLockRef.current = true;
        map.stop();
        map.easeTo({
          center,
          zoom,
          duration: 700,
          easing: (t) => 1 - (1 - t) ** 2.4,
        });
        window.setTimeout(() => {
          cityBounceLockRef.current = false;
          syncPins();
        }, 780);
      });

      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.set(key, marker);
      return key;
    }

    function syncPins() {
      if (regionPickModeRef.current) {
        clearMarkers();
        return;
      }

      const gyms = gymsNearViewport(visibleGymsRef.current, map);
      if (gyms.length === 0) {
        clearMarkers();
        return;
      }

      const zoom = map.getZoom();
      const scale = markerScaleForZoom(zoom);
      const touchPx = pinTouchPx(scale);
      const pickedId = selectedIdRef.current;
      const picked = pickedId
        ? gyms.find((g) => g.id === pickedId)
        : undefined;
      const keep = new Set<string>();

      if (picked) {
        putPin(picked, scale);
        keep.add(picked.id);
      }

      const pool: Gym[] = [];
      for (const g of gyms) {
        if (picked && g.id === picked.id) continue;
        pool.push(g);
      }

      const groups = clusterGymsByScreenTouch(pool, map, touchPx);
      groups.forEach((group) => {
        if (group.length === 1) {
          putPin(group[0], scale);
          keep.add(group[0].id);
          return;
        }
        keep.add(putCluster(group, scale));
      });

      const stale: string[] = [];
      markersRef.current.forEach((_marker, id) => {
        if (!keep.has(id)) stale.push(id);
      });
      stale.forEach((id) => {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      });
    }

    function syncOriginPin() {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      if (origin.lat == null || origin.lng == null) return;
      const el = document.createElement("div");
      el.className = "gym-origin-pin";
      el.style.zIndex = "15000";
      el.setAttribute("aria-label", t("fromAddressAria"));
      if (locationLabel.trim()) {
        const label = document.createElement("span");
        label.className = "gym-origin-pin-label";
        label.textContent = locationLabel;
        el.appendChild(label);
      }
      const ring = document.createElement("span");
      ring.className = "gym-origin-pin-ring";
      const ringLate = document.createElement("span");
      ringLate.className = "gym-origin-pin-ring is-late";
      const core = document.createElement("span");
      core.className = "gym-origin-pin-core";
      el.appendChild(ring);
      el.appendChild(ringLate);
      el.appendChild(core);
      originMarkerRef.current = new Marker({ element: el, anchor: "center" })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
    }

    function pushBounds() {
      const next = readBounds();
      startTransition(() => {
        setMapBounds((prev) => {
          if (
            prev &&
            Math.abs(prev.west - next.west) < 1e-7 &&
            Math.abs(prev.south - next.south) < 1e-7 &&
            Math.abs(prev.east - next.east) < 1e-7 &&
            Math.abs(prev.north - next.north) < 1e-7
          ) {
            return prev;
          }
          return next;
        });
      });
    }

    let pinRaf = 0;

    let idleListTimer = 0;
    function fingersDown() {
      return mapPinchRef.current || mapTouchCountRef.current > 0;
    }
    function runIdleListSync(e?: { originalEvent?: Event }) {
      if (regionPickModeRef.current) return;
      if (fingersDown()) {
        window.clearTimeout(idleListTimer);
        idleListTimer = window.setTimeout(() => runIdleListSync(e), 120);
        return;
      }
      syncPins();
      if (freezeListBoundsRef.current) {
        if (e?.originalEvent) {
          freezeListBoundsRef.current = false;
          pushBounds();
        } else if (!e) {
          pushBounds();
        }
      } else {
        pushBounds();
      }
      if (!e?.originalEvent) return;
      const picked = selectedIdRef.current;
      if (!picked) return;
      const g = visibleGymsRef.current.find((x) => x.id === picked);
      if (!g || g.lat == null || g.lng == null) return;
      const b = map.getBounds();
      const onScreen =
        g.lng >= b.getWest() &&
        g.lng <= b.getEast() &&
        g.lat >= b.getSouth() &&
        g.lat <= b.getNorth();
      if (!onScreen) {
        selectedIdRef.current = null;
        startTransition(() => setSelectedId(null));
      }
    }
    function scheduleIdleListSync(e?: { originalEvent?: Event }) {
      window.clearTimeout(idleListTimer);
      const wait = window.matchMedia(BROWSE_MOBILE_MQ).matches ? 220 : 80;
      idleListTimer = window.setTimeout(() => runIdleListSync(e), wait);
    }

    function onMapMove() {
      if (regionPickModeRef.current) return;
      if (pinRaf !== 0) return;
      pinRaf = requestAnimationFrame(() => {
        pinRaf = 0;
        if (regionPickModeRef.current) return;
        syncPins();
      });
    }

    function onMoveEnd(e: { originalEvent?: Event }) {
      if (pinRaf !== 0) {
        cancelAnimationFrame(pinRaf);
        pinRaf = 0;
      }
      syncPins();
      scheduleIdleListSync(e);
    }

    afterPinchSyncRef.current = () => {
      scheduleIdleListSync();
    };

    let dragged = false;
    function onDragStart() {
      dragged = true;
    }
    function onDragEnd() {
      window.setTimeout(() => {
        dragged = false;
      }, 0);
    }
    function onMapClick(e: MapLayerMouseEvent) {
      if (dragged) return;
      const target = e.originalEvent.target;
      if (
        target instanceof Element &&
        target.closest(".gym-pin, .gym-cluster")
      ) {
        return;
      }
      if (window.matchMedia(BROWSE_MOBILE_MQ).matches) {
        const box = map.getCanvas().getBoundingClientRect();
        const x = box.left + e.point.x;
        const y = box.top + e.point.y;
        let best: HTMLElement | null = null;
        let bestD = 48;
        markersRef.current.forEach((marker) => {
          const el = marker.getElement();
          const btn = el.matches(".gym-cluster")
            ? el
            : el.querySelector<HTMLElement>(".gym-pin-hit");
          if (!btn) return;
          const r = btn.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
          if (d < bestD) {
            bestD = d;
            best = btn;
          }
        });
        if (best) {
          best.click();
          return;
        }
      }
      freezeListBoundsRef.current = false;
      selectedIdRef.current = null;
      setSelectedId(null);
    }

    syncPins();
    syncOriginPin();
    setMapBounds(readBounds());
    map.resize();

    map.on("move", onMapMove);
    map.on("moveend", onMoveEnd);
    map.on("dragstart", onDragStart);
    map.on("dragend", onDragEnd);
    map.on("click", onMapClick);

    return () => {
      if (pinRaf !== 0) cancelAnimationFrame(pinRaf);
      window.clearTimeout(idleListTimer);
      afterPinchSyncRef.current = null;
      map.off("move", onMapMove);
      map.off("moveend", onMoveEnd);
      map.off("dragstart", onDragStart);
      map.off("dragend", onDragEnd);
      map.off("click", onMapClick);
      clearMarkers();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    };
  }, [
    ctx.visibleGyms,
    ctx.mapReady,
    ctx.origin.lat,
    ctx.origin.lng,
    ctx.locationLabel,
    ctx.selectedMaakunta,
    ctx.chains,
    ctx.lang,
    ctx.t,
  ]);
}
