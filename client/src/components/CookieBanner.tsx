import { useEffect, useState } from "react";
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  writeCookieConsent,
} from "../data/cookieConsent";
import { syncAnalyticsFromConsent } from "../analytics";
import { useLang } from "../i18n/useLang";
import UxSwitch from "./UxSwitch";
import { useLockPageScroll } from "../hooks/useLockPageScroll";
import "./CookieBanner.css";

function CookieBanner() {
  const { t } = useLang();
  const [bannerOpen, setBannerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [functionalOn, setFunctionalOn] = useState(false);

  useEffect(() => {
    const current = readCookieConsent();
    setAnalyticsOn(current.analytics);
    setFunctionalOn(current.functional);
    setBannerOpen(!current.decided);
    syncAnalyticsFromConsent();

    function onOpenSettings() {
      const latest = readCookieConsent();
      setAnalyticsOn(latest.analytics);
      setFunctionalOn(latest.functional);
      setManageOpen(true);
      setBannerOpen(false);
    }

    window.addEventListener(COOKIE_SETTINGS_EVENT, onOpenSettings);
    return () => {
      window.removeEventListener(COOKIE_SETTINGS_EVENT, onOpenSettings);
    };
  }, []);

  useLockPageScroll(bannerOpen || manageOpen);

  function save(analytics: boolean, functional: boolean) {
    writeCookieConsent({ analytics, functional });
    setAnalyticsOn(analytics);
    setFunctionalOn(functional);
    setManageOpen(false);
    setBannerOpen(false);
    syncAnalyticsFromConsent();
  }

  function openManage() {
    const latest = readCookieConsent();
    setAnalyticsOn(latest.analytics);
    setFunctionalOn(latest.functional);
    setManageOpen(true);
    setBannerOpen(false);
  }

  return (
    <>
      {bannerOpen ? (
        <div className="cookie-banner-root" role="presentation">
          <div
            className="cookie-banner"
            role="dialog"
            aria-modal="true"
            aria-label={t("cookies")}
          >
            <div className="cookie-banner-top">
              <div className="cookie-banner-main">
                <p className="cookie-banner-title">{t("cookies")}</p>
                <p className="cookie-banner-text">{t("cookieBannerText")}</p>
              </div>

              <div className="cookie-banner-actions">
                <button
                  type="button"
                  className="cookie-banner-btn cookie-banner-btn-ghost"
                  onClick={openManage}
                >
                  {t("cookieManage")}
                </button>
                <button
                  type="button"
                  className="cookie-banner-btn cookie-banner-btn-ghost"
                  onClick={() => save(false, false)}
                >
                  {t("cookieNecessaryOnly")}
                </button>
                <button
                  type="button"
                  className="cookie-banner-btn"
                  onClick={() => save(true, true)}
                >
                  {t("cookieAllowAll")}
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
            aria-label={t("cookieManageTitle")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cookie-modal-head">
              <h2 className="cookie-modal-title">{t("cookieManageTitle")}</h2>
              <p className="cookie-modal-text">{t("cookieManageText")}</p>
            </div>

            <div className="cookie-modal-options">
              <div className="cookie-row is-locked">
                <span>
                  <strong>{t("cookieNecessary")}</strong>
                  <span className="cookie-row-desc">
                    {t("cookieNecessaryDesc")}
                  </span>
                </span>
                <UxSwitch checked disabled dim />
              </div>
              <div className="cookie-row">
                <span>
                  <strong>{t("cookieFunctional")}</strong>
                  <span className="cookie-row-desc">
                    {t("cookieFunctionalDesc")}
                  </span>
                </span>
                <UxSwitch
                  checked={functionalOn}
                  onChange={setFunctionalOn}
                />
              </div>
              <div className="cookie-row">
                <span>
                  <strong>{t("cookieAnalytics")}</strong>
                  <span className="cookie-row-desc">
                    {t("cookieAnalyticsDesc")}
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
                onClick={() => save(analyticsOn, functionalOn)}
              >
                {t("cookieSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default CookieBanner;
