import {
  ChevronRight,
  Clock,
  Gift,
  Link2,
  Ticket,
  X,
} from "lucide-react";
import UxSwitch from "../../../components/UxSwitch";
import type { MessageKey } from "../../../i18n/messages";
import { BrowseDistanceRange } from "./BrowseDistanceRange";
import { BrowsePriceRange } from "./BrowsePriceRange";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type DistancePreset = { id: string; km: number | null; label: string };

type BrowseExtrasMenuProps = {
  t: TFn;
  chainFilterActive: boolean;
  selectedChainsCount: number;
  priceMin: number;
  priceMax: number;
  onPriceMin: (n: number) => void;
  onPriceMax: (n: number) => void;
  maxDistanceKm: number | null;
  distancePresetIndex: number;
  distancePresets: DistancePreset[];
  distanceFilter: string;
  onDistanceFilter: (id: string) => void;
  womenOnly: boolean;
  onWomenOnly: (on: boolean) => void;
  extraOnly247: boolean;
  onExtraOnly247: (on: boolean) => void;
  extraFreeTrial: boolean;
  onExtraFreeTrial: (on: boolean) => void;
  extraDayPass: boolean;
  onExtraDayPass: (on: boolean) => void;
  onClose: () => void;
  onOpenChains: () => void;
  onClearOptions: () => void;
  onClearAll: () => void;
};

export function BrowseExtrasMenu({
  t,
  chainFilterActive,
  selectedChainsCount,
  priceMin,
  priceMax,
  onPriceMin,
  onPriceMax,
  maxDistanceKm,
  distancePresetIndex,
  distancePresets,
  distanceFilter,
  onDistanceFilter,
  womenOnly,
  onWomenOnly,
  extraOnly247,
  onExtraOnly247,
  extraFreeTrial,
  onExtraFreeTrial,
  extraDayPass,
  onExtraDayPass,
  onClose,
  onOpenChains,
  onClearOptions,
  onClearAll,
}: BrowseExtrasMenuProps) {
  return (
    <div className="browse-extras-root" role="presentation" onClick={onClose}>
      <div
        className="browse-extras-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("filters")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="browse-extras-head">
          <div className="browse-extras-banner-row">
            <h2 className="browse-extras-title">{t("filters")}</h2>
            <button
              type="button"
              className="chain-popup-close"
              aria-label={t("close")}
              onClick={onClose}
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
          <p className="browse-extras-text browse-extras-hint-desk">
            {t("extrasHint")}
          </p>
        </div>

        <div className="browse-extras-mobile-block">
          <button
            type="button"
            className={"browse-extras-jump" + (chainFilterActive ? " is-on" : "")}
            onClick={onOpenChains}
          >
            <Link2 size={18} strokeWidth={2.2} />
            <span>
              {t("chains")}
              {chainFilterActive ? ` · ${selectedChainsCount}` : ""}
            </span>
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>

          <div className="browse-extras-section">
            <BrowsePriceRange
              priceMin={priceMin}
              priceMax={priceMax}
              onPriceMin={onPriceMin}
              onPriceMax={onPriceMax}
              t={t}
            />
          </div>

          <div className="browse-extras-section">
            <BrowseDistanceRange
              distancePresets={distancePresets}
              distancePresetIndex={distancePresetIndex}
              distanceFilter={distanceFilter}
              maxDistanceKm={maxDistanceKm}
              onDistanceFilter={onDistanceFilter}
              t={t}
            />
          </div>
        </div>

        <div className="browse-extras-options">
          <label className="browse-extras-row browse-extras-women">
            <span className="browse-extras-row-copy">
              <img
                className="browse-extras-row-icon"
                src="/icons/kenelle-women.png"
                alt=""
              />
              <span>
                <strong>{t("audienceWomen")}</strong>
                <span className="browse-extras-desc">
                  {t("audienceWomenDesc")}
                </span>
              </span>
            </span>
            <UxSwitch checked={womenOnly} onChange={onWomenOnly} />
          </label>
          <label className="browse-extras-row">
            <span className="browse-extras-row-copy">
              <Clock
                className="browse-extras-row-icon is-lucide"
                size={18}
                strokeWidth={2.2}
              />
              <span>
                <strong>{t("open247")}</strong>
                <span className="browse-extras-desc">{t("open247Desc")}</span>
              </span>
            </span>
            <UxSwitch checked={extraOnly247} onChange={onExtraOnly247} />
          </label>
          <label className="browse-extras-row">
            <span className="browse-extras-row-copy">
              <Gift
                className="browse-extras-row-icon is-lucide"
                size={18}
                strokeWidth={2.2}
              />
              <span>
                <strong>{t("freeTrial")}</strong>
                <span className="browse-extras-desc">{t("freeTrialDesc")}</span>
              </span>
            </span>
            <UxSwitch checked={extraFreeTrial} onChange={onExtraFreeTrial} />
          </label>
          <label className="browse-extras-row">
            <span className="browse-extras-row-copy">
              <Ticket
                className="browse-extras-row-icon is-lucide"
                size={18}
                strokeWidth={2.2}
              />
              <span>
                <strong>{t("priceDayPass")}</strong>
                <span className="browse-extras-desc">{t("dayPassDesc")}</span>
              </span>
            </span>
            <UxSwitch checked={extraDayPass} onChange={onExtraDayPass} />
          </label>
        </div>

        <div className="browse-extras-footer">
          <button
            type="button"
            className="browse-extras-btn browse-extras-btn-ghost browse-extras-clear-desk"
            onClick={onClearOptions}
          >
            {t("clear")}
          </button>
          <button
            type="button"
            className="browse-extras-btn browse-extras-btn-ghost browse-extras-clear-mobile"
            onClick={onClearAll}
          >
            {t("clear")}
          </button>
          <button
            type="button"
            className="browse-extras-btn"
            onClick={onClose}
          >
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
}
