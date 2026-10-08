import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AreaSelect from "./AreaSelect";
import FavoritesPopup from "./FavoritesPopup";
import HeaderSearch from "./HeaderSearch";
import { switchLangPath } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const { lang, t } = useLang();
  const location = useLocation();
  const nextLang = lang === "fi" ? "en" : "fi";

  return (
    <header className="header">
      <div className="header-left">
        <Link to={lang === "en" ? "/en" : "/"} className="header-logo">
          <img src="/liikux-logo-light.png?v=white" alt="Liikux" />
        </Link>
        <AreaSelect />
      </div>

      <div className="header-right">
        <HeaderSearch />
        <button
          type="button"
          className="playstore-button is-plain"
          onClick={() => setFavoritesOpen(true)}
        >
          <span className="texts">
            <span className="text-2">{t("favorites")}</span>
          </span>
        </button>
        <button
          type="button"
          className="header-lang playstore-button is-plain"
          aria-label={nextLang === "en" ? t("langEn") : t("langFi")}
          title={
            nextLang === "en"
              ? "Switch to English"
              : "Vaihda suomeksi"
          }
          onClick={() => {
            window.location.assign(switchLangPath(location.pathname, nextLang));
          }}
        >
          <span className={nextLang === "en" ? "fi fi-gb" : "fi fi-fi"}></span>
        </button>
      </div>

      <FavoritesPopup
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
      />
    </header>
  );
}

export default Header;
