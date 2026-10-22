import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { toCitySlug } from "../../../data/regionSlug";
import {
  fetchGeoJson,
  observeMapContainerResize,
  waitForMapContainerSize,
} from "../../../map/maplibreSetup";
import {
  applyFinlandMinZoom,
  applyPinsMinZoom,
  centerFinlandIfMaxOut,
  framePadForOverlays,
} from "../utils/mapBounds";
import {
  ADDRESS_ZOOM,
  MAP_MAX_BOUNDS,
  MAAKUNTA_MAP_ACTIVE,
  ORIGIN_ZOOM,
  REGION_FILL_MATCH,
} from "../utils/mapConstants";
import { geomCentroid, pointInPolygon, type MaakuntaGeom } from "../utils/maakuntaGeom";
import type { Gym } from "../../../data/types";

export type BrowseMapInitCtx = {
  mapRef: MutableRefObject<HTMLDivElement | null>;
  mapInstanceRef: MutableRefObject<MapLibreMap | null>;
  originRef: MutableRefObject<{ lat: number; lng: number }>;
  mapPinchRef: MutableRefObject<boolean>;
  mapTouchCountRef: MutableRefObject<number>;
  afterPinchSyncRef: MutableRefObject<(() => void) | null>;
  browseCitySlugRef: MutableRefObject<string | null>;
  selectedIdRef: MutableRefObject<string | null>;
  gymsRef: MutableRefObject<Gym[]>;
  routeRegionNameRef: MutableRefObject<string | null>;
  regionUserPickedRef: MutableRefObject<boolean>;
  selectedMaakuntaRef: MutableRefObject<string | null>;
  maakuntaFeaturesRef: MutableRefObject<
    { nimi: string; maakunta: string; geometry: MaakuntaGeom }[]
  >;
  fitKeyRef: MutableRefObject<string>;
  regionPickModeRef: MutableRefObject<boolean>;
  setMapReady: Dispatch<SetStateAction<boolean>>;
  setMaakunnatReady: Dispatch<SetStateAction<boolean>>;
  setBrowseAllAreas: Dispatch<SetStateAction<boolean>>;
  setSelectedMaakunta: Dispatch<SetStateAction<string | null>>;
  setRegionNames: Dispatch<SetStateAction<string[]>>;
  markersRef: MutableRefObject<globalThis.Map<string, Marker>>;
  originMarkerRef: MutableRefObject<Marker | null>;
};

