import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  writeCookieConsent,
} from "../data/cookieConsent";
import { syncAnalyticsFromConsent } from "../analytics";
import { switchLangPath, type Lang } from "../i18n/lang";
import { t as tr, type MessageKey } from "../i18n/messages";
import { useLang } from "../i18n/useLang";
import UxSwitch from "./UxSwitch";
import { useLockPageScroll } from "../hooks/useLockPageScroll";
import "flag-icons/css/flag-icons.min.css";
import "./CookieBanner.css";

function CookieBanner() {
  const { lang, t } = useLang();
  const location = useLocation();
  const [bannerOpen, setBannerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [firstChoice, setFirstChoice] = useState(false);
  const [pickLang, setPickLang] = useState<Lang>(lang);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [functionalOn, setFunctionalOn] = useState(false);

  function bt(key: MessageKey) {
    return firstChoice ? tr(pickLang, key) : t(key);
  }

  useEffect(() => {
    const current = readCookieConsent();
    setAnalyticsOn(current.analytics);
    setFunctionalOn(current.functional);
    const undecided = !current.decided;
    setBannerOpen(undecided);
    setFirstChoice(undecided);
    if (undecided) setPickLang(lang);
    syncAnalyticsFromConsent();

    function onOpenSettings() {
      const latest = readCookieConsent();
      setAnalyticsOn(latest.analytics);
      setFunctionalOn(latest.functional);
      setManageOpen(true);
      setBannerOpen(false);
      if (!latest.decided) {
        setFirstChoice(true);
      } else {
        setFirstChoice(false);
      }
    }

    window.addEventListener(COOKIE_SETTINGS_EVENT, onOpenSettings);
    return () => {
      window.removeEventListener(COOKIE_SETTINGS_EVENT, onOpenSettings);
    };
  }, [lang]);

  useLockPageScroll(bannerOpen || manageOpen);

  function finish(analytics: boolean, functional: boolean) {
    writeCookieConsent({ analytics, functional });
    setAnalyticsOn(analytics);
    setFunctionalOn(functional);
    setManageOpen(false);
    setBannerOpen(false);
    syncAnalyticsFromConsent();

    if (firstChoice && pickLang !== lang) {
      window.location.assign(
        switchLangPath(location.pathname, pickLang, location.search),
      );
      return;
    }
    setFirstChoice(false);
  }

  function openManage() {
    const latest = readCookieConsent();
    setAnalyticsOn(latest.analytics);
    setFunctionalOn(latest.functional);
    setManageOpen(true);
    setBannerOpen(false);
  }

  const flagLang: Lang = pickLang === "fi" ? "en" : "fi";

  return (
    <>
      {bannerOpen ? (
        <div className="cookie-banner-root" role="presentation">
          <div
            className="cookie-banner"
            role="dialog"
            aria-modal="true"
            aria-label={bt("cookies")}
          >
            <button
              type="button"
              className="cookie-lang-btn"
              aria-label={
                flagLang === "en" ? tr(pickLang, "langEn") : tr(pickLang, "langFi")
              }
              title={
                flagLang === "en"
                  ? tr(pickLang, "switchToEn")
                  : tr(pickLang, "switchToFi")
              }
              onClick={() => setPickLang(flagLang)}
            >
              <span
                className={flagLang === "en" ? "fi fi-gb" : "fi fi-fi"}
              />
            </button>
            <div className="cookie-banner-top">
              <div className="cookie-banner-main">
                <p className="cookie-banner-title">{bt("cookies")}</p>
                <p className="cookie-banner-text">{bt("cookieBannerText")}</p>
              </div>

              <div className="cookie-banner-actions">
                <button
                  type="button"
                  className="cookie-banner-btn cookie-banner-btn-ghost"
                  onClick={openManage}
                >
                  {bt("cookieManage")}
                </button>
                <button
                  type="button"
                  className="cookie-banner-btn cookie-banner-btn-ghost"
                  onClick={() => finish(false, false)}
                >
                  {bt("cookieNecessaryOnly")}
                </button>
                <button
                  type="button"
                  className="cookie-banner-btn"
                  onClick={() => finish(true, true)}
                >
                  {bt("cookieAllowAll")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {manageOpen ? (
        <div
          className="cookie-modal-root"
          role="presentation"
          onClick={() => {
            if (readCookieConsent().decided) setManageOpen(false);
          }}
        >
          <div
            className="cookie-modal"
            role="dialog"
            aria-modal="true"
            aria-label={bt("cookieManageTitle")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cookie-modal-head">
              <h2 className="cookie-modal-title">{bt("cookieManageTitle")}</h2>
              <p className="cookie-modal-text">{bt("cookieManageText")}</p>
            </div>

            <div className="cookie-modal-options">
              <div className="cookie-row is-locked">
                <span>
                  <strong>{bt("cookieNecessary")}</strong>
                  <span className="cookie-row-desc">
                    {bt("cookieNecessaryDesc")}
                  </span>
                </span>
                <UxSwitch checked disabled dim />
              </div>
              <div className="cookie-row">
                <span>
                  <strong>{bt("cookieFunctional")}</strong>
                  <span className="cookie-row-desc">
                    {bt("cookieFunctionalDesc")}
                  </span>
                </span>
                <UxSwitch
                  checked={functionalOn}
                  onChange={setFunctionalOn}
                />
              </div>
              <div className="cookie-row">
                <span>
                  <strong>{bt("cookieAnalytics")}</strong>
                  <span className="cookie-row-desc">
                    {bt("cookieAnalyticsDesc")}
                  </span>
                </span>
                <UxSwitch
                  checked={analyticsOn}
                  onChange={setAnalyticsOn}
                />
              </div>
            </div>

            <div className="cookie-modal-footer">
              <button
                type="button"
                className="cookie-banner-btn"
                onClick={() => finish(analyticsOn, functionalOn)}
              >
                {bt("cookieSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default CookieBanner;
