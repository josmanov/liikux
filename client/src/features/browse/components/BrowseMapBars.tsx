import { Map as MapIcon } from "lucide-react";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowseMapBarsProps = {
  t: TFn;
  /** Gyms inside the visible part of the map (with the current filters). */
  countOnMap: number;
};

/**
 * Desktop only: a bar above and below the map, the same height as the list's
 * own head (area, count, sort) and page bar, so both panels line up.
 *   top:    how many gyms are on the map now (the + / − / location buttons sit at its right end)
 *   bottom: what the map symbols mean · map credits (required by OpenStreetMap)
 */
export function BrowseMapBars({ t, countOnMap }: BrowseMapBarsProps) {
  return (
    <>
      <div className="browse-map-bar is-top" onClick={(e) => e.stopPropagation()}>
        <span className="browse-map-bar-count">
          <MapIcon size={16} strokeWidth={2.2} aria-hidden="true" />
          {countOnMap === 1 ? t("mapBarOne") : t("mapBarCount", { n: countOnMap })}
        </span>
      </div>
      <div className="browse-map-bar is-bottom" onClick={(e) => e.stopPropagation()}>
        <ul className="browse-map-legend" aria-label={t("mapLegend")}>
          <li>
            <span className="legend-pin" aria-hidden="true">
              <span>€</span>
            </span>
            {t("legendGym")}
          </li>
          <li>
            <img className="legend-cluster" src="/pins/cluster-kettlebell.png" alt="" />
            {t("legendCluster")}
          </li>
          <li>
            <span className="legend-you" aria-hidden="true" />
            {t("legendYou")}
          </li>
        </ul>
        <p className="browse-map-credits">
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
            OpenFreeMap
          </a>{" "}
          ©{" "}
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">
            OpenMapTiles
          </a>{" "}
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
        </p>
      </div>
    </>
  );
}
