import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { fetchGyms } from "../data/api";
import { GENERATED_CITIES } from "../data/cities.generated";
import { toCitySlug } from "../data/citySlug";
import { REGIONS } from "../data/regionSlug";
import type { Gym } from "../data/types";
import { pathGymsCity } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "./CitiesPage.css";

/**
 * /fi/kaupungit and /en/cities: every town with gyms.
 *
 *   - search (ä/ö don't matter: "jyvas" finds Jyväskylä)
 *   - the biggest towns as tiles
 *   - all towns by region (maakunta), A–Ö, with gym counts
 *
 * The list of towns comes from data/cities.generated.ts (npm run db:cities);
 * gym counts are live from /api/gyms.
 */

type CityRow = { name: string; slug: string; region: string; count: number };

const TOP = 12;

function CitiesPage() {
  const { lang, t } = useLang();
  const { pathname } = useLocation();
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [q, setQ] = useState("");

  usePageMeta({
    title: `${t("citiesTitle")} | Liikux`,
    description: t("citiesLead"),
    path: pathname,
  });

  useEffect(() => {
    let alive = true;
    void fetchGyms().then((list) => alive && setGyms(list));
    return () => {
      alive = false;
    };
  }, []);

  const cities: CityRow[] = useMemo(() => {
    const live = new Map<string, number>();
    for (const g of gyms ?? []) {
      const slug = toCitySlug(g.city ?? "");
      if (slug) live.set(slug, (live.get(slug) ?? 0) + 1);
    }
    return GENERATED_CITIES.map((c) => ({
      name: c.name,
      slug: c.slug,
      region: c.region,
      count: gyms ? (live.get(c.slug) ?? 0) : c.gyms,
    })).filter((c) => c.count > 0);
  }, [gyms]);

  const query = q.trim();
  const found = useMemo(() => {
    if (!query) return null;
    const slugQ = toCitySlug(query);
    const lower = query.toLowerCase();
    return cities
      .filter((c) => c.name.toLowerCase().includes(lower) || (slugQ && c.slug.includes(slugQ)))
      .sort((a, b) => {
        // Names that start with the search come first.
        const as = a.slug.startsWith(slugQ) ? 0 : 1;
        const bs = b.slug.startsWith(slugQ) ? 0 : 1;
        return as - bs || b.count - a.count;
      });
  }, [cities, query]);

  const top = useMemo(() => [...cities].sort((a, b) => b.count - a.count).slice(0, TOP), [cities]);

  const byRegion = useMemo(() => {
    return REGIONS.map((r) => ({
      region: r.name,
      cities: cities.filter((c) => c.region === r.name).sort((a, b) => a.name.localeCompare(b.name, "fi")),
    })).filter((g) => g.cities.length > 0);
  }, [cities]);

  const total = cities.reduce((sum, c) => sum + c.count, 0);

  return (
    <main className="cities load-reveal">
      <header className="cities-head">
        <h1 className="cities-title">{t("citiesTitle")}</h1>
        <p className="cities-lead">{t("citiesCount", { cities: cities.length, gyms: total })}</p>
        <label className="cities-search">
          <Search size={18} strokeWidth={2.3} aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("citiesSearch")}
            aria-label={t("citiesSearch")}
            autoComplete="off"
          />
        </label>
      </header>

      {found ? (
        <section className="cities-results" aria-live="polite">
          {found.length ? (
            <ul className="cities-list is-results">
              {found.map((c) => (
                <li key={c.slug}>
                  <Link to={pathGymsCity(lang, c.slug)}>
                    <span className="cities-name">{c.name}</span>
                    <span className="cities-region-name">{c.region}</span>
                    <span className="cities-count">{(c.count === 1 ? t("homeCityGymOne") : t("homeCityGyms", { count: c.count }))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cities-empty">{t("citiesNone")}</p>
          )}
        </section>
      ) : (
        <>
          <section className="cities-top" aria-labelledby="cities-top-h">
            <h2 id="cities-top-h" className="cities-h">
              {t("citiesBiggest")}
            </h2>
            <div className="cities-tiles">
              {top.map((c) => (
                <Link key={c.slug} className="cities-tile" to={pathGymsCity(lang, c.slug)}>
                  <MapPin size={16} strokeWidth={2.3} aria-hidden="true" />
                  <span className="cities-tile-name">{c.name}</span>
                  <span className="cities-tile-count">{(c.count === 1 ? t("homeCityGymOne") : t("homeCityGyms", { count: c.count }))}</span>
                  <ArrowRight className="cities-tile-arrow" size={16} strokeWidth={2.3} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section className="cities-regions" aria-labelledby="cities-all-h">
            <h2 id="cities-all-h" className="cities-h">
              {t("citiesAll")}
            </h2>
            <div className="cities-region-grid">
              {byRegion.map((g) => (
                <section key={g.region} className="cities-region">
                  <h3>
                    {g.region}
                    <span>{g.cities.reduce((s, c) => s + c.count, 0)}</span>
                  </h3>
                  <ul className="cities-list">
                    {g.cities.map((c) => (
                      <li key={c.slug}>
                        <Link to={pathGymsCity(lang, c.slug)}>
                          <span className="cities-name">{c.name}</span>
                          <span className="cities-count">{c.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default CitiesPage;
