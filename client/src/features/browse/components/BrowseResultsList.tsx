import type { RefObject } from "react";
import LoadSpin from "../../../components/LoadSpin";
import { chainForGym } from "../../../data/audience";
import type { Chain, Gym } from "../../../data/types";
import type { Lang } from "../../../i18n/lang";
import type { MessageKey } from "../../../i18n/messages";
import { distanceKm } from "../utils/distanceKm";
import { BrowsePageBar } from "./BrowsePageBar";
import { GymResultCard } from "./GymResultCard";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type BrowseResultsListProps = {
  t: TFn;
  lang: Lang;
  origin: { lat: number; lng: number };
  chains: Chain[];
  listScrollRef: RefObject<HTMLDivElement | null>;
  regionPickMode: boolean;
  listLoading: boolean;
  pageJumpLoading: boolean;
  showMissing: boolean;
  browseReady: boolean;
  mobileList: boolean;
  pageGyms: Gym[];
  inViewCount: number;
  visibleCount: number;
  gymsCount: number;
  hoveredId: string | null;
  selectedId: string | null;
  favoriteSlugs: string[];
  onHover: (id: string | null) => void;
  onToggleFavorite: (slug: string) => void;
  onFocusGym: (gym: Gym) => void;
  safePage: number;
  pageCount: number;
  onPage: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function BrowseResultsList({
  t,
  lang,
  origin,
  chains,
  listScrollRef,
  regionPickMode,
  listLoading,
  pageJumpLoading,
  showMissing,
  browseReady,
  mobileList,
  pageGyms,
  inViewCount,
  visibleCount,
  gymsCount,
  hoveredId,
  selectedId,
  favoriteSlugs,
  onHover,
  onToggleFavorite,
  onFocusGym,
  safePage,
  pageCount,
  onPage,
  onPrev,
  onNext,
}: BrowseResultsListProps) {
  return (
    <>
      <div
        className="browse-list-scroll"
        ref={listScrollRef}
        data-count={pageGyms.length}
      >
        {regionPickMode ? (
          <p className="browse-region-empty">{t("pickRegion")}</p>
        ) : null}
        {!listLoading &&
        !regionPickMode &&
        inViewCount === 0 &&
        gymsCount > 0 ? (
          <div className="browse-missing-slot">
            <p className="browse-missing">
              {visibleCount === 0 ? t("noGymsFilters") : t("noGymsInView")}
              <span>{t("missingGymHint")}</span>
            </p>
          </div>
        ) : null}
        <ul className={browseReady ? "browse-rows list-pop" : "browse-rows"}>
          {pageGyms.map((gym, i) => {
            const chain = chainForGym(gym, chains);
            const distKm =
              gym.lat != null && gym.lng != null
                ? distanceKm(origin.lat, origin.lng, gym.lat, gym.lng)
                : null;
            return (
              <GymResultCard
                key={gym.id}
                gym={gym}
                chain={chain}
                distKm={distKm}
                index={i}
                lang={lang}
                t={t}
                origin={origin}
                isHovered={hoveredId === gym.id}
                isSelected={selectedId === gym.id}
                isFav={favoriteSlugs.includes(gym.slug)}
                onHover={onHover}
                onToggleFavorite={() => onToggleFavorite(gym.slug)}
                onFocus={() => onFocusGym(gym)}
              />
            );
          })}
        </ul>
        {showMissing ? (
          <div className="browse-missing-slot">
            <p className="browse-missing">
              {t("missingGym")}
              <span>{t("missingGymHint")}</span>
            </p>
          </div>
        ) : null}
        {listLoading || pageJumpLoading ? (
          <div className="browse-list-loading">
            <LoadSpin />
          </div>
        ) : null}
        {!mobileList && !listLoading && !pageJumpLoading && !regionPickMode ? (
          <BrowsePageBar
            safePage={safePage}
            pageCount={pageCount}
            previousLabel={t("previous")}
            nextLabel={t("next")}
            onPage={onPage}
            onPrev={onPrev}
            onNext={onNext}
          />
        ) : null}
      </div>
      {mobileList && !listLoading && !pageJumpLoading && !regionPickMode ? (
        <BrowsePageBar
          safePage={safePage}
          pageCount={pageCount}
          previousLabel={t("previous")}
          nextLabel={t("next")}
          onPage={onPage}
          onPrev={onPrev}
          onNext={onNext}
        />
      ) : null}
    </>
  );
}
