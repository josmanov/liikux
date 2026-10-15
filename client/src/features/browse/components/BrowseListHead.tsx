import type { RefObject } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import type { CityCenter } from "../../../data/citySlug";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type SortOption = { id: string; label: string; icon: "map" | "down" | "up" };

type BrowseListHeadProps = {
  t: TFn;
  regionPickMode: boolean;
  regionDropRef: RefObject<HTMLDivElement | null>;
  regionMenuOpen: boolean;
  regionSheetOpen: boolean;
  mobileList: boolean;
  regionLabel: string;
  cityQuery: string;
  onCityQuery: (value: string) => void;
  cityOptions: CityCenter[];
  activeCitySlug: string | null;
  onFocusCity: (city: CityCenter) => void;
  onRegionClick: () => void;
  inViewCount: number;
  safePage: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  sortLabel: string;
  sortId: string;
  sortOptions: SortOption[];
  sortMenuOpen: boolean;
  onToggleSort: () => void;
  onSelectSort: (id: string) => void;
};

export function BrowseListHead({
  t,
  regionPickMode,
  regionDropRef,
  regionMenuOpen,
  regionSheetOpen,
  mobileList,
  regionLabel,
  cityQuery,
  onCityQuery,
  cityOptions,
  activeCitySlug,
  onFocusCity,
  onRegionClick,
  inViewCount,
  safePage,
  pageCount,
  onPrev,
  onNext,
  sortLabel,
  sortId,
  sortOptions,
  sortMenuOpen,
  onToggleSort,
  onSelectSort,
}: BrowseListHeadProps) {
  return (
    <header className="browse-list-head">
      <div className="browse-list-head-side">
        {regionPickMode ? (
          <p className="browse-list-count">{t("pickRegion")}</p>
        ) : (
          <div
            ref={regionDropRef}
            className={[
              "browse-region-drop",
              "browse-page-city",
              "browse-list-city",
              regionMenuOpen || regionSheetOpen ? "is-open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              type="button"
              className="browse-region-drop-btn"
              aria-expanded={regionMenuOpen || regionSheetOpen}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onRegionClick();
              }}
            >
              <Building2
                className="browse-region-drop-ico"
                size={16}
                strokeWidth={2.3}
                aria-hidden="true"
              />
              <span>{regionLabel}</span>
              <ChevronDown
                className="browse-region-drop-chevron"
                size={16}
                strokeWidth={2.2}
              />
            </button>
            {!mobileList && regionMenuOpen ? (
              <div className="browse-region-drop-menu">
                <label className="browse-region-drop-search">
                  <input
                    type="search"
                    value={cityQuery}
                    placeholder={t("searchCity")}
                    aria-label={t("searchCity")}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => onCityQuery(e.target.value)}
                  />
                </label>
                <ul className="browse-region-drop-list">
                  {cityOptions.map((city) => (
                    <li key={city.slug}>
                      <button
                        type="button"
                        className={
                          city.slug === activeCitySlug ? "is-on" : ""
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onFocusCity(city)}
                      >
                        {city.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {!regionPickMode ? (
        <p className="browse-list-qty">
          {t("gymCountPcs", { count: inViewCount })}
        </p>
      ) : (
        <span className="browse-list-qty-spacer" aria-hidden="true" />
      )}
      {!regionPickMode ? (
        <div className="browse-list-pager">
          <button
            type="button"
            className="browse-pager-btn"
            aria-label={t("previous")}
            disabled={safePage <= 1}
            onClick={onPrev}
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <span className="browse-list-page-num">{safePage}</span>
          <button
            type="button"
            className="browse-pager-btn"
            aria-label={t("next")}
            disabled={safePage >= pageCount}
            onClick={onNext}
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}
      <div className="browse-sort">
        <button
          type="button"
          className="browse-sort-btn"
          aria-expanded={sortMenuOpen}
          aria-haspopup="listbox"
          onClick={onToggleSort}
        >
          <ArrowUpDown size={16} strokeWidth={2.2} />
          <span className="browse-sort-label">{sortLabel}</span>
          <ChevronDown
            className="browse-sort-chevron"
            size={16}
            strokeWidth={2.2}
          />
        </button>
        {sortMenuOpen ? (
          <ul className="browse-sort-menu" role="listbox">
            {sortOptions.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  className={opt.id === sortId ? "is-on" : ""}
                  role="option"
                  aria-selected={opt.id === sortId}
                  onClick={() => onSelectSort(opt.id)}
                >
                  {opt.icon === "map" ? (
                    <MapPin
                      className="browse-sort-opt-icon"
                      size={16}
                      strokeWidth={2.2}
                    />
                  ) : null}
                  {opt.icon === "down" ? (
                    <ArrowDown
                      className="browse-sort-opt-icon"
                      size={16}
                      strokeWidth={2.2}
                    />
                  ) : null}
                  {opt.icon === "up" ? (
                    <ArrowUp
                      className="browse-sort-opt-icon"
                      size={16}
                      strokeWidth={2.2}
                    />
                  ) : null}
                  <span>{opt.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </header>
  );
}
