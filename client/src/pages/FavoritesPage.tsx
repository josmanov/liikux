import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Heart,
  Share2,
  Trash2,
} from "lucide-react";
import LoadSpin from "../components/LoadSpin";
import { useAppLocation } from "../context/LocationContext";
import { fetchGyms } from "../data/api";
import { readFavoriteSlugs, writeFavoriteSlugs } from "../data/favorites";
import {
  cleanGymDisplayName,
  formatDistanceKm,
  formatGymStreetLine,
} from "../data/format";
import { type Gym, resolveGymOffer } from "../data/types";
import { distanceKm } from "../features/browse/utils/distanceKm";
import FavoritesMap from "../features/favorites/FavoritesMap";
import { cleanHoursValue } from "../features/gym-detail/utils/cleanHoursValue";
import { pathFavorites, pathGym, pathGymsFromLocation } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "./FavoritesPage.css";

/**
 * Favorites + compare page (/fi/suosikit, /en/favorites).
 *
 *  - A table with one row per favorite gym: price, distance, hours, free trial.
 *    Click a column title to sort. The best price and the shortest distance
 *    are highlighted.
 *  - A map with the same gyms. Pointing at a row lights up its pin; clicking
 *    a pin highlights its row.
 *  - "Share" copies a link (…?salit=slug,slug) that shows the same list to
 *    someone else without touching their own favorites.
 *  - Removing gyms shows an "Undo" message for 5 seconds.
 *
 * Favorites live in the browser (localStorage, see data/favorites.ts).
 */

type SortKey = "name" | "price" | "distance";
type Row = {
  gym: Gym;
  name: string;
  price: number | null;
  km: number | null;
  hours: string | null;
  trial: boolean;
};

const PROMO_TAGS = ["Ilmainen kokeilu", "Free trial"];

function eurText(eur: number) {
  return Number.isInteger(eur)
    ? String(eur)
    : String(Number(eur.toFixed(2))).replace(".", ",");
}

/** Smallest number in the list, or null when fewer than two rows have a value. */
function bestOf(values: (number | null)[]) {
  const known = values.filter((v): v is number => v != null);
  return known.length >= 2 ? Math.min(...known) : null;
}

