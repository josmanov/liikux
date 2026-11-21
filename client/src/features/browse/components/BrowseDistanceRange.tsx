import { Route } from "lucide-react";
import { BrowseSlider } from "./BrowseSlider";
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
      <BrowseSlider
        min={0}
        max={distancePresets.length - 1}
        step={1}
        values={[distancePresetIndex]}
        labels={[t("distanceMax")]}
        onChange={(_i, v) => {
          const next = distancePresets[v] ?? distancePresets[0];
          onDistanceFilter(next.id);
        }}
      />
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
