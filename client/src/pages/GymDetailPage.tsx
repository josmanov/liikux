import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LngLatBounds, Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowLeft, Check, Copy, MapPin } from "lucide-react";
import { type Chain, type Gym } from "../data/types";
import { extraGymsMock } from "../data/extraGymsMock";
import { getChainWebsite, getGymDetailMock } from "../data/gymDetailMock";
import { useAppLocation } from "../context/LocationContext";
import "./GymDetailPage.css";

type GymDetail = Gym & { chain: Chain | null };

type GeoHit = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

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

function makeOriginPin() {
  const el = document.createElement("div");
  el.className = "gym-detail-origin-pin";
  el.setAttribute("aria-label", "Lähtöosoite");
  return el;
}

function GymDetailPage() {
  const { slug } = useParams();
  const { label: locationLabel } = useAppLocation();
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
    setFromDraft(locationLabel === "Lähellä minua" ? "" : locationLabel);
    setFromPoint(null);
    setGeoStatus("idle");
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setStatus("missing");
      setGym(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    Promise.all([
      fetch(`http://localhost:3001/api/gyms/${encodeURIComponent(slug)}`).then(
        async (r) => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error("fail");
          return r.json() as Promise<GymDetail>;
        },
      ),
      fetch("http://localhost:3001/api/chains").then(
        (r) => r.json() as Promise<Chain[]>,
      ),
    ])
      .then(([apiGym, chainData]) => {
        if (cancelled) return;
        if (apiGym) {
          setGym(apiGym);
          setStatus("ok");
          return;
        }

        const mock = extraGymsMock.find((g) => g.slug === slug);
        if (!mock) {
          setGym(null);
          setStatus("missing");
          return;
        }

        const chain = chainData.find((c) => c.id === mock.chainId) ?? null;
        setGym({ ...mock, chain });
        setStatus("ok");
      })
      .catch(() => {
        if (cancelled) return;
        const mock = extraGymsMock.find((g) => g.slug === slug);
        if (!mock) {
          setGym(null);
          setStatus("missing");
          return;
        }
        setGym({ ...mock, chain: null });
        setStatus("ok");
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

    originMarkerRef.current = new Marker({ element: makeOriginPin() })
      .setLngLat([fromPoint.lng, fromPoint.lat])
      .addTo(map);

    const bounds = new LngLatBounds();
    bounds.extend([gym.lng, gym.lat]);
    bounds.extend([fromPoint.lng, fromPoint.lat]);
    map.fitBounds(bounds, { padding: 72, maxZoom: 15 });
  }, [fromPoint, gym]);

  function lookupAddress() {
    const q = fromDraft.trim();
    if (q.length < 2) {
      setFromPoint(null);
      setGeoStatus("idle");
      return;
    }

    setGeoStatus("loading");
    fetch(`http://localhost:3001/api/geocode?q=${encodeURIComponent(q)}`)
      .then((r) => r.json() as Promise<GeoHit[]>)
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
      <main className="gym-detail">
        <p className="gym-detail-muted">Ladataan…</p>
      </main>
    );
  }

  if (status === "missing" || !gym) {
    return (
      <main className="gym-detail">
        <h1>Salia ei löytynyt</h1>
        <p className="gym-detail-muted">Tarkista osoite tai palaa selaamaan.</p>
        <Link className="gym-detail-back" to="/fi/kuntosalit">
          ← Selaa kuntosaleja
        </Link>
      </main>
    );
  }

  const detail = getGymDetailMock(gym.slug);
  const chain = gym.chain;
  const siteUrl = getChainWebsite(chain?.slug);
  const heroSrc = chain?.image || null;
  const heroIsLogo = Boolean(chain?.image && chain.logoFit === "contain");
  const heroIsText = !chain?.image;
  const promoTag =
    detail.services.find((s) => PROMO_TAGS.includes(s)) ?? null;
  const tripKm =
    fromPoint && gym.lat != null && gym.lng != null
      ? distanceKm(fromPoint.lat, fromPoint.lng, gym.lat, gym.lng)
      : null;

  const hours = detail.hours;

  return (
    <main className="gym-detail">
      <div className="gym-detail-body">
        <div className="gym-detail-left-sticky">
          <Link className="gym-detail-back" to="/fi/kuntosalit">
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
            Takaisin selaamaan
          </Link>
        </div>

        <div className="gym-detail-main">
          <article className="gym-detail-card">
            <div
              className={[
                "gym-detail-logo",
                heroIsLogo ? "is-logo" : "",
                heroIsText ? "is-text" : "",
                chain?.logoClass || "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {heroSrc ? (
                <img src={heroSrc} alt="" />
              ) : (
                <span className="gym-detail-logo-name">{gym.name}</span>
              )}
            </div>

            <div className="gym-detail-title-row">
              <div className="gym-detail-titles">
                <h1>{gym.name}</h1>
                <p>{gym.address}</p>
              </div>
              <div className="gym-detail-price">
                <span className="gym-detail-price-label">Alk.</span>
                <strong>{detail.monthlyPrice} €</strong>
                <span className="gym-detail-price-unit">/kk</span>
              </div>
            </div>

            {siteUrl ? (
              <a
                className="gym-detail-cta"
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
              >
                Siirry salin sivulle
              </a>
            ) : null}

            <hr className="gym-detail-divider" />

            <section className="gym-detail-section">
              <h2>Aukiolo ja pääsy</h2>
              {!hours ? (
                <p className="gym-detail-muted">Ei aukiolo- tai pääsytietoja.</p>
              ) : (
                <ul className="gym-detail-plans">
                  <li>
                    <span>Ma–pe</span>
                    <strong>
                      {cleanHoursValue(hours.weekday, hours.is247)}
                    </strong>
                  </li>
                  <li>
                    <span>La–su</span>
                    <strong>
                      {cleanHoursValue(hours.weekend, hours.is247)}
                    </strong>
                  </li>
                </ul>
              )}
            </section>

            <section className="gym-detail-section">
              <h2>Jäsenyysvaihtoehdot</h2>
              {detail.memberships.length > 0 ? (
                <ul className="gym-detail-plans">
                  {detail.memberships.map((m) => (
                    <li key={m.name}>
                      <span>
                        {m.name}
                        {m.note ? ` · ${m.note}` : ""}
                      </span>
                      <strong>{m.priceEur} €</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gym-detail-muted">Ei jäsenyystietoja.</p>
              )}
            </section>

            <section className="gym-detail-section">
              <h2>Palvelut</h2>
              {detail.services.length > 0 ? (
                <ul className="gym-detail-tags">
                  {detail.services.map((s) => (
                    <li
                      key={s}
                      className={promoTag === s ? "is-promo" : undefined}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gym-detail-muted">Ei palvelutietoja.</p>
              )}
            </section>

            <section className="gym-detail-section">
              <h2>Yhteystiedot</h2>
              {detail.contact.phone || detail.contact.email ? (
                <div className="gym-detail-contact">
                  {detail.contact.phone ? (
                    <div className="gym-detail-contact-item">
                      <span>Puhelin</span>
                      <div className="gym-detail-contact-row">
                        <a
                          href={`tel:${detail.contact.phone.replace(/\s/g, "")}`}
                        >
                          {detail.contact.phone}
                        </a>
                        <button
                          type="button"
                          className="gym-detail-copy"
                          aria-label="Kopioi puhelinnumero"
                          onClick={() =>
                            copyContact("phone", detail.contact.phone!)
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
                  {detail.contact.email ? (
                    <div className="gym-detail-contact-item">
                      <span>Sähköposti</span>
                      <div className="gym-detail-contact-row">
                        <a href={`mailto:${detail.contact.email}`}>
                          {detail.contact.email}
                        </a>
                        <button
                          type="button"
                          className="gym-detail-copy"
                          aria-label="Kopioi sähköposti"
                          onClick={() =>
                            copyContact("email", detail.contact.email!)
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
                <p className="gym-detail-muted">Ei yhteystietoja.</p>
              )}
            </section>

            {chain ? (
              <p className="gym-detail-chain-line">Ketju: {chain.name}</p>
            ) : null}
          </article>
        </div>

        <aside className="gym-detail-map-col" aria-label="Kartta">
          <div className="gym-detail-map-frame">
            <div className="gym-detail-map-float">
              <MapPin size={18} strokeWidth={2.2} aria-hidden="true" />
              <input
                className="gym-detail-from"
                type="text"
                value={fromDraft}
                placeholder="Lähtöosoite…"
                aria-label="Lähtöosoite"
                onChange={(e) => {
                  setFromDraft(e.target.value);
                  setGeoStatus("idle");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookupAddress();
                }}
                onBlur={lookupAddress}
              />
              <span className="gym-detail-crumb-sep" aria-hidden="true">
                &gt;
              </span>
              <span className="gym-detail-crumb-to" title={gym.name}>
                {gym.name}
              </span>
            </div>
            {geoStatus === "loading" ||
            geoStatus === "fail" ||
            tripKm != null ? (
              <p className="gym-detail-route-meta">
                {geoStatus === "loading"
                  ? "Haetaan osoitetta…"
                  : geoStatus === "fail"
                    ? "Osoitetta ei löytynyt"
                    : tripKm != null
                      ? `Matka salille noin ${tripKm.toFixed(1).replace(".", ",")} km`
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
