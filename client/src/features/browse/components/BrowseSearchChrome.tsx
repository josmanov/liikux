import { SlidersHorizontal } from "lucide-react";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowseSearchChromeProps = {
  t: TFn;
  query: string;
  onQuery: (value: string) => void;
  extrasOpen: boolean;
  filtersMoreActive: boolean;
  filtersMoreBadge: number;
  extrasLabel: string;
  onOpenExtras: () => void;
};

export function BrowseSearchChrome({
  t,
  query,
  onQuery,
  extrasOpen,
  filtersMoreActive,
  filtersMoreBadge,
  extrasLabel,
  onOpenExtras,
}: BrowseSearchChromeProps) {
  return (
    <div className="browse-chrome-main">
      <h1 className="browse-page-title">{t("gymsTitle")}</h1>
      <div className="browse-combo">
        <div className="browse-search">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="browse-search-icon"
          >
            <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
          </svg>
          <input
            className="browse-search-input"
            type="search"
            placeholder={t("searchGymPlaceholder")}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      </div>
      <button
        type="button"
        className={[
          "browse-filters-more",
          "browse-filters-more-search",
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
    </div>
  );
}
