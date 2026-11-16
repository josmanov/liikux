import { Link, Navigate, useLocation } from "react-router-dom";
import { pathHome, pathLegal, type Lang } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import { openCookieSettings } from "../data/cookieConsent";
import { LEGAL_FI } from "../features/legal/fi";
import { LEGAL_EN } from "../features/legal/en";
import type { LegalSlug } from "../features/legal/types";
import "./LegalPage.css";

/**
 * Terms (/fi/kayttoehdot), privacy (/fi/tietosuoja) and cookies (/fi/evasteet).
 * The texts live in features/legal/fi.ts and en.ts.
 */
const FI_TO_SLUG: Record<string, LegalSlug> = {
  kayttoehdot: "terms",
  tietosuoja: "privacy",
  evasteet: "cookies",
};

const EN_TO_SLUG: Record<string, LegalSlug> = {
  terms: "terms",
  privacy: "privacy",
  cookies: "cookies",
};

const DOCS = { fi: LEGAL_FI, en: LEGAL_EN };

function resolveSlug(lang: Lang, pathname: string): LegalSlug | null {
  const part = pathname.split("/").filter(Boolean)[1] || "";
  const map = lang === "en" ? EN_TO_SLUG : FI_TO_SLUG;
  return map[part] ?? null;
}

function LegalPage() {
  const { lang, t } = useLang();
  const { pathname } = useLocation();
  const key = resolveSlug(lang, pathname);
  const doc = key ? DOCS[lang][key] : null;

  usePageMeta({
    title: doc ? `${doc.title} | Liikux` : "Liikux",
    description: doc?.intro ?? "Liikux",
    path: pathname,
  });

  if (!key || !doc) {
    return <Navigate to={pathHome(lang)} replace />;
  }

  const others = (["terms", "privacy", "cookies"] as LegalSlug[]).filter((s) => s !== key);

  return (
    <main className="legal-page load-reveal">
      <div className="legal-page-inner">
        <p className="legal-page-updated">{doc.updated}</p>
        <h1 className="legal-page-title">{doc.title}</h1>
        <p className="legal-page-intro">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.h} className="legal-section">
            <h2>{s.h}</h2>
            {s.table ? (
              <div className="legal-table-wrap">
                <table className="legal-table">
                  <thead>
                    <tr>
                      {s.table.head.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, i) => (
                          <td key={i} data-label={s.table!.head[i]}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {s.p?.map((p) => <p key={p}>{p}</p>)}
            {s.list ? (
              <ul>
                {s.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="legal-page-foot">
          {key === "cookies" ? (
            <button type="button" className="btn btn-primary" onClick={() => openCookieSettings()}>
              {t("cookieSettings")}
            </button>
          ) : null}
          {others.map((s) => (
            <Link key={s} className="btn btn-ghost" to={pathLegal(lang, s)}>
              {DOCS[lang][s].title}
            </Link>
          ))}
          <Link className="legal-page-back" to={pathHome(lang)}>
            {t("backHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default LegalPage;