function FavoritesPage() {
  const { lang, t } = useLang();
  const { label: placeLabel, lat: placeLat, lng: placeLng } = useAppLocation();
  const [params] = useSearchParams();

  // A share link carries the gyms in the address: ?salit=slug,slug
  const sharedSlugs = useMemo(
    () =>
      (params.get("salit") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [params],
  );
  const isShared = sharedSlugs.length > 0;

  const [mySlugs, setMySlugs] = useState(() => readFavoriteSlugs());
  const [allGyms, setAllGyms] = useState<Gym[] | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; up: boolean }>({
    key: "distance",
    up: true,
  });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [undo, setUndo] = useState<{ before: string[]; count: number } | null>(
    null,
  );
  const undoTimer = useRef(0);

  usePageMeta({
    title:
      lang === "fi"
        ? "Suosikit – vertaa kuntosaleja | Liikux"
        : "Favorites – compare gyms | Liikux",
    description:
      lang === "fi"
        ? "Vertaa tallentamiesi kuntosalien hintoja, etäisyyksiä ja aukioloaikoja rinnakkain."
        : "Compare the prices, distances and opening hours of your saved gyms side by side.",
    path: pathFavorites(lang),
  });

  useEffect(() => {
    let alive = true;
    fetchGyms().then((g) => alive && setAllGyms(g));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const sync = () => setMySlugs(readFavoriteSlugs());
    window.addEventListener("favorites-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("favorites-changed", sync);
      window.removeEventListener("storage", sync);
      window.clearTimeout(undoTimer.current);
    };
  }, []);

  const slugs = isShared ? sharedSlugs : mySlugs;
  const hasOrigin = placeLat != null && placeLng != null;

  const rows = useMemo<Row[]>(() => {
    if (!allGyms) return [];
    const list: Row[] = [];
    for (const slug of slugs) {
      const gym = allGyms.find((g) => g.slug === slug);
      if (!gym) continue;
      const offer = resolveGymOffer(gym, gym.chain);
      list.push({
        gym,
        name: cleanGymDisplayName(gym.name),
        price:
          offer.priceFrom != null && offer.priceFrom > 0
            ? offer.priceFrom
            : null,
        km:
          hasOrigin && gym.lat != null && gym.lng != null
            ? distanceKm(placeLat, placeLng, gym.lat, gym.lng)
            : null,
        hours:
          offer.is247 === true
            ? "24/7"
            : offer.hoursWeekday
              ? cleanHoursValue(offer.hoursWeekday, false)
              : null,
        trial:
          offer.freeTrial === true ||
          offer.services.some((s) => PROMO_TAGS.includes(s)),
      });
    }
    // Sort; rows without a value always go last.
    const dir = sort.up ? 1 : -1;
    return list.sort((a, b) => {
      if (sort.key === "name") return dir * a.name.localeCompare(b.name, "fi");
      const av = sort.key === "price" ? a.price : a.km;
      const bv = sort.key === "price" ? b.price : b.km;
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return dir * (av - bv);
    });
  }, [allGyms, slugs, sort, hasOrigin, placeLat, placeLng]);

  const bestPrice = bestOf(rows.map((r) => r.price));
  const bestKm = bestOf(rows.map((r) => r.km));

  // Gyms for the map, with the price the table shows (the chain's price when the gym has none).
  const mapGyms = useMemo<Gym[]>(
    () => rows.map((r) => ({ ...r.gym, priceFrom: r.price ?? null })),
    [rows],
  );

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, up: !s.up } : { key, up: true }));
  }

  /** Remove gyms from my favorites and offer "Undo" for 5 seconds. */
  function remove(list: string[]) {
    const before = readFavoriteSlugs();
    writeFavoriteSlugs(before.filter((s) => !list.includes(s)));
    setConfirming(false);
    setUndo({ before, count: list.length });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 5000);
  }

  function toggleMine(slug: string) {
    if (mySlugs.includes(slug)) remove([slug]);
    else writeFavoriteSlugs([...readFavoriteSlugs(), slug]);
  }

  function share() {
    const url =
      window.location.origin +
      pathFavorites(
        lang,
        rows.map((r) => r.gym.slug),
      );
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  function pickFromMap(slug: string) {
    setActiveSlug(slug);
    document
      .getElementById(`fav-row-${slug}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function sortHead(key: SortKey, text: string) {
    const on = sort.key === key;
    return (
      <th aria-sort={on ? (sort.up ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className={on ? "is-on" : undefined}
          onClick={() => sortBy(key)}
        >
          {text}
          {on ? (
            sort.up ? (
              <ArrowUp size={13} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <ArrowDown size={13} strokeWidth={2.6} aria-hidden="true" />
            )
          ) : null}
        </button>
      </th>
    );
  }

  const browsePath = pathGymsFromLocation(lang, placeLabel, { lat: placeLat, lng: placeLng });

  return (
    <main className="fav load-reveal">
      <header className="fav-head">
        <div>
          <h1 className="fav-title">
            {t("favTitle")}
            {rows.length > 0 ? <span>{rows.length}</span> : null}
          </h1>
          <p className="fav-lead">{t("favLead")}</p>
        </div>

        {rows.length > 0 ? (
          <div className="fav-actions">
            {isShared ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  writeFavoriteSlugs([
                    ...new Set([...readFavoriteSlugs(), ...sharedSlugs]),
                  ])
                }
              >
                <Heart size={16} strokeWidth={2.4} aria-hidden="true" />
                {t("favSaveAll")}
              </button>
            ) : confirming ? (
              <>
                <span className="fav-confirm">
                  {t("favConfirm", { count: rows.length })}
                </span>
                <button
                  type="button"
                  className="btn btn-soft fav-danger"
                  onClick={() => remove(mySlugs)}
                >
                  {t("favConfirmYes")}
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setConfirming(false)}
                >
                  {t("favCancel")}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-soft" onClick={share}>
                  {copied ? (
                    <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <Share2 size={16} strokeWidth={2.3} aria-hidden="true" />
                  )}
                  {copied ? t("favShared") : t("favShare")}
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                  {t("favRemoveAll")}
                </button>
              </>
            )}
          </div>
        ) : null}
      </header>

      {isShared ? (
        <p className="fav-shared">
          {t("favSharedNote")}{" "}
          <Link to={pathFavorites(lang)}>{t("favTitle")}</Link>
        </p>
      ) : null}

      {allGyms == null ? (
        <div className="fav-loading">
          <LoadSpin />
        </div>
      ) : rows.length === 0 ? (
        <div className="fav-empty">
          <Heart size={28} strokeWidth={2} aria-hidden="true" />
          <h2>{t("favEmptyTitle")}</h2>
          <p>{t("favEmptyText")}</p>
          <Link className="btn btn-primary" to={browsePath}>
            {t("browseGyms")}
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="fav-grid">
          <div className="fav-table-wrap">
            <table className="fav-table">
              <thead>
                <tr>
                  {sortHead("name", t("favColGym"))}
                  {sortHead("price", t("favColPrice"))}
                  {sortHead("distance", t("favColDistance"))}
                  <th>{t("favColHours")}</th>
                  <th>{t("favColTrial")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const slug = r.gym.slug;
                  const mine = mySlugs.includes(slug);
                  const chain =
                    r.gym.chain && r.gym.chain.slug !== "muut"
                      ? r.gym.chain.name
                      : null;
                  const place = [formatGymStreetLine(r.gym), r.gym.city]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr
                      key={slug}
                      id={`fav-row-${slug}`}
                      className={activeSlug === slug ? "is-active" : undefined}
                      onMouseEnter={() => setActiveSlug(slug)}
                      onMouseLeave={() =>
                        setActiveSlug((s) => (s === slug ? null : s))
                      }
                    >
                      <td className="fav-cell-gym">
                        {chain ? (
                          <span className="fav-chain">{chain}</span>
                        ) : null}
                        <Link className="fav-name" to={pathGym(lang, slug)}>
                          {r.name}
                        </Link>
                        {place ? (
                          <span className="fav-place">{place}</span>
                        ) : null}
                      </td>
                      <td
                        data-label={t("favColPrice")}
                        className={
                          r.price != null && r.price === bestPrice
                            ? "is-best"
                            : undefined
                        }
                      >
                        {r.price != null ? (
                          <>
                            <strong>{eurText(r.price)} €</strong>
                            <small>/{lang === "fi" ? "kk" : "mo"}</small>
                          </>
                        ) : (
                          <span className="fav-none">–</span>
                        )}
                      </td>
                      <td
                        data-label={t("favColDistance")}
                        className={
                          r.km != null && r.km === bestKm
                            ? "is-best"
                            : undefined
                        }
                      >
                        {r.km != null ? (
                          <strong>{formatDistanceKm(r.km)}</strong>
                        ) : (
                          <span className="fav-none">–</span>
                        )}
                      </td>
                      <td data-label={t("favColHours")}>
                        {r.hours ?? <span className="fav-none">–</span>}
                      </td>
                      <td data-label={t("favColTrial")}>
                        {r.trial ? (
                          <span className="fav-yes">
                            <Check
                              size={15}
                              strokeWidth={2.8}
                              aria-hidden="true"
                            />
                            {t("gymYes")}
                          </span>
                        ) : (
                          <span className="fav-none">–</span>
                        )}
                      </td>
                      <td className="fav-cell-act">
                        <button
                          type="button"
                          className={mine ? "fav-heart is-on" : "fav-heart"}
                          aria-pressed={mine}
                          aria-label={
                            mine ? t("removeFavorite") : t("addFavorite")
                          }
                          title={mine ? t("removeFavorite") : t("addFavorite")}
                          onClick={() => toggleMine(slug)}
                        >
                          <Heart size={18} strokeWidth={2.2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasOrigin ? (
              <p className="fav-foot">
                {t("statsDistance")}: {placeLabel}
              </p>
            ) : null}
          </div>

          <aside className="fav-side" aria-label={t("map")}>
            <FavoritesMap
              gyms={mapGyms}
              origin={hasOrigin ? { lat: placeLat, lng: placeLng, label: placeLabel } : null}
              activeSlug={activeSlug}
              onPick={pickFromMap}
              onHover={setActiveSlug}
            />
          </aside>
        </div>
      )}

      {/* Drawn straight into <body> so nothing on the page can cover it. */}
      {undo
        ? createPortal(
            <div className="fav-toast" role="status">
              {t("favRemoved", { count: undo.count })}
              <button
                type="button"
                onClick={() => {
                  writeFavoriteSlugs(undo.before);
                  setUndo(null);
                }}
              >
                {t("favUndo")}
              </button>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}

export default FavoritesPage;
