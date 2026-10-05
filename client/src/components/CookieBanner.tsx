import { useEffect, useState } from "react";
import "./CookieBanner.css";

const STORAGE_KEY = "liikux-cookies-ok";

function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Evästeet">
      <p className="cookie-banner-text">
        Käytämme evästeitä sivun toiminnan ja käyttökokemuksen parantamiseen.
        Jatkamalla hyväksyt evästeiden käytön.
      </p>
      <button type="button" className="cookie-banner-btn" onClick={accept}>
        Hyväksy
      </button>
    </div>
  );
}

export default CookieBanner;
