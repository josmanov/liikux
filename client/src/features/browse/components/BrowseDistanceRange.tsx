import { Route } from "lucide-react";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type DistancePreset = { id: string; km: number | null; label: string };

type BrowseDistanceRangeProps = {
  distancePresets: DistancePreset[];
  distancePresetIndex: number;
  distanceFilter: string;
  maxDistanceKm: number | null;
  onDistanceFilter: (id: string) => void;
  valueText?: string;
  t: TFn;
};

export function BrowseDistanceRange({
  distancePresets,
  distancePresetIndex,
  distanceFilter,
  maxDistanceKm,
  onDistanceFilter,
  valueText,
  t,
}: BrowseDistanceRangeProps) {
  return (
    <>
      <div className="browse-distance-head">
        <span className="browse-slider-title">
          <Route size={16} strokeWidth={2.2} />
          {t("distanceMax")}
        </span>
        <strong>
          {maxDistanceKm == null ? t("distanceAll") : `${maxDistanceKm} km`}
        </strong>
      </div>
      <div className="browse-dual">
        <div className="browse-dual-rail">
          <div
            className="browse-dual-fill"
            style={{
              left: "0%",
              width: `${
                (distancePresetIndex /
                  Math.max(1, distancePresets.length - 1)) *
                100
              }%`,
            }}
          />
        </div>
        <input
          className="browse-dual-input is-hi"
          type="range"
          min={0}
          max={distancePresets.length - 1}
          step={1}
          value={distancePresetIndex}
          aria-label={t("distanceMax")}
          aria-valuetext={valueText}
          onChange={(e) => {
            const next =
              distancePresets[Number(e.target.value)] ?? distancePresets[0];
            onDistanceFilter(next.id);
          }}
        />
      </div>
      <div className="browse-distance-marks">
        {distancePresets.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={
              opt.id === distanceFilter
                ? "browse-distance-mark is-on"
                : "browse-distance-mark"
            }
            onClick={() => onDistanceFilter(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
