import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Heart,
  LocateFixed,
  MapPin,
  Minus,
  Phone,
  Plus,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import {
  type Chain,
  type Gym,
  resolveGymOffer,
} from "../data/types";
import {
  cleanGymDisplayName,
  formatDistanceKm,
  formatGymStreetLine,
  formatPricePill,
} from "../data/format";
import { offerPhrase } from "../data/offerText";
import { getChainWebsite } from "../data/chainWebsites";
import { useAppLocation } from "../context/LocationContext";
import { fetchGeocode, type GeoHit } from "../data/geocode";
import { pathGym, pathGyms } from "../i18n/lang";
import LoadSpin from "../components/LoadSpin";
import {
  readFavoriteSlugs,
  toggleFavoriteSlug,
} from "../data/favorites";
import { useLockPageScroll } from "../hooks/useLockPageScroll";
import { useLang } from "../i18n/useLang";
import "./GymDetailPage.css";

type GymDetail = Gym & { chain: Chain | null };
type AccordionId =
  | "hours"
  | "memberships"
  | "services"
  | "chain"
  | "contacts";

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

function makeGymPin(opts: {
  priceText?: string | null;
  addressText?: string | null;
}) {
  const el = document.createElement("div");
  el.className = "gym-detail-pin";

  if (opts.priceText || opts.addressText) {
    const stack = document.createElement("div");
    stack.className = "gym-detail-pin-stack";
    if (opts.priceText) {
      const pill = document.createElement("span");
      pill.className = "gym-detail-pin-price";
      pill.textContent = opts.priceText;
      stack.appendChild(pill);
    }
    if (opts.addressText) {
      const addr = document.createElement("span");
      addr.className = "gym-detail-pin-address";
      addr.textContent = opts.addressText;
      stack.appendChild(addr);
    }
    el.appendChild(stack);
  }

  const hit = document.createElement("div");
  hit.className = "gym-detail-pin-hit is-selected";
  const img = document.createElement("img");
  img.src = "/pins/gym-pin.png";
  img.alt = "";
  hit.appendChild(img);
  el.appendChild(hit);
  return el;
}

function makeOriginPin(ariaLabel: string, addressLabel?: string | null) {
  const el = document.createElement("div");
  el.className = "gym-detail-origin-pin";
  el.style.zIndex = "1000";
  el.setAttribute("aria-label", ariaLabel);
  if (addressLabel?.trim()) {
    const label = document.createElement("span");
    label.className = "gym-detail-origin-label";
    label.textContent = addressLabel.trim();
    el.appendChild(label);
  }
  const ring = document.createElement("span");
  ring.className = "gym-origin-pin-ring";
  const ringLate = document.createElement("span");
  ringLate.className = "gym-origin-pin-ring is-late";
  const core = document.createElement("span");
  core.className = "gym-origin-pin-core";
  el.append(ring, ringLate, core);
  return el;
}

