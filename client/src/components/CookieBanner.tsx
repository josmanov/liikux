import { useEffect, useState } from "react";
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  writeCookieConsent,
} from "../data/cookieConsent";
import { syncAnalyticsFromConsent } from "../analytics";
import UxSwitch from "./UxSwitch";
import { useLockPageScroll } from "../hooks/useLockPageScroll";
import "./CookieBanner.css";

function CookieBanner() {
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

  useLockPageScroll(manageOpen);

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
        <div className="cookie-banner" role="dialog" aria-label="Evästeet">
          <div className="cookie-banner-top">
            <div className="cookie-banner-main">
              <p className="cookie-banner-title">Evästeet</p>
              <p className="cookie-banner-text">
                Pakolliset pitävät sivun kunnossa. Analytiikka ja toiminnalliset
                ovat valinnaisia — voit sallia kaikki tai valita itse.
              </p>
            </div>

            <div className="cookie-banner-actions">
              <button
                type="button"
                className="cookie-banner-btn cookie-banner-btn-ghost"
                onClick={openManage}
              >
                Hallinnoi
              </button>
              <button
                type="button"
                className="cookie-banner-btn cookie-banner-btn-ghost"
                onClick={() => save(false, false)}
              >
                Vain pakolliset
              </button>
              <button
                type="button"
                className="cookie-banner-btn"
                onClick={() => save(true, true)}
              >
                Salli kaikki
              </button>
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
            aria-label="Hallinnoi evästeitä"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cookie-modal-head">
              <h2 className="cookie-modal-title">Hallinnoi evästeitä</h2>
              <p className="cookie-modal-text">
                Valitse mitä sallitaan. Pakolliset ovat aina käytössä.
              </p>
            </div>

            <div className="cookie-modal-options">
              <div className="cookie-row is-locked">
                <span>
                  <strong>Pakolliset</strong>
                  <span className="cookie-row-desc">
                    Sivun toiminta, suosikit, kielivalinnat. Aina päällä.
                  </span>
                </span>
                <UxSwitch checked disabled dim />
              </div>
              <div className="cookie-row">
                <span>
                  <strong>Toiminnalliset</strong>
                  <span className="cookie-row-desc">
                    Parantavat käyttökokemusta (esim. muistetut suodattimet ja
                    asetukset).
                  </span>
                </span>
                <UxSwitch
                  checked={functionalOn}
                  onChange={setFunctionalOn}
                />
              </div>
              <div className="cookie-row">
                <span>
                  <strong>Analytiikka</strong>
                  <span className="cookie-row-desc">
                    Käyttötilastot (esim. Google Analytics). Ladataan vain jos
                    sallit.
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
                Tallenna
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default CookieBanner;
