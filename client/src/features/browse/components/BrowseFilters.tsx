import { ChevronDown, Euro, Link2, Route, SlidersHorizontal } from "lucide-react";
import type { MessageKey } from "../../../i18n/messages";
import type { FilterKey } from "../utils/mapConstants";
import { BrowseDistanceRange } from "./BrowseDistanceRange";
import { BrowsePriceRange } from "./BrowsePriceRange";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type DistancePreset = { id: string; km: number | null; label: string };

type BrowseFiltersProps = {
  t: TFn;
  chainFilterActive: boolean;
  selectedChainsCount: number;
  priceFilterOn: boolean;
  priceInfo: string;
  openFilter: FilterKey | null;
  onToggleFilter: (key: FilterKey) => void;
  priceMin: number;
  priceMax: number;
  onPriceMin: (n: number) => void;
  onPriceMax: (n: number) => void;
  maxDistanceKm: number | null;
  distancePresetIndex: number;
  distancePresets: DistancePreset[];
  distanceFilter: string;
  onDistanceFilter: (id: string) => void;
  filtersMoreActive: boolean;
  filtersMoreBadge: number;
  extrasLabel: string;
  extrasOpen: boolean;
  onOpenChains: () => void;
  onOpenExtras: () => void;
  onClear: () => void;
};

export function BrowseFilters({
  t,
  chainFilterActive,
  selectedChainsCount,
  priceFilterOn,
  priceInfo,
  openFilter,
  onToggleFilter,
  priceMin,
  priceMax,
  onPriceMin,
  onPriceMax,
  maxDistanceKm,
  distancePresetIndex,
  distancePresets,
  distanceFilter,
  onDistanceFilter,
  filtersMoreActive,
  filtersMoreBadge,
  extrasLabel,
  extrasOpen,
  onOpenChains,
  onOpenExtras,
  onClear,
}: BrowseFiltersProps) {
  const maxDistanceValueText =
    maxDistanceKm == null
      ? t("distanceAll")
      : t("distanceKm", { km: maxDistanceKm });

  return (
    <div className="browse-chrome-filters">
      <div className="browse-filter">
        <button
          type="button"
          className={["browse-filter-btn", chainFilterActive ? "is-on" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-haspopup="dialog"
          onClick={onOpenChains}
        >
          <Link2 className="browse-filter-icon" size={18} strokeWidth={2.2} />
          <span className="browse-filter-label">{t("chains")}</span>
          <span className="browse-filter-info">
            {chainFilterActive ? `· ${selectedChainsCount}` : ""}
          </span>
        </button>
      </div>

      <div className="browse-filter">
        <button
          type="button"
          className={["browse-filter-btn", priceFilterOn ? "is-on" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={openFilter === "price"}
          aria-haspopup="dialog"
          onClick={() => onToggleFilter("price")}
        >
          <Euro className="browse-filter-icon" size={18} strokeWidth={2.2} />
          <span className="browse-filter-label">{t("price")}</span>
          <span className="browse-filter-info">{priceInfo}</span>
          <ChevronDown size={16} strokeWidth={2.2} />
        </button>
        {openFilter === "price" ? (
          <div
            className="browse-filter-menu browse-filter-menu-range"
            role="dialog"
            aria-label={t("price")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="browse-range">
              <BrowsePriceRange
                priceMin={priceMin}
                priceMax={priceMax}
                onPriceMin={onPriceMin}
                onPriceMax={onPriceMax}
                t={t}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="browse-filter">
        <button
          type="button"
          className={["browse-filter-btn", maxDistanceKm != null ? "is-on" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={openFilter === "distance"}
          aria-haspopup="dialog"
          onClick={() => onToggleFilter("distance")}
        >
          <Route className="browse-filter-icon" size={18} strokeWidth={2.2} />
          <span className="browse-filter-label">{t("distance")}</span>
          <span className="browse-filter-info">
            {maxDistanceKm != null ? `· ${maxDistanceKm} km` : ""}
          </span>
          <ChevronDown size={16} strokeWidth={2.2} />
        </button>
        {openFilter === "distance" ? (
          <div
            className="browse-filter-menu browse-filter-menu-range is-wide"
            role="dialog"
            aria-label={t("distance")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="browse-range">
              <BrowseDistanceRange
                distancePresets={distancePresets}
                distancePresetIndex={distancePresetIndex}
                distanceFilter={distanceFilter}
                maxDistanceKm={maxDistanceKm}
                onDistanceFilter={onDistanceFilter}
                valueText={maxDistanceValueText}
                t={t}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="browse-filters-actions">
        <button
          type="button"
          className={[
            "browse-filters-more",
            "browse-filters-more-desk",
            filtersMoreActive ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-haspopup="dialog"
          aria-expanded={extrasOpen}
          aria-label={extrasLabel}
          onClick={onOpenExtras}
        >
          <SlidersHorizontal size={16} strokeWidth={2.2} />
          <span className="browse-filters-more-label">{extrasLabel}</span>
          {filtersMoreActive ? (
            <span className="browse-filters-badge">{filtersMoreBadge}</span>
          ) : null}
        </button>
        <button type="button" className="browse-filters-clear" onClick={onClear}>
          {t("clearFiltersBtn")}
        </button>
      </div>
    </div>
  );
}
