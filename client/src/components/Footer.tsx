import { Link, useLocation } from "react-router-dom";
import { openCookieSettings } from "../data/cookieConsent";
import {
  pathAbout,
  pathFeedback,
  pathGyms,
  pathGymsCity,
  pathHome,
  pathLegal,
  switchLangPath,
} from "../i18n/lang";
import { pathChains } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./Footer.css";

const FOOTER_CITIES: Array<[slug: string, name: string]> = [
  ["helsinki", "Helsinki"],
  ["espoo", "Espoo"],
  ["vantaa", "Vantaa"],
  ["tampere", "Tampere"],
  ["turku", "Turku"],
  ["oulu", "Oulu"],
];

/**
 * Footer: brand, then link columns:
 * find a gym · cities · information (feedback, legal, language).
 */
function Footer() {
  const { lang, t } = useLang();
  const { pathname, search } = useLocation();
  const nextLang = lang === "fi" ? "en" : "fi";

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-about">
          <Link to={pathHome(lang)} className="footer-brand">
            <img
              src="/brand/logo-white.png?v=1"
              alt="Liikux"
              width={110}
              height={35}
              decoding="async"
              loading="lazy"
            />
          </Link>
          <p className="footer-tagline">{t("footerTagline")}</p>
        </div>

        <nav className="footer-col" aria-label={t("footerFind")}>
          <h2 className="footer-h">{t("footerFind")}</h2>
          <Link to={pathGyms(lang)}>{t("footerAllGyms")}</Link>
          <Link to={pathChains(lang)}>{t("chains")}</Link>
          <Link to={`${pathGyms(lang)}?247=1`}>{t("footer247")}</Link>
          <Link to={`${pathGyms(lang)}?trial=1`}>{t("footerTrial")}</Link>
        </nav>

        <nav className="footer-col" aria-label={t("homeCitiesTitle")}>
          <h2 className="footer-h">{t("homeCitiesTitle")}</h2>
          {FOOTER_CITIES.map(([slug, name]) => (
            <Link key={slug} to={pathGymsCity(lang, slug)}>
              {name}
            </Link>
          ))}
        </nav>

        <nav className="footer-col" aria-label={t("footerInfo")}>
          <h2 className="footer-h">{t("footerInfo")}</h2>
          <Link to={pathAbout(lang)}>{t("footerAbout")}</Link>
          <Link to={pathFeedback(lang, "suggest")}>{t("headerMissingGym")}</Link>
          <Link to={pathFeedback(lang, "error")}>{t("reportError")}</Link>
          <Link to={pathFeedback(lang, "feedback")}>{t("footerFeedback")}</Link>
          <Link to={pathLegal(lang, "terms")}>{t("footerTerms")}</Link>
          <Link to={pathLegal(lang, "privacy")}>{t("footerPrivacy")}</Link>
          <Link to={pathLegal(lang, "cookies")}>{t("footerCookies")}</Link>
          <button type="button" className="footer-link-btn" onClick={() => openCookieSettings()}>
            {t("cookieSettings")}
          </button>
          <a href={switchLangPath(pathname, nextLang, search)}>
            {nextLang === "en" ? "In English" : "Suomeksi"}
          </a>
        </nav>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Liikux</p>
      </div>
    </footer>
  );
}

export default Footer;