function DetailAccordion(props: {
  id: AccordionId;
  openId: AccordionId | null;
  onToggle: (id: AccordionId) => void;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const open = props.openId === props.id;
  return (
    <div className={open ? "gym-detail-acc is-open" : "gym-detail-acc"}>
      <button
        type="button"
        className="gym-detail-acc-head"
        aria-expanded={open}
        onClick={() => props.onToggle(props.id)}
      >
        <span className="gym-detail-acc-icon" aria-hidden="true">
          {props.icon}
        </span>
        <span className="gym-detail-acc-title">{props.title}</span>
        <ChevronDown
          className="gym-detail-acc-chevron"
          size={18}
          strokeWidth={2.3}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="gym-detail-acc-body">{props.children}</div>
      ) : null}
    </div>
  );
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
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState("");
  const [sheetHits, setSheetHits] = useState<GeoHit[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState(() =>
    readFavoriteSlugs(),
  );
  const [openAcc, setOpenAcc] = useState<AccordionId | null>("hours");
  const [chainGyms, setChainGyms] = useState<Gym[]>([]);
  const [stickyHidden, setStickyHidden] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const gymMarkerRef = useRef<Marker | null>(null);
  const originMarkerRef = useRef<Marker | null>(null);

  useLockPageScroll(addressSheetOpen);

  useEffect(() => {
    function syncFavs() {
      setFavoriteSlugs(readFavoriteSlugs());
    }
    window.addEventListener("favorites-changed", syncFavs);
    return () => window.removeEventListener("favorites-changed", syncFavs);
  }, []);

  useEffect(() => {
    const footer = document.querySelector(".footer");
    if (!footer) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setStickyHidden(Boolean(entry?.isIntersecting));
      },
      { root: null, threshold: 0.05 },
    );
    io.observe(footer);
    return () => io.disconnect();
  }, [status]);

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
    setOpenAcc("hours");
    setChainGyms([]);

    fetch(`/api/gyms/${encodeURIComponent(slug)}`)
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
    if (status !== "ok" || !gym?.chain?.slug) {
      setChainGyms([]);
      return;
    }
    const chainSlug = gym.chain.slug;
    if (
      chainSlug === "muut" ||
      chainSlug === "yksityiset" ||
      !chainSlug.trim()
    ) {
      setChainGyms([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/chains/${encodeURIComponent(chainSlug)}/gyms`)
      .then(async (r) => {
        if (!r.ok) throw new Error("fail");
        return r.json() as Promise<{ gyms: Gym[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const others = (data.gyms || []).filter((g) => g.slug !== gym.slug);
        setChainGyms(others);
      })
      .catch(() => {
        if (cancelled) return;
        setChainGyms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [status, gym?.slug, gym?.chain?.slug]);

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
      maxPitch: 0,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchPitch.disable();
    map.setMaxPitch(0);
    mapInstanceRef.current = map;

    function settleSize() {
      map.resize();
    }

    map.on("load", () => {
      settleSize();
      const offer = resolveGymOffer(gym, gym.chain);
      const priceText = formatPricePill(offer.priceFrom, lang);
      const addressText =
        formatGymStreetLine(gym) || gym.address?.trim() || null;
      gymMarkerRef.current = new Marker({
        element: makeGymPin({ priceText, addressText }),
      })
        .setLngLat([gym.lng, gym.lat])
        .addTo(map);
      requestAnimationFrame(() => {
        settleSize();
        requestAnimationFrame(settleSize);
      });
    });

    window.addEventListener("resize", settleSize);

    return () => {
      window.removeEventListener("resize", settleSize);
      gymMarkerRef.current?.remove();
      originMarkerRef.current?.remove();
      gymMarkerRef.current = null;
      originMarkerRef.current = null;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [status, gym, lang]);

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
      element: makeOriginPin(
        t("fromAddressAria"),
        fromPoint.label || fromDraft || locationLabel,
      ),
    })
      .setLngLat([fromPoint.lng, fromPoint.lat])
      .addTo(map);

    const bounds = new LngLatBounds();
    bounds.extend([gym.lng, gym.lat]);
    bounds.extend([fromPoint.lng, fromPoint.lat]);
    map.fitBounds(bounds, { padding: 72, maxZoom: 15 });
  }, [
    fromPoint?.lat,
    fromPoint?.lng,
    fromPoint?.label,
    fromDraft,
    locationLabel,
    gym?.lat,
    gym?.lng,
    lang,
    t,
  ]);

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

  useEffect(() => {
    if (!addressSheetOpen) return;
    setSheetDraft(fromDraft || locationLabel || "");
  }, [addressSheetOpen, fromDraft, locationLabel]);

  useEffect(() => {
    if (!addressSheetOpen) return;
    const q = sheetDraft.trim();
    if (q.length < 3) {
      setSheetHits([]);
      setSheetLoading(false);
      return;
    }
    let cancelled = false;
    setSheetLoading(true);
    const id = window.setTimeout(() => {
      fetchGeocode(q, { lat: originLat, lng: originLng })
        .then((rows) => {
          if (cancelled) return;
          setSheetHits(rows);
          setSheetLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setSheetHits([]);
          setSheetLoading(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [addressSheetOpen, sheetDraft, originLat, originLng]);

  function pickSheetHit(hit: GeoHit) {
    setFromDraft(hit.label);
    setFromPoint(hit);
    setGeoStatus("idle");
    setAddressSheetOpen(false);
  }

  function zoomBy(delta: number) {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 220 });
  }

  function goToGymOrOrigin() {
    const map = mapInstanceRef.current;
    if (!map || !gym || gym.lat == null || gym.lng == null) return;
    if (fromPoint) {
      const bounds = new LngLatBounds();
      bounds.extend([gym.lng, gym.lat]);
      bounds.extend([fromPoint.lng, fromPoint.lat]);
      map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 550 });
      return;
    }
    map.easeTo({
      center: [gym.lng, gym.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 550,
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

  function toggleAcc(id: AccordionId) {
    setOpenAcc((prev) => (prev === id ? null : id));
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
  const siteUrl =
    gym.www?.trim() ||
    chain?.website?.trim() ||
    getChainWebsite(chain?.slug) ||
    null;
  const chainIsOther =
    !chain ||
    chain.slug === "muut" ||
    chain.slug === "yksityiset" ||
    !chain.image ||
    chain.image.includes("/pins/");
  const heroSrc = chainIsOther ? "/pins/gym-pin.png" : chain.image;
  const heroIsPin = chainIsOther;
  const heroIsLogo = Boolean(
    !chainIsOther && chain?.logoFit === "contain",
  );
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
    hoursWeekday || hoursWeekend || offer.freeTrial === true || hours247,
  );

  const contact = {
    phone: gym.phone?.trim() || null,
    email: gym.email?.trim() || null,
  };
  const isFav = favoriteSlugs.includes(gym.slug);
  const streetLine =
    formatGymStreetLine(gym) || gym.address?.trim() || "";
  const showChainAcc = chainGyms.length > 0;
  const priceNum = offer.priceFrom;
  const priceText =
    priceNum != null && Number.isFinite(priceNum)
      ? Number.isInteger(priceNum)
        ? String(priceNum)
        : String(priceNum).replace(".", ",")
      : null;

  return (
    <main className="gym-detail load-reveal">
      <div className="gym-detail-shell">
        <div className="gym-detail-top-mobile">
          <Link
            className="gym-detail-back gym-detail-back-mobile"
            to={pathGyms(lang)}
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
            {t("backToBrowse")}
          </Link>
          <button
            type="button"
            className="gym-detail-top-address"
            aria-label={t("fromAddressAria")}
            onClick={() => setAddressSheetOpen(true)}
          >
            {fromDraft.trim() || locationLabel || t("fromAddressPlaceholder")}
          </button>
        </div>

        <div className="gym-detail-layout">
          <div className="gym-detail-content">
            <div className="gym-detail-left-sticky">
              <Link className="gym-detail-back" to={pathGyms(lang)}>
                <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
                {t("backToBrowse")}
              </Link>
            </div>

            <div
              className={[
                "gym-detail-hero",
                heroIsLogo ? "is-logo" : "",
                heroIsPin ? "is-pin" : "",
                heroIsPin ? "" : chain?.logoClass || "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <img src={heroSrc} alt="" />
              <button
                type="button"
                className={
                  isFav
                    ? "gym-detail-fav browse-row-fav is-on"
                    : "gym-detail-fav browse-row-fav"
                }
                aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
                aria-pressed={isFav}
                onClick={() => {
                  setFavoriteSlugs(toggleFavoriteSlug(gym.slug));
                }}
              >
                <Heart size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="gym-detail-meta">
              {chain && !chainIsOther ? (
                <p className="gym-detail-chain-name">{chain.name}</p>
              ) : null}
              <h1 className="gym-detail-name">
                {cleanGymDisplayName(gym.name)}
              </h1>
              {streetLine || gym.city ? (
                <p className="gym-detail-address-line">
                  <MapPin size={15} strokeWidth={2.3} aria-hidden="true" />
                  <span>
                    {[streetLine, gym.city?.trim()].filter(Boolean).join(", ")}
                  </span>
                </p>
              ) : null}
            </div>

            {(hours247 || promoTag) && (
              <div className="gym-detail-badges">
                {hours247 ? (
                  <span className="gym-detail-badge">24/7</span>
                ) : null}
                {promoTag ? (
                  <span className="gym-detail-badge is-promo">{promoTag}</span>
                ) : null}
              </div>
            )}

            <div className="gym-detail-stats">
              <div className="gym-detail-stat">
                <span className="gym-detail-stat-label">{t("statsFrom")}</span>
                <strong className="gym-detail-stat-value is-price">
                  {priceText != null ? `${priceText} €` : "—"}
                </strong>
              </div>
              <div className="gym-detail-stat">
                <span className="gym-detail-stat-label">
                  {t("statsDistance")}
                </span>
                <strong className="gym-detail-stat-value">
                  {tripKm != null ? formatDistanceKm(tripKm) : "—"}
                </strong>
              </div>
            </div>

            <div className="gym-detail-accs">
              <DetailAccordion
                id="hours"
                openId={openAcc}
                onToggle={toggleAcc}
                title={t("hoursAccess")}
                icon={<Clock size={18} strokeWidth={2.2} />}
              >
                {!hasHours ? (
                  <p className="gym-detail-muted">{t("noHours")}</p>
                ) : (
                  <ul className="gym-detail-plans">
                    {hours247 ? (
                      <li>
                        <span>{t("hoursAccess")}</span>
                        <strong>24/7</strong>
                      </li>
                    ) : null}
                    {!hours247 && hoursWeekday ? (
                      <li>
                        <span>{t("weekdays")}</span>
                        <strong>
                          {cleanHoursValue(hoursWeekday, hours247)}
                        </strong>
                      </li>
                    ) : null}
                    {!hours247 && hoursWeekend ? (
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
              </DetailAccordion>

              <DetailAccordion
                id="memberships"
                openId={openAcc}
                onToggle={toggleAcc}
                title={t("membershipsPrices")}
                icon={<Ticket size={18} strokeWidth={2.2} />}
              >
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
              </DetailAccordion>

              <DetailAccordion
                id="services"
                openId={openAcc}
                onToggle={toggleAcc}
                title={t("services")}
                icon={<Sparkles size={18} strokeWidth={2.2} />}
              >
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
              </DetailAccordion>

              {showChainAcc ? (
                <DetailAccordion
                  id="chain"
                  openId={openAcc}
                  onToggle={toggleAcc}
                  title={t("moreFromChain")}
                  icon={<Building2 size={18} strokeWidth={2.2} />}
                >
                  <ul className="gym-detail-chain-list">
                    {chainGyms.map((g) => (
                      <li key={g.slug}>
                        <Link to={pathGym(lang, g.slug)}>
                          <span>{cleanGymDisplayName(g.name)}</span>
                          {g.city ? <em>{g.city}</em> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </DetailAccordion>
              ) : null}

              <DetailAccordion
                id="contacts"
                openId={openAcc}
                onToggle={toggleAcc}
                title={t("contacts")}
                icon={<Phone size={18} strokeWidth={2.2} />}
              >
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
              </DetailAccordion>
            </div>
          </div>

          <aside className="gym-detail-map-col" aria-label={t("map")}>
            <div className="gym-detail-map-frame">
              <div className="gym-detail-map-side">
                <div className="gym-detail-map-chips">
                  <button
                    type="button"
                    className="gym-detail-map-chip"
                    aria-label={t("fromAddressAria")}
                    aria-expanded={addressSheetOpen}
                    onClick={() => setAddressSheetOpen(true)}
                  >
                    <MapPin size={18} strokeWidth={2.3} />
                  </button>
                </div>
              </div>
              <div className="gym-detail-map-controls">
                <button
                  type="button"
                  className="gym-detail-map-ctrl"
                  aria-label={t("mapZoomIn")}
                  onClick={() => zoomBy(1)}
                >
                  <Plus size={18} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  className="gym-detail-map-ctrl"
                  aria-label={t("mapZoomOut")}
                  onClick={() => zoomBy(-1)}
                >
                  <Minus size={18} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  className="gym-detail-map-ctrl"
                  aria-label={t("useMyLocation")}
                  onClick={() => {
                    void useMyLocation().then(() => {
                      goToGymOrOrigin();
                    });
                  }}
                >
                  <LocateFixed size={17} strokeWidth={2.4} />
                </button>
              </div>
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
      </div>

      {siteUrl ? (
        <div
          className={
            stickyHidden
              ? "gym-detail-sticky is-at-end"
              : "gym-detail-sticky"
          }
        >
          <a
            className="gym-detail-sticky-cta"
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("visitGymSite")}
          </a>
        </div>
      ) : null}

      {addressSheetOpen
        ? createPortal(
            <div
              className="gym-detail-sheet-root"
              role="presentation"
              onClick={() => setAddressSheetOpen(false)}
            >
              <div
                className="gym-detail-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={t("fromAddressAria")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="gym-detail-sheet-head">
                  <h2 className="gym-detail-sheet-title">
                    {t("fromAddressAria")}
                  </h2>
                  <button
                    type="button"
                    className="gym-detail-sheet-close"
                    aria-label={t("close")}
                    onClick={() => setAddressSheetOpen(false)}
                  >
                    <X size={20} strokeWidth={2.4} />
                  </button>
                </div>
                <div className="gym-detail-sheet-body">
                  <label className="gym-detail-sheet-field">
                    <MapPin size={16} strokeWidth={2.3} />
                    <input
                      type="text"
                      value={sheetDraft}
                      placeholder={t("fromAddressPlaceholder")}
                      aria-label={t("fromAddressAria")}
                      autoFocus
                      onChange={(e) => setSheetDraft(e.target.value)}
                    />
                  </label>
                  <ul className="gym-detail-sheet-hits">
                    {sheetLoading && sheetHits.length === 0 ? (
                      <li className="gym-detail-sheet-hint">
                        <LoadSpin size="sm" />
                      </li>
                    ) : null}
                    {!sheetLoading &&
                    sheetDraft.trim().length >= 3 &&
                    sheetHits.length === 0 ? (
                      <li className="gym-detail-sheet-hint">{t("noResults")}</li>
                    ) : null}
                    {sheetHits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onClick={() => pickSheetHit(hit)}
                        >
                          {hit.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}

export default GymDetailPage;
