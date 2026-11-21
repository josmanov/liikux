import type { RefObject } from "react";
import type { MessageKey } from "../../../i18n/messages";
import { BROWSE_SEARCH_QUICK } from "../utils/mapConstants";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowseSuggestChipsProps = {
  t: TFn;
  extraOnly247: boolean;
  extraFreeTrial: boolean;
  extraDayPass: boolean;
  womenOnly: boolean;
  onToggleWomen: () => void;
  onToggleExtra247: () => void;
  onToggleFreeTrial: () => void;
  onToggleDayPass: () => void;
  chipsRef: RefObject<HTMLDivElement | null>;
};

export function BrowseSuggestChips({
  t,
  extraOnly247,
  extraFreeTrial,
  extraDayPass,
  womenOnly,
  onToggleWomen,
  onToggleExtra247,
  onToggleFreeTrial,
  onToggleDayPass,
  chipsRef,
}: BrowseSuggestChipsProps) {
  return (
    <div className="browse-search-suggest">
      <p className="browse-search-suggest-label">{t("popularShort")}</p>
      <div className="browse-search-suggest-chips" ref={chipsRef}>
        {BROWSE_SEARCH_QUICK.map((item) => {
          const label =
            item.filter === "freeTrial"
              ? t("freeTrial")
              : item.filter === "only247"
                ? t("open247")
                : item.filter === "women"
                  ? t("audienceWomen")
                  : t("priceDayPass");
          const chipOn =
            item.filter === "freeTrial"
              ? extraFreeTrial
              : item.filter === "only247"
                ? extraOnly247
                : item.filter === "women"
                  ? womenOnly
                  : extraDayPass;
          return (
            <button
              key={item.id}
              type="button"
              className={["browse-search-suggest-chip", "is-toggle", chipOn ? "is-on" : ""].filter(Boolean).join(" ")}
              aria-pressed={chipOn}
              onClick={(e) => {
                (e.currentTarget as HTMLButtonElement).blur();
                if (item.filter === "freeTrial") onToggleFreeTrial();
                else if (item.filter === "only247") onToggleExtra247();
                else if (item.filter === "women") onToggleWomen();
                else onToggleDayPass();
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