export function useBrowseMapInit(ctx: BrowseMapInitCtx) {
  useEffect(() => {
    const {
      mapRef,
      mapInstanceRef,
      originRef,
      mapPinchRef,
      mapTouchCountRef,
      afterPinchSyncRef,
      browseCitySlugRef,
      selectedIdRef,
      gymsRef,
      routeRegionNameRef,
      regionUserPickedRef,
      selectedMaakuntaRef,
      maakuntaFeaturesRef,
      fitKeyRef,
      regionPickModeRef,
      setMapReady,
      setMaakunnatReady,
      setBrowseAllAreas,
      setSelectedMaakunta,
      setRegionNames,
      markersRef,
      originMarkerRef,
    } = ctx;

    if (!mapRef.current) return;

    const start = originRef.current;
    const map = new MapLibreMap({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [start.lng, start.lat],
      zoom: ORIGIN_ZOOM,
      maxBounds: MAP_MAX_BOUNDS,
      maxPitch: 0,
      pitchWithRotate: false,
      touchPitch: false,
      dragRotate: false,
      attributionControl: false,
    });

    map.touchPitch.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.setMaxPitch(0);
    mapInstanceRef.current = map;

    const canvas = map.getCanvasContainer();
    function onTouchStart(e: TouchEvent) {
      mapTouchCountRef.current = e.touches.length;
      if (e.touches.length >= 2) {
        mapPinchRef.current = true;
      }
    }
    function onTouchEnd(e: TouchEvent) {
      mapTouchCountRef.current = e.touches.length;
      if (!mapPinchRef.current) return;
      if (e.touches.length > 0) return;
      mapPinchRef.current = false;
      afterPinchSyncRef.current?.();
    }
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    function syncMinZoom() {
      if (selectedIdRef.current) return;
      const slug = browseCitySlugRef.current;
      if (!slug) {
        applyFinlandMinZoom(map);
        return;
      }
      const pins = gymsRef.current.filter(
        (g) =>
          g.lat != null &&
          g.lng != null &&
          toCitySlug(g.city) === slug,
      );
      applyPinsMinZoom(
        map,
        pins.map((g) => ({ lat: g.lat!, lng: g.lng! })),
        framePadForOverlays(map, { labelTop: 36 }),
      );
    }

    function onResize() {
      syncMinZoom();
    }

    function onMaxOutView() {
      if (mapPinchRef.current) return;
      if (browseCitySlugRef.current) return;
      centerFinlandIfMaxOut(map);
    }

    let dead = false;
    let revealed = false;
    const bootFailSafe = window.setTimeout(() => {
      if (dead || revealed) return;
      revealed = true;
      setMapReady(true);
    }, 2500);

    async function settleStartView() {
      if (dead || revealed) return;
      await waitForMapContainerSize(map.getContainer(), map);
      if (dead || revealed) return;

      const o = originRef.current;
      map.jumpTo({
        center: [o.lng, o.lat],
        zoom: ADDRESS_ZOOM,
      });
      syncMinZoom();
      if (map.getZoom() < map.getMinZoom()) {
        map.setZoom(map.getMinZoom());
      }

      let nimi: string | null = null;
      const fromUrl = routeRegionNameRef.current;
      if (fromUrl) {
        nimi = fromUrl;
        regionUserPickedRef.current = true;
      } else if (regionUserPickedRef.current && selectedMaakuntaRef.current) {
        nimi = selectedMaakuntaRef.current;
      } else {
        for (const f of maakuntaFeaturesRef.current) {
          if (pointInPolygon(o.lng, o.lat, f.geometry)) {
            nimi = f.nimi;
            break;
          }
        }
      }
      selectedMaakuntaRef.current = nimi;
      regionPickModeRef.current =
        MAAKUNTA_MAP_ACTIVE && nimi == null;
      setBrowseAllAreas(!MAAKUNTA_MAP_ACTIVE);
      setSelectedMaakunta(nimi);
      fitKeyRef.current = fromUrl
        ? `route:${fromUrl}`
        : `origin:${o.lat}:${o.lng}`;

      if (MAAKUNTA_MAP_ACTIVE && nimi) {
        const hideOpen = ["!=", ["get", "nimi"], nimi] as [
          "!=",
          ["get", string],
          string,
        ];
        for (const id of ["maakunnat-fill", "maakunnat-line", "maakunnat-label"]) {
          if (map.getLayer(id)) map.setFilter(id, hideOpen);
        }
      }
      if (!MAAKUNTA_MAP_ACTIVE) {
        for (const id of ["maakunnat-fill", "maakunnat-line", "maakunnat-label"]) {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", "none");
          }
        }
      }

      function reveal() {
        if (dead || revealed) return;
        revealed = true;
        window.clearTimeout(failSafe);
        window.clearTimeout(bootFailSafe);
        map.resize();
        setMapReady(true);
      }

      const failSafe = window.setTimeout(reveal, 700);
      map.once("idle", reveal);
      if (map.areTilesLoaded()) {
        window.setTimeout(reveal, 40);
      }
    }

    map.on("load", () => {
      void (async () => {
        try {
          await waitForMapContainerSize(map.getContainer(), map);
          if (dead) return;

          applyFinlandMinZoom(map);
          const o = originRef.current;
          map.jumpTo({
            center: [o.lng, o.lat],
            zoom: ADDRESS_ZOOM,
          });

          const [maskData, outlineData, maakuntaData] = await Promise.all([
            fetchGeoJson("/geo/finland-mask.json"),
            fetchGeoJson("/geo/finland.json"),
            fetchGeoJson("/geo/maakunnat.json"),
          ]);
          if (dead) return;

          if (maskData && !map.getSource("finland-mask")) {
            map.addSource("finland-mask", {
              type: "geojson",
              data: maskData as object as never,
            });
            map.addLayer({
              id: "finland-mask-fill",
              type: "fill",
              source: "finland-mask",
              paint: {
                "fill-color": "#0b1220",
                "fill-opacity": 0.55,
              },
            });
          }

          if (outlineData && !map.getSource("finland-outline")) {
            map.addSource("finland-outline", {
              type: "geojson",
              data: outlineData as object as never,
            });
            map.addLayer({
              id: "finland-outline-line",
              type: "line",
              source: "finland-outline",
              paint: {
                "line-color": "#94a3b8",
                "line-width": 1.2,
                "line-opacity": 0.7,
              },
            });
          }

          if (
            maakuntaData &&
            typeof maakuntaData === "object" &&
            "features" in maakuntaData &&
            Array.isArray((maakuntaData as { features: unknown }).features) &&
            !map.getSource("maakunnat")
          ) {
            const features = (
              maakuntaData as {
                features: {
                  properties: { nimi: string; maakunta: string };
                  geometry: MaakuntaGeom;
                }[];
              }
            ).features;

            maakuntaFeaturesRef.current = features.map((f) => ({
              nimi: f.properties.nimi,
              maakunta: f.properties.maakunta,
              geometry: f.geometry,
            }));

            map.addSource("maakunnat", {
              type: "geojson",
              data: maakuntaData as object as never,
              promoteId: "maakunta",
            });

            const labelPoints = {
              type: "FeatureCollection" as const,
              features: features.map((f) => ({
                type: "Feature" as const,
                properties: {
                  nimi: f.properties.nimi,
                  maakunta: f.properties.maakunta,
                },
                geometry: {
                  type: "Point" as const,
                  coordinates: geomCentroid(f.geometry),
                },
              })),
            };
            map.addSource("maakunnat-labels", {
              type: "geojson",
              data: labelPoints,
              promoteId: "maakunta",
            });
            map.addLayer({
              id: "maakunnat-fill",
              type: "fill",
              source: "maakunnat",
              paint: {
                "fill-color": REGION_FILL_MATCH as never,
                "fill-opacity": [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  0.55,
                  0.34,
                ],
              },
            });
            map.addLayer({
              id: "maakunnat-line",
              type: "line",
              source: "maakunnat",
              paint: {
                "line-color": "#0f2744",
                "line-width": 1.4,
                "line-opacity": 0.85,
              },
            });
            try {
              map.addLayer({
                id: "maakunnat-label",
                type: "symbol",
                source: "maakunnat-labels",
                layout: {
                  "text-field": ["get", "nimi"],
                  "text-size": 11,
                  "text-transform": "uppercase",
                  "text-letter-spacing": 0.03,
                  "text-max-width": 8,
                  "text-allow-overlap": false,
                  "text-ignore-placement": false,
                },
                paint: {
                  "text-color": "#ffffff",
                  "text-halo-color": "rgba(15, 39, 68, 0.8)",
                  "text-halo-width": 1.5,
                },
              });
            } catch {
              /* fontti ei kaada alueita */
            }
            setMaakunnatReady(true);
            setRegionNames(
              maakuntaFeaturesRef.current
                .map((f) => f.nimi)
                .sort((a, b) => a.localeCompare(b, "fi")),
            );
          }
        } catch {
          /* peite ei kaada karttaa */
        } finally {
          if (!dead) {
            await settleStartView();
          }
        }
      })();
    });

    map.on("zoomend", onMaxOutView);
    map.on("moveend", onMaxOutView);
    window.addEventListener("resize", onResize);
    const stopContainerResize = observeMapContainerResize(
      map.getContainer(),
      map,
    );

    return () => {
      dead = true;
      window.clearTimeout(bootFailSafe);
      stopContainerResize();
      mapPinchRef.current = false;
      mapTouchCountRef.current = 0;
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      try {
        map.dragPan.enable();
      } catch {
        /* map gone */
      }
      window.removeEventListener("resize", onResize);
      map.off("zoomend", onMaxOutView);
      map.off("moveend", onMaxOutView);
      setMapReady(false);
      setMaakunnatReady(false);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      mapInstanceRef.current = null;
      map.remove();
    };
  }, []);
}
