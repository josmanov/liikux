import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Heart,
  Mail,
  MapPin,
  Navigation,
  Phone,
  TriangleAlert,
} from "lucide-react";
import LoadSpin from "../components/LoadSpin";
import { useAppLocation } from "../context/LocationContext";
import { getChainWebsite } from "../data/chainWebsites";
import { readFavoriteSlugs, toggleFavoriteSlug } from "../data/favorites";
import { cleanGymDisplayName, formatDistanceKm, formatGymStreetLine, formatPriceFrom } from "../data/format";
import type { GeoHit } from "../data/geocode";
import { offerPhrase } from "../data/offerText";
import { resolveGymOffer } from "../data/types";
import { distanceKm } from "../features/browse/utils/distanceKm";
import GymRouteMap from "../features/gym-detail/components/GymRouteMap";
import { useGymDetail } from "../features/gym-detail/hooks/useGymDetail";
import { cleanHoursValue } from "../features/gym-detail/utils/cleanHoursValue";
import { pathChain, pathFeedback, pathGym, pathGyms, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "../features/home/chain-tiles.css"; // per-chain logo colours and zoom
import "./GymDetailPage.css";

/**
 * Gym page, top to bottom:
 *  1. Back link + breadcrumb
 *  2. Head: chain logo, name, address, tags, actions (save, route, gym's site)
 *  3. Facts strip: price from, distance, opening hours, free trial
 *  4. Memberships and prices (with "checked" date and source)
 *  5. Opening hours + contact details, services
 *  6. Compare with nearby gyms, more gyms of the same chain
 *  Right side (below the facts on phones): the map with the route start.
 *  Phones also get a bar at the bottom: gym's site, save, route.
 *
 * Data comes from useGymDetail(); nothing here is made up. A fact we do not
 * have is shown as "not known" or left out.
 */

const PROMO_TAGS = ["Ilmainen kokeilu", "Free trial"];

/** "34,9" from 34.9 (Finnish decimal comma), "35" from 35. */
function eurText(eur: number) {
  return Number.isInteger(eur) ? String(eur) : String(Number(eur.toFixed(2))).replace(".", ",");
}

/** Membership prices are stored as a number, or as { hinta: number } in older rows. */
function membershipEur(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object" && "hinta" in raw) return Number((raw as { hinta: number }).hinta);
  return null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function GymDetailPage() {
  const { slug } = useParams();
  const { lang, t } = useLang();
  const { label: placeLabel, lat: placeLat, lng: placeLng, locateMe } = useAppLocation();
  const { gym, status, nearby, chainGyms } = useGymDetail(slug);

  const [favorites, setFavorites] = useState(() => readFavoriteSlugs());
  const [copied, setCopied] = useState<"phone" | "email" | null>(null);
  // Where the route starts. Follows the address chosen in the header until
  // the user picks another one on this page's map.
  const [from, setFrom] = useState<GeoHit | null>(null);

  useEffect(() => {
    if (placeLat == null || placeLng == null || !placeLabel.trim()) setFrom(null);
    else setFrom({ id: "place", label: placeLabel, lat: placeLat, lng: placeLng });
  }, [slug, placeLabel, placeLat, placeLng]);

  useEffect(() => {
    const sync = () => setFavorites(readFavoriteSlugs());
    window.addEventListener("favorites-changed", sync);
    return () => window.removeEventListener("favorites-changed", sync);
  }, []);

  const offer = gym ? resolveGymOffer(gym, gym.chain) : null;
  const gymName = gym ? cleanGymDisplayName(gym.name) : "";

  usePageMeta({
    title: gym ? `${gymName}${gym.city ? `, ${gym.city}` : ""} | Liikux` : lang === "fi" ? "Kuntosali | Liikux" : "Gym | Liikux",
    description: gym
      ? lang === "fi"
        ? `${gymName}${gym.city ? ` – ${gym.city}` : ""}. Katso hinnat, aukioloajat, osoite ja reitti Liikuxissa.`
        : `${gymName}${gym.city ? ` – ${gym.city}` : ""}. See prices, opening hours, address and route on Liikux.`
      : lang === "fi"
        ? "Kuntosalin tiedot Liikuxissa."
        : "Gym details on Liikux.",
    path: slug ? pathGym(lang, slug) : undefined,
  });

  if (status === "loading") {
    return (
      <div className="load-cover">
        <LoadSpin />
      </div>
    );
  }

  if (!gym || !offer) {
    return (
      <main className="gp gp-missing">
        <h1>{t("gymNotFound")}</h1>
        <p>{t("gymNotFoundHint")}</p>
        <Link className="btn btn-primary" to={pathGyms(lang)}>
          {t("backToBrowse")}
        </Link>
      </main>
    );
  }

  const chain = gym.chain;
  const isRealChain = Boolean(chain && chain.slug !== "muut" && chain.slug !== "yksityiset");
  const hasLogo = Boolean(isRealChain && chain?.image && !chain.image.includes("/pins/"));
  const streetLine = formatGymStreetLine(gym) || gym.address?.trim() || "";
  const addressText = [streetLine, gym.city?.trim()].filter(Boolean).join(", ");
  const siteUrl = gym.www?.trim() || chain?.website?.trim() || getChainWebsite(chain?.slug) || null;
  const hasPoint = gym.lat != null && gym.lng != null;
  const tripKm = from && hasPoint ? distanceKm(from.lat, from.lng, gym.lat, gym.lng) : null;
  const routeUrl =
    "https://www.google.com/maps/dir/?api=1" +
    (from ? `&origin=${from.lat},${from.lng}` : "") +
    `&destination=${gym.lat},${gym.lng}`;

  const is247 = offer.is247 === true;
  const freeTrial = offer.freeTrial === true || offer.services.some((s) => PROMO_TAGS.includes(s));
  const services = offer.services.filter((s) => !PROMO_TAGS.includes(s));
  const isFav = favorites.includes(gym.slug);

  const checkedRaw = gym.offerCheckedAt || chain?.checkedAt || null;
  const checkedDate = checkedRaw ? new Date(checkedRaw) : null;
  const checkedText =
    checkedDate && !Number.isNaN(checkedDate.getTime())
      ? checkedDate.toLocaleDateString(lang === "fi" ? "fi-FI" : "en-GB")
      : null;
  const sourceUrl = gym.offerSourceUrl || chain?.sourceUrl || null;
  const phone = gym.phone?.trim() || null;
  const email = gym.email?.trim() || null;

  function copy(key: "phone" | "email", value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  const favButton = (
    <button
      type="button"
      className={isFav ? "btn btn-soft gp-fav is-on" : "btn btn-soft gp-fav"}
      aria-pressed={isFav}
      aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
      onClick={() => setFavorites(toggleFavoriteSlug(gym.slug))}
    >
      <Heart size={17} strokeWidth={2.3} aria-hidden="true" />
      <span>{isFav ? t("gymSaved") : t("gymSave")}</span>
    </button>
  );

  const siteButton = siteUrl ? (
    <a className="btn btn-primary gp-site" href={siteUrl} target="_blank" rel="noreferrer">
      {t("gymWebsite")}
      <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden="true" />
    </a>
  ) : null;

  return (
    <main className="gp load-reveal">
      <div className="gp-grid">
        <div className="gp-top">
          {/* 1. Breadcrumb */}
          <nav className="gp-crumbs" aria-label="Breadcrumb">
            <Link to={pathGyms(lang)}>{t("backToBrowse")}</Link>
            {gym.city ? (
              <>
                <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
                <Link to={pathGymsFromLocation(lang, gym.city)}>{gym.city}</Link>
              </>
            ) : null}
            <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
            <span aria-current="page">{gymName}</span>
          </nav>

          {/* 2. Head */}
          <header className="gp-head">
            {hasLogo && chain ? (
              <Link
                className={["chain-tile-img gp-logo", chain.logoFit === "contain" ? "is-contain" : "", chain.logoClass || ""]
                  .filter(Boolean)
                  .join(" ")}
                to={pathChain(lang, chain.slug)}
                aria-label={chain.name}
              >
                <img src={chain.image} alt="" />
              </Link>
            ) : null}
            <div className="gp-head-text">
              {isRealChain && chain ? (
                <Link className="gp-chain" to={pathChain(lang, chain.slug)}>
                  {chain.name}
                </Link>
              ) : null}
              <h1 className="gp-name">{gymName}</h1>
              {addressText ? (
                <p className="gp-address">
                  <MapPin size={15} strokeWidth={2.2} aria-hidden="true" />
                  {addressText}
                </p>
              ) : null}
              {is247 || freeTrial || offer.dayPass === true ? (
                <ul className="gp-tags">
                  {is247 ? <li>24/7</li> : null}
                  {freeTrial ? <li>{t("freeTrial")}</li> : null}
                  {offer.dayPass === true ? <li>{t("priceDayPass")}</li> : null}
                </ul>
              ) : null}
            </div>
            <div className="gp-actions">
              {favButton}
              {hasPoint ? (
                <a className="btn btn-soft" href={routeUrl} target="_blank" rel="noreferrer">
                  <Navigation size={16} strokeWidth={2.3} aria-hidden="true" />
                  {t("gymRoute")}
                </a>
              ) : null}
              {siteButton}
            </div>
          </header>

          {/* 3. Facts */}
          <dl className="gp-facts">
            <div className="gp-fact">
              <dt>{t("statsFrom")}</dt>
              <dd className="is-price">
                {offer.priceFrom != null ? (
                  <>
                    {eurText(offer.priceFrom)} <small>{t("gymPerMonth")}</small>
                  </>
                ) : (
                  <span className="is-unknown">{t("gymNotKnown")}</span>
                )}
              </dd>
            </div>
            <div className="gp-fact">
              <dt>{t("statsDistance")}</dt>
              <dd>
                {tripKm != null ? formatDistanceKm(tripKm) : <span className="is-unknown">–</span>}
                {from && tripKm != null ? <em>{from.label}</em> : null}
              </dd>
            </div>
            <div className="gp-fact">
              <dt>{t("gymHours")}</dt>
              <dd>
                {is247 ? (
                  "24/7"
                ) : offer.hoursWeekday ? (
                  <>
                    {cleanHoursValue(offer.hoursWeekday, false)}
                    <em>{t("weekdays")}</em>
                  </>
                ) : (
                  <span className="is-unknown">{t("gymNotKnown")}</span>
                )}
              </dd>
            </div>
            <div className="gp-fact">
              <dt>{t("freeTrial")}</dt>
              <dd>
                {freeTrial ? (
                  <span className="is-good">
                    <Check size={18} strokeWidth={2.8} aria-hidden="true" />
                    {t("gymYes")}
                  </span>
                ) : (
                  <span className="is-unknown">{t("gymNotKnown")}</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Map (right column on desktop, under the facts on phones) */}
        {hasPoint ? (
          <aside className="gp-side" aria-label={t("map")}>
            <GymRouteMap
              gymLat={gym.lat}
              gymLng={gym.lng}
              from={from}
              tripKm={tripKm}
              routeUrl={routeUrl}
              onPickFrom={setFrom}
              onLocate={() => void locateMe()}
            />
          </aside>
        ) : null}

        <div className="gp-sections">
          {/* 4. Memberships and prices */}
          <section className="gp-card">
            <div className="gp-card-head">
              <h2>{t("membershipsPrices")}</h2>
              {checkedText ? (
                <span className="gp-checked">
                  <Check size={14} strokeWidth={2.8} aria-hidden="true" />
                  {t("gymChecked", { date: checkedText })}
                </span>
              ) : null}
            </div>
            {offer.memberships.length > 0 ? (
              <ul className="gp-rows">
                {offer.memberships.map((m) => {
                  const eur = membershipEur(m.priceEur);
                  return (
                    <li key={m.name}>
                      <span>
                        {offerPhrase(lang, m.name)}
                        {m.note ? <em>{offerPhrase(lang, m.note)}</em> : null}
                      </span>
                      <strong>{eur != null && Number.isFinite(eur) ? `${eurText(eur)} €` : "–"}</strong>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="gp-empty">{t("noMemberships")}</p>
            )}
            <p className="gp-note">
              {t("gymPriceNote")}
              {sourceUrl ? (
                <>
                  {" "}
                  {t("gymSource")}:{" "}
                  <a href={sourceUrl} target="_blank" rel="noreferrer">
                    {hostOf(sourceUrl)}
                  </a>
                </>
              ) : null}
            </p>
          </section>

          {/* 5. Hours + contact */}
          <div className="gp-pair">
            <section className="gp-card">
              <div className="gp-card-head">
                <h2>{t("gymHours")}</h2>
                <Clock size={18} strokeWidth={2.2} aria-hidden="true" />
              </div>
              {is247 || offer.hoursWeekday || offer.hoursWeekend ? (
                <ul className="gp-rows">
                  {is247 ? (
                    <li>
                      <span>{t("hoursAccess")}</span>
                      <strong>24/7</strong>
                    </li>
                  ) : null}
                  {!is247 && offer.hoursWeekday ? (
                    <li>
                      <span>{t("weekdays")}</span>
                      <strong>{cleanHoursValue(offer.hoursWeekday, false)}</strong>
                    </li>
                  ) : null}
                  {!is247 && offer.hoursWeekend ? (
                    <li>
                      <span>{t("weekend")}</span>
                      <strong>{cleanHoursValue(offer.hoursWeekend, false)}</strong>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="gp-empty">{t("noHours")}</p>
              )}
            </section>

            <section className="gp-card">
              <div className="gp-card-head">
                <h2>{t("contacts")}</h2>
              </div>
              {phone || email || siteUrl ? (
                <ul className="gp-rows gp-contacts">
                  {phone ? (
                    <li>
                      <a href={`tel:${phone.replace(/\s/g, "")}`}>
                        <Phone size={16} strokeWidth={2.2} aria-hidden="true" />
                        {phone}
                      </a>
                      <button type="button" aria-label={t("copyPhone")} onClick={() => copy("phone", phone)}>
                        {copied === "phone" ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} strokeWidth={2.2} />}
                      </button>
                    </li>
                  ) : null}
                  {email ? (
                    <li>
                      <a href={`mailto:${email}`}>
                        <Mail size={16} strokeWidth={2.2} aria-hidden="true" />
                        {email}
                      </a>
                      <button type="button" aria-label={t("copyEmail")} onClick={() => copy("email", email)}>
                        {copied === "email" ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} strokeWidth={2.2} />}
                      </button>
                    </li>
                  ) : null}
                  {siteUrl ? (
                    <li>
                      <a href={siteUrl} target="_blank" rel="noreferrer">
                        <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden="true" />
                        {hostOf(siteUrl)}
                      </a>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="gp-empty">{t("noContacts")}</p>
              )}
            </section>
          </div>

          {services.length > 0 ? (
            <section className="gp-card">
              <div className="gp-card-head">
                <h2>{t("services")}</h2>
              </div>
              <ul className="gp-services">
                {services.map((s) => (
                  <li key={s}>{offerPhrase(lang, s)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 6. Nearby gyms */}
          {nearby.length > 0 ? (
            <section className="gp-block">
              <h2>{t("gymNearbyTitle")}</h2>
              <div className="gp-near">
                {nearby.map((g) => {
                  const o = resolveGymOffer(g, g.chain);
                  return (
                    <Link key={g.slug} className="gp-near-card" to={pathGym(lang, g.slug)}>
                      {g.chain && g.chain.slug !== "muut" ? <span className="gp-near-chain">{g.chain.name}</span> : null}
                      <span className="gp-near-name">{cleanGymDisplayName(g.name)}</span>
                      <span className="gp-near-price">{formatPriceFrom(o.priceFrom, lang) ?? "–"}</span>
                      <span className="gp-near-km">{t("gymAwayFromThis", { km: formatDistanceKm(g.km) })}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {chainGyms.length > 0 && chain ? (
            <section className="gp-block">
              <div className="gp-block-head">
                <h2>{t("moreFromChain")}</h2>
                <Link className="gp-more" to={pathChain(lang, chain.slug)}>
                  {t("gymChainAll", { chain: chain.name })}
                  <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                </Link>
              </div>
              <ul className="gp-chain-list">
                {chainGyms.map((g) => (
                  <li key={g.slug}>
                    <Link to={pathGym(lang, g.slug)}>
                      <span>{cleanGymDisplayName(g.name)}</span>
                      <em>
                        {g.city} · {formatDistanceKm(g.km)}
                      </em>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link className="gp-report" to={pathFeedback(lang, "error", gym.slug)}>
            <TriangleAlert size={15} strokeWidth={2.3} aria-hidden="true" />
            {t("reportGymError")}
          </Link>
        </div>
      </div>

      {/* Phones: actions always within reach. Drawn into <body> so the footer cannot cover it. */}
      {createPortal(
      <div className="gp-bar">
        {siteButton}
        {favButton}
        {hasPoint ? (
          <a className="btn btn-soft" href={routeUrl} target="_blank" rel="noreferrer" aria-label={t("mapsRoute")}>
            <Navigation size={17} strokeWidth={2.3} aria-hidden="true" />
          </a>
        ) : null}
      </div>,
        document.body,
      )}
    </main>
  );
}

export default GymDetailPage;
