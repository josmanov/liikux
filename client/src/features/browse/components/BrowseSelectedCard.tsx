import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChainSummary, Gym } from "../../../data/types";
import { formatDistanceKm } from "../../../data/format";
import { pathGym, type Lang } from "../../../i18n/lang";
import type { MessageKey } from "../../../i18n/messages";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export type SelectedGymCard = {
  gym: Gym;
  chain: ChainSummary | null;
  siteName: string;
  street: string;
  priceLabel: string | null;
  distKm: number | null;
};

type BrowseSelectedCardProps = {
  selected: SelectedGymCard;
  lang: Lang;
  t: TFn;
  origin: { lat: number; lng: number };
  isFav: boolean;
  onToggleFavorite: () => void;
};

export function BrowseSelectedCard({
  selected,
  lang,
  t,
  origin,
  isFav,
  onToggleFavorite,
}: BrowseSelectedCardProps) {
  return (
    <div className="browse-map-preview">
      <Link
        to={pathGym(lang, selected.gym.slug)}
        className="browse-map-preview-link"
      >
        <span
          className={[
            "browse-map-preview-media",
            selected.chain?.image && !selected.chain.image.includes("/pins/")
              ? selected.chain.logoFit === "contain"
                ? "is-logo"
                : ""
              : "is-pin",
            selected.chain?.image && !selected.chain.image.includes("/pins/")
              ? selected.chain.logoClass || ""
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <img
            src={
              selected.chain?.image &&
              !selected.chain.image.includes("/pins/")
                ? selected.chain.image
                : "/pins/gym-pin.png"
            }
            alt=""
          />
        </span>
        <span className="browse-map-preview-meta">
          <strong className="browse-map-preview-name">
            {selected.siteName}
          </strong>
          {selected.street ? (
            <span className="browse-map-preview-distance">
              {selected.street}
            </span>
          ) : null}
          <span className="browse-map-preview-price">
            {selected.priceLabel ?? t("priceUnknown")}
            {selected.distKm != null
              ? ` · ${formatDistanceKm(selected.distKm)}`
              : ""}
          </span>
        </span>
      </Link>
      <button
        type="button"
        className={
          isFav
            ? "browse-row-fav browse-map-preview-fav is-on"
            : "browse-row-fav browse-map-preview-fav"
        }
        aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
        aria-pressed={isFav}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        <Heart size={18} strokeWidth={2.2} />
      </button>
      {selected.gym.lat != null && selected.gym.lng != null ? (
        <a
          className="browse-map-preview-maps"
          href={
            "https://www.google.com/maps/dir/?api=1&origin=" +
            origin.lat +
            "," +
            origin.lng +
            "&destination=" +
            selected.gym.lat +
            "," +
            selected.gym.lng
          }
          target="_blank"
          rel="noreferrer"
          aria-label={t("mapsRoute")}
        >
          <img className="is-line" src="/pins/google-maps-outline.png" alt="" />
          <img className="is-fill" src="/pins/google-maps-pin.png" alt="" />
        </a>
      ) : null}
      <Link
        className="browse-map-preview-open"
        to={pathGym(lang, selected.gym.slug)}
      >
        {t("open")}
      </Link>
    </div>
  );
}
