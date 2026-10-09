import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowLeft, Check, Copy, LocateFixed, MapPin } from "lucide-react";
import {
  type Chain,
  type Gym,
  resolveGymOffer,
} from "../data/types";
import { cleanGymDisplayName, formatPriceFrom } from "../data/format";
import { offerPhrase } from "../data/offerText";
import { getChainWebsite } from "../data/chainWebsites";
import { useAppLocation } from "../context/LocationContext";
import { fetchGeocode, type GeoHit } from "../data/geocode";
import { pathGyms } from "../i18n/lang";
import LoadSpin from "../components/LoadSpin";
import { useLang } from "../i18n/useLang";
import "./GymDetailPage.css";

type GymDetail = Gym & { chain: Chain | null };

const PROMO_TAGS = ["Ilmainen kokeilu", "Free trial"];

function cleanHoursValue(raw: string, is247: boolean) {
  if (is247) return "24/7";
  return raw
    .replace(/^ma[–-]pe\s+/i, "")
    .replace(/^la[–-]su\s+/i, "")
    .replace(/^la\s+/i, "")
    .replace(/^su\s+/i, "");
}

function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function makeGymPin() {
  const el = document.createElement("div");
  el.className = "gym-detail-pin";
  const hit = document.createElement("div");
  hit.className = "gym-detail-pin-hit is-selected";
  const img = document.createElement("img");
  img.src = "/pins/gym-pin.png";
  img.alt = "";
  hit.appendChild(img);
  el.appendChild(hit);
  return el;
}

function makeOriginPin(ariaLabel: string) {
  const el = document.createElement("div");
  el.className = "gym-detail-origin-pin";
  el.style.zIndex = "1000";
  el.setAttribute("aria-label", ariaLabel);
  el.innerHTML =
    '<span class="gym-origin-pin-ring"></span>' +
    '<span class="gym-origin-pin-ring is-late"></span>' +
    '<span class="gym-origin-pin-core"></span>';
  return el;
}

