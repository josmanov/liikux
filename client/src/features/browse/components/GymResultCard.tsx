import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveGymOffer, type ChainSummary, type Gym } from "../../../data/types";
import {
  cleanGymDisplayName,
  formatDistanceKm,
  formatGymStreetLine,
  formatPriceCard,
  formatPricePill,
} from "../../../data/format";
import { pathGym, type Lang } from "../../../i18n/lang";
import type { MessageKey } from "../../../i18n/messages";
import { isListedBrandChain } from "../utils/chainFilters";

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type GymResultCardProps = {
  gym: Gym;
  chain: ChainSummary | null;
  distKm: number | null;
  index: number;
  lang: Lang;
  t: TFn;
  origin: { lat: number; lng: number };
  isHovered: boolean;
  isSelected: boolean;
  isFav: boolean;
  onHover: (id: string | null) => void;
  onToggleFavorite: () => void;
  onFocus: () => void;
};

export function GymResultCard({
  gym,
  chain,
  distKm,
  index,
  lang,
  t,
  origin,
  isHovered,
  isSelected,
  isFav,
  onHover,
  onToggleFavorite,
  onFocus,
}: GymResultCardProps) {
  const offer = resolveGymOffer(gym, chain);
  const pricePill = formatPricePill(offer.priceFrom, lang);
  const priceLabel = pricePill
    ? pricePill.replace("€/kk", " €/kk").replace("€/mo", " €/mo")
    : null;
  const priceCard = formatPriceCard(offer.priceFrom, lang);
  const isBrandChain = Boolean(chain && isListedBrandChain(chain));
  const siteName = isBrandChain
    ? cleanGymDisplayName(gym.name, {
        chainName: chain?.name,
        city: gym.city,
      })
    : cleanGymDisplayName(gym.name);
  const street = formatGymStreetLine(gym);

  return (
    <li style={{ animationDelay: `${Math.min(index, 18) * 28}ms` }}>
      <div
        data-gym-id={gym.id}
        className={[
          "browse-row",
          isHovered ? "is-hovered" : "",
          isSelected ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => onHover(gym.id)}
        onMouseLeave={() => onHover(null)}
      >
        <Link
          to={pathGym(lang, gym.slug)}
          className="browse-row-main"
          onClick={(e) => {
            if (gym.lat == null || gym.lng == null) return;
            if (isSelected) return;
            e.preventDefault();
            onFocus();
          }}
        >
          <span
            className={[
              "browse-row-media",
              chain?.image && !chain.image.includes("/pins/")
                ? chain.logoFit === "contain"
                  ? "is-logo"
                  : ""
                : "is-pin",
              chain?.image && !chain.image.includes("/pins/")
                ? chain.logoClass || ""
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <img
              src={
                chain?.image && !chain.image.includes("/pins/")
                  ? chain.image
                  : "/pins/gym-pin.png"
              }
              alt=""
            />
          </span>
          <div className="browse-row-text">
            <span className="browse-row-chain">
              {isBrandChain ? chain!.name : t("otherLabel")}
            </span>
            <strong className="browse-row-site">{siteName}</strong>
            <span className="browse-row-address">{street}</span>
            <div className="browse-row-tags">
              {offer.is247 === true ? (
                <span className="browse-tag is-247">24/7</span>
              ) : null}
              {offer.freeTrial === true ? (
                <span className="browse-tag is-trial">{t("freeTrial")}</span>
              ) : null}
              {offer.dayPass === true ? (
                <span className="browse-tag is-daypass">
                  {t("priceDayPass")}
                </span>
              ) : null}
            </div>
            <span className="browse-row-meta-mobile">
              <span className="browse-row-price">
                {priceCard ?? t("priceUnknown")}
              </span>
              {distKm != null ? (
                <span className="browse-row-distance">
                  {" · "}
                  {formatDistanceKm(distKm)}
                </span>
              ) : null}
            </span>
          </div>
        </Link>
        <div className="browse-row-rail">
          <span className="browse-row-side">
            <span className="browse-row-price">
              {priceLabel ?? t("priceUnknown")}
            </span>
            {distKm != null ? (
              <span className="browse-row-distance">
                {formatDistanceKm(distKm)}
              </span>
            ) : null}
          </span>
          <div className="browse-row-actions">
            <button
              type="button"
              className={
                (isFav ? "browse-row-fav is-on" : "browse-row-fav") +
                " browse-row-fav-solo"
              }
              aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
              aria-pressed={isFav}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Heart size={20} strokeWidth={2.2} />
            </button>
            <div className="browse-row-more">
              <button
                type="button"
                className={
                  (isFav ? "browse-row-fav is-on" : "browse-row-fav") +
                  " browse-row-fav-more"
                }
                aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
                aria-pressed={isFav}
                tabIndex={-1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite();
                }}
              >
                <Heart size={20} strokeWidth={2.2} />
              </button>
              {gym.lat != null && gym.lng != null ? (
                <a
                  className="browse-map-preview-maps"
                  href={
                    "https://www.google.com/maps/dir/?api=1&origin=" +
                    origin.lat +
                    "," +
                    origin.lng +
                    "&destination=" +
                    gym.lat +
                    "," +
                    gym.lng
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("mapsRoute")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    className="is-line"
                    src="/pins/google-maps-outline.png"
                    alt=""
                  />
                  <img
                    className="is-fill"
                    src="/pins/google-maps-pin.png"
                    alt=""
                  />
                </a>
              ) : null}
              <Link
                className="browse-map-preview-open"
                to={pathGym(lang, gym.slug)}
                onClick={(e) => e.stopPropagation()}
              >
                {t("open")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
