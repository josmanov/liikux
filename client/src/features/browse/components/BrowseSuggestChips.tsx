import type { RefObject } from "react";
import type { MessageKey } from "../../../i18n/messages";
import { BROWSE_SEARCH_QUICK } from "../utils/mapConstants";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowseSuggestChipsProps = {
  t: TFn;
  query: string;
  extraOnly247: boolean;
  extraFreeTrial: boolean;
  extraDayPass: boolean;
  onToggleExtra247: () => void;
  onToggleFreeTrial: () => void;
  onToggleDayPass: () => void;
  onPickQuery: (q: string) => void;
  chipsRef: RefObject<HTMLDivElement | null>;
};

export function BrowseSuggestChips({
  t,
  query,
  extraOnly247,
  extraFreeTrial,
  extraDayPass,
  onToggleExtra247,
  onToggleFreeTrial,
  onToggleDayPass,
  onPickQuery,
  chipsRef,
}: BrowseSuggestChipsProps) {
  return (
    <div className="browse-search-suggest">
      <p className="browse-search-suggest-label">{t("popularShort")}</p>
      <div className="browse-search-suggest-chips" ref={chipsRef}>
        {BROWSE_SEARCH_QUICK.map((item) => {
          const label =
            "filter" in item
              ? item.filter === "freeTrial"
                ? t("freeTrial")
                : item.filter === "only247"
                  ? t("open247")
                  : t("priceDayPass")
              : item.q;
          const chipOn =
            "filter" in item
              ? item.filter === "freeTrial"
                ? extraFreeTrial
                : item.filter === "only247"
                  ? extraOnly247
                  : extraDayPass
              : query.trim().toLowerCase() === item.q.toLowerCase();
          return (
            <button
              key={item.id}
              type="button"
              className={
                chipOn
                  ? "browse-search-suggest-chip is-on"
                  : "browse-search-suggest-chip"
              }
              aria-pressed={chipOn}
              onClick={(e) => {
                (e.currentTarget as HTMLButtonElement).blur();
                if ("filter" in item) {
                  if (item.filter === "freeTrial") {
                    onToggleFreeTrial();
                  } else if (item.filter === "only247") {
                    onToggleExtra247();
                  } else {
                    onToggleDayPass();
                  }
                  return;
                }
                onPickQuery(chipOn ? "" : item.q);
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