function GymDetailPage() {
  const { slug } = useParams();
  const { lang, t } = useLang();
  const {
    label: locationLabel,
    lat: originLat,
    lng: originLng,
    useMyLocation,
  } = useAppLocation();
  const [gym, setGym] = useState<GymDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [fromDraft, setFromDraft] = useState("");
  const [fromPoint, setFromPoint] = useState<GeoHit | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "fail">(
    "idle",
  );
  const [copiedKey, setCopiedKey] = useState<"phone" | "email" | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const gymMarkerRef = useRef<Marker | null>(null);
  const originMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (locationLabel === "Lähellä minua" || !locationLabel.trim()) {
      setFromDraft("");
      setFromPoint(null);
      setGeoStatus("idle");
      return;
    }
    setFromDraft(locationLabel);
    if (originLat != null && originLng != null) {
      setFromPoint({
        id: "origin",
        label: locationLabel,
        lat: originLat,
        lng: originLng,
      });
      setGeoStatus("idle");
    }
  }, [slug, locationLabel, originLat, originLng]);

  useEffect(() => {
    if (!slug) {
      setStatus("missing");
      setGym(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    fetch(`http://localhost:3001/api/gyms/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("fail");
        return r.json() as Promise<GymDetail>;
      })
      .then((apiGym) => {
        if (cancelled) return;
        if (apiGym) {
          setGym(apiGym);
          setStatus("ok");
          return;
        }
        setGym(null);
        setStatus("missing");
      })
      .catch(() => {
        if (cancelled) return;
        setGym(null);
        setStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (status !== "ok" || !gym || !mapRef.current) return;
    if (gym.lat == null || gym.lng == null) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      gymMarkerRef.current = null;
      originMarkerRef.current = null;
    }

    const map = new Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [gym.lng, gym.lat],
      zoom: 14,
    });
    mapInstanceRef.current = map;

    map.on("load", () => {
      map.resize();
      gymMarkerRef.current = new Marker({ element: makeGymPin() })
        .setLngLat([gym.lng, gym.lat])
        .addTo(map);
    });

    return () => {
      gymMarkerRef.current?.remove();
      originMarkerRef.current?.remove();
      gymMarkerRef.current = null;
      originMarkerRef.current = null;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [status, gym]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !gym || gym.lat == null || gym.lng == null) return;

    originMarkerRef.current?.remove();
    originMarkerRef.current = null;

    if (!fromPoint) {
      map.easeTo({ center: [gym.lng, gym.lat], zoom: 14 });
      return;
    }

    originMarkerRef.current = new Marker({
      element: makeOriginPin(t("fromAddressAria")),
    })
      .setLngLat([fromPoint.lng, fromPoint.lat])
      .addTo(map);

    const bounds = new LngLatBounds();
    bounds.extend([gym.lng, gym.lat]);
    bounds.extend([fromPoint.lng, fromPoint.lat]);
    map.fitBounds(bounds, { padding: 72, maxZoom: 15 });
  }, [fromPoint?.lat, fromPoint?.lng, gym?.lat, gym?.lng, lang, t]);

  function lookupAddress() {
    const q = fromDraft.trim();
    if (q.length < 2) {
      setFromPoint(null);
      setGeoStatus("idle");
      return;
    }

    setGeoStatus("loading");
    fetchGeocode(q, { lat: originLat, lng: originLng })
      .then((rows) => {
        const hit = rows[0];
        if (!hit) {
          setFromPoint(null);
          setGeoStatus("fail");
          return;
        }
        setFromDraft(hit.label);
        setFromPoint(hit);
        setGeoStatus("idle");
      })
      .catch(() => {
        setFromPoint(null);
        setGeoStatus("fail");
      });
  }

  function copyContact(key: "phone" | "email", value: string) {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopiedKey(key);
        window.setTimeout(() => setCopiedKey(null), 1400);
      },
      () => {},
    );
  }

  if (status === "loading") {
    return (
      <div className="load-cover">
        <LoadSpin />
      </div>
    );
  }

  if (status === "missing" || !gym) {
    return (
      <main className="gym-detail">
        <h1>{t("gymNotFound")}</h1>
        <p className="gym-detail-muted">{t("gymNotFoundHint")}</p>
        <Link className="gym-detail-back" to={pathGyms(lang)}>
          {t("backToBrowse")}
        </Link>
      </main>
    );
  }

  const chain = gym.chain;
  const offer = resolveGymOffer(gym, chain);
  const memberships = offer.memberships;
  const services = offer.services;
  const priceLabel = formatPriceFrom(offer.priceFrom, lang);
  const siteUrl =
    gym.www?.trim() ||
    chain?.website?.trim() ||
    getChainWebsite(chain?.slug) ||
    null;
  const heroSrc = chain?.image || null;
  const heroIsPin = Boolean(chain?.image?.includes("/pins/"));
  const heroIsLogo = Boolean(
    chain?.image && chain.logoFit === "contain" && !heroIsPin,
  );
  const heroIsText = !chain?.image;
  const hasPromoService = services.some((s) => PROMO_TAGS.includes(s));
  const promoTag =
    hasPromoService || offer.freeTrial === true ? t("freeTrial") : null;
  const tripKm =
    fromPoint && gym.lat != null && gym.lng != null
      ? distanceKm(fromPoint.lat, fromPoint.lng, gym.lat, gym.lng)
      : null;

  const hours247 = offer.is247 === true;
  const hoursWeekday = offer.hoursWeekday;
  const hoursWeekend = offer.hoursWeekend;
  const hasHours = Boolean(
    hoursWeekday || hoursWeekend || offer.freeTrial === true,
  );

  const contact = {
    phone: gym.phone?.trim() || null,
    email: gym.email?.trim() || null,
  };

  return (
    <main className="gym-detail load-reveal">
      <div className="gym-detail-body">
        <div className="gym-detail-left-sticky">
          <Link className="gym-detail-back" to={pathGyms(lang)}>
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
            {t("backToBrowse")}
          </Link>
        </div>

        <div className="gym-detail-main">
          <article className="gym-detail-card">
            <div
              className={[
                "gym-detail-logo",
                heroIsLogo ? "is-logo" : "",
                heroIsPin ? "is-pin" : "",
                heroIsText ? "is-text" : "",
                heroIsPin ? "" : chain?.logoClass || "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {heroSrc ? (
                <img src={heroSrc} alt="" />
              ) : (
                <span className="gym-detail-logo-name">
                  {cleanGymDisplayName(gym.name)}
                </span>
              )}
            </div>

            <div className="gym-detail-title-row">
              <div className="gym-detail-titles">
                <h1>{cleanGymDisplayName(gym.name)}</h1>
                <p>{gym.address}</p>
              </div>
              <div className="gym-detail-price">
                {priceLabel ? (
                  <>
                    <span className="gym-detail-price-label">
                      {t("priceFromShort")}
                    </span>
                    <strong>
                      {offer.priceFrom != null &&
                      Number.isInteger(offer.priceFrom)
                        ? offer.priceFrom
                        : offer.priceFrom != null
                          ? String(offer.priceFrom).replace(".", ",")
                          : ""}{" "}
                      €
                    </strong>
                    <span className="gym-detail-price-unit">
                      {t("pricePerMonth")}
                    </span>
                  </>
                ) : (
                  <span className="gym-detail-price-label">
                    {t("priceUnknown")}
                  </span>
                )}
              </div>
            </div>

            {siteUrl ? (
              <a
                className="gym-detail-cta"
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("visitGymSite")}
              </a>
            ) : null}

            <hr className="gym-detail-divider" />

            <section className="gym-detail-section">
              <h2>{t("hoursAccess")}</h2>
              {!hasHours ? (
                <p className="gym-detail-muted">{t("noHours")}</p>
              ) : (
                <ul className="gym-detail-plans">
                  {hoursWeekday ? (
                    <li>
                      <span>{t("weekdays")}</span>
                      <strong>
                        {cleanHoursValue(hoursWeekday, hours247)}
                      </strong>
                    </li>
                  ) : null}
                  {hoursWeekend ? (
                    <li>
                      <span>{t("weekend")}</span>
                      <strong>
                        {cleanHoursValue(hoursWeekend, hours247)}
                      </strong>
                    </li>
                  ) : null}
                  {offer.freeTrial === true ? (
                    <li>
                      <span>{t("trial")}</span>
                      <strong>{t("freeTrial")}</strong>
                    </li>
                  ) : null}
                  {offer.dayPass === true ? (
                    <li>
                      <span>{t("priceDayPass")}</span>
                      <strong>{t("available")}</strong>
                    </li>
                  ) : null}
                </ul>
              )}
            </section>

            <section className="gym-detail-section">
              <h2>{t("memberships")}</h2>
              {memberships.length > 0 ? (
                <ul className="gym-detail-plans">
                  {memberships.map((m) => {
                    const rawPrice = m.priceEur as unknown;
                    const eur =
                      typeof rawPrice === "number"
                        ? rawPrice
                        : rawPrice &&
                            typeof rawPrice === "object" &&
                            "hinta" in rawPrice
                          ? Number((rawPrice as { hinta: number }).hinta)
                          : null;
                    return (
                    <li key={m.name}>
                      <span>
                        {offerPhrase(lang, m.name)}
                        {m.note ? ` · ${offerPhrase(lang, m.note)}` : ""}
                      </span>
                      <strong>
                        {eur == null
                          ? "—"
                          : Number.isInteger(eur)
                            ? eur
                            : String(eur).replace(".", ",")}{" "}
                        €
                      </strong>
                    </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="gym-detail-muted">{t("noMemberships")}</p>
              )}
            </section>

            <section className="gym-detail-section">
              <h2>{t("services")}</h2>
              {services.length > 0 ? (
                <ul className="gym-detail-tags">
                  {services.map((s) => {
                    const isPromo = PROMO_TAGS.includes(s);
                    return (
                      <li
                        key={s}
                        className={isPromo ? "is-promo" : undefined}
                      >
                        {isPromo ? t("freeTrial") : offerPhrase(lang, s)}
                      </li>
                    );
                  })}
                  {promoTag && !hasPromoService ? (
                    <li className="is-promo">{promoTag}</li>
                  ) : null}
                </ul>
              ) : (
                <p className="gym-detail-muted">{t("noServices")}</p>
              )}
            </section>

            <section className="gym-detail-section">
              <h2>{t("contacts")}</h2>
              {contact.phone || contact.email ? (
                <div className="gym-detail-contact">
                  {contact.phone ? (
                    <div className="gym-detail-contact-item">
                      <span>{t("phone")}</span>
                      <div className="gym-detail-contact-row">
                        <a
                          href={`tel:${contact.phone.replace(/\s/g, "")}`}
                        >
                          {contact.phone}
                        </a>
                        <button
                          type="button"
                          className="gym-detail-copy"
                          aria-label={t("copyPhone")}
                          onClick={() =>
                            copyContact("phone", contact.phone!)
                          }
                        >
                          {copiedKey === "phone" ? (
                            <Check size={15} strokeWidth={2.4} />
                          ) : (
                            <Copy size={15} strokeWidth={2.2} />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {contact.email ? (
                    <div className="gym-detail-contact-item">
                      <span>{t("email")}</span>
                      <div className="gym-detail-contact-row">
                        <a href={`mailto:${contact.email}`}>
                          {contact.email}
                        </a>
                        <button
                          type="button"
                          className="gym-detail-copy"
                          aria-label={t("copyEmail")}
                          onClick={() =>
                            copyContact("email", contact.email!)
                          }
                        >
                          {copiedKey === "email" ? (
                            <Check size={15} strokeWidth={2.4} />
                          ) : (
                            <Copy size={15} strokeWidth={2.2} />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="gym-detail-muted">{t("noContacts")}</p>
              )}
            </section>

            {chain ? (
              <p className="gym-detail-chain-line">
                {t("chainLine", { name: chain.name })}
              </p>
            ) : null}
          </article>
        </div>

        <aside className="gym-detail-map-col" aria-label={t("map")}>
          <div className="gym-detail-map-frame">
            <div className="gym-detail-map-float">
              <MapPin size={18} strokeWidth={2.2} aria-hidden="true" />
              <input
                className="gym-detail-from"
                type="text"
                value={fromDraft}
                placeholder={t("fromAddressPlaceholder")}
                aria-label={t("fromAddressAria")}
                onChange={(e) => {
                  setFromDraft(e.target.value);
                  setGeoStatus("idle");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookupAddress();
                }}
                onBlur={lookupAddress}
              />
              <button
                type="button"
                className="gym-detail-locate"
                aria-label={t("useMyLocation")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  void useMyLocation();
                }}
              >
                <LocateFixed size={16} strokeWidth={2.3} />
              </button>
              <span className="gym-detail-crumb-sep" aria-hidden="true">
                &gt;
              </span>
              <span
                className="gym-detail-crumb-to"
                title={cleanGymDisplayName(gym.name)}
              >
                {cleanGymDisplayName(gym.name)}
              </span>
            </div>
            {geoStatus === "loading" ||
            geoStatus === "fail" ||
            tripKm != null ? (
              <p className="gym-detail-route-meta">
                {geoStatus === "loading"
                  ? t("lookingUpAddress")
                  : geoStatus === "fail"
                    ? t("addressNotFound")
                    : tripKm != null
                      ? t("tripAbout", {
                          km: tripKm.toFixed(1).replace(".", ","),
                        })
                      : null}
              </p>
            ) : null}
            <div className="gym-detail-map" ref={mapRef} />
          </div>
        </aside>
      </div>
    </main>
  );
}

export default GymDetailPage;
