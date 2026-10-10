import { Link } from "react-router-dom";
import { openCookieSettings } from "../data/cookieConsent";
import { pathHome, pathLegal } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./Footer.css";

function Footer() {
  const { lang, t } = useLang();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to={pathHome(lang)} className="footer-brand">
          <img src="/liikux-logo-light.png?v=white" alt="Liikux" />
        </Link>
        <nav className="footer-nav" aria-label={t("footerNav")}>
          <Link to={pathLegal(lang, "terms")}>{t("footerTerms")}</Link>
          <Link to={pathLegal(lang, "privacy")}>{t("footerPrivacy")}</Link>
          <Link to={pathLegal(lang, "cookies")}>{t("footerCookies")}</Link>
          <button
            type="button"
            className="footer-nav-btn"
            onClick={() => openCookieSettings()}
          >
            {t("cookieSettings")}
          </button>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Liikux</p>
      </div>
    </footer>
  );
}

export default Footer;
