import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart } from "lucide-react";
import AreaSelect from "./AreaSelect";
import FavoritesPopup from "./FavoritesPopup";
import HeaderSearch from "./HeaderSearch";
import { readFavoriteSlugs } from "../data/favorites";
import { pathGyms, switchLangPath } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { useChainPopup } from "../context/ChainPopupContext";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const { lang, t } = useLang();
  const location = useLocation();
  const { openChains } = useChainPopup();
  const nextLang = lang === "fi" ? "en" : "fi";
  const gymsPath = pathGyms(lang);
  const gymsOn =
    location.pathname === gymsPath ||
    location.pathname.startsWith(lang === "en" ? "/en/chain/" : "/fi/ketju/");
  const favWord = t("favorites");
  const [favHover, setFavHover] = useState(false);
  const [favKept, setFavKept] = useState(false);
  const [favShown, setFavShown] = useState(0);
  const [favFilled, setFavFilled] = useState(false);
  const [favCount, setFavCount] = useState(() => readFavoriteSlugs().length);
  const favOn = favHover || favKept || favoritesOpen;

  useEffect(() => {
    function syncFavs() {
      setFavCount(readFavoriteSlugs().length);
    }
    window.addEventListener("favorites-changed", syncFavs);
    window.addEventListener("storage", syncFavs);
    return () => {
      window.removeEventListener("favorites-changed", syncFavs);
      window.removeEventListener("storage", syncFavs);
    };
  }, []);

  useEffect(() => {
    if (favOn) {
      if (favShown >= favWord.length) return;
      const id = window.setTimeout(() => setFavShown((n) => n + 1), 16);
      return () => clearTimeout(id);
    }
    if (favShown <= 0) return;
    const id = window.setTimeout(() => setFavShown((n) => n - 1), 10);
    return () => clearTimeout(id);
  }, [favOn, favShown, favWord]);

  useEffect(() => {
    if (favOn && favShown >= favWord.length) {
      const id = window.setTimeout(() => setFavFilled(true), 20);
      return () => clearTimeout(id);
    }
    setFavFilled(false);
  }, [favOn, favShown, favWord]);

  useEffect(() => {
    if (favFilled && favHover) setFavKept(true);
  }, [favFilled, favHover]);

  return (
    <header className="header">
      <div className="header-left">
        <Link to={lang === "en" ? "/en" : "/"} className="header-logo">
          <img src="/liikux-logo-light.png?v=white" alt="Liikux" />
        </Link>
        <AreaSelect />
        <span className="header-sep" aria-hidden="true" />
        <nav className="header-nav" aria-label={t("gymsTitle")}>
          <Link
            to={gymsPath}
            className={gymsOn ? "header-nav-link is-on" : "header-nav-link"}
          >
            {t("gymsTitle")}
          </Link>
          <button
            type="button"
            className="header-nav-link"
            onClick={() => openChains()}
          >
            {t("chains")}
          </button>
          <button
            type="button"
            className={
              "header-nav-link header-fav" +
              (favShown > 0 ? " is-typing" : "") +
              (favHover ? " is-full" : "")
            }
            aria-label={
              favCount > 0 ? `${favWord}, ${favCount}` : favWord
            }
            onMouseEnter={() => setFavHover(true)}
            onMouseLeave={() => setFavHover(false)}
            onClick={() => setFavoritesOpen(true)}
          >
            <span className="header-fav-label" aria-hidden="true">
              {favWord.split("").map((ch, i) => (
                <span
                  key={i}
                  className={i < favShown ? "header-fav-ch is-on" : "header-fav-ch"}
                >
                  <span>{ch}</span>
                </span>
              ))}
            </span>
            <span className="header-fav-icon">
              <Heart size={20} strokeWidth={2.4} />
              {favCount > 0 ? (
                <span className="header-fav-count">{favCount}</span>
              ) : null}
            </span>
          </button>
        </nav>
      </div>

      <div className="header-right">
        <HeaderSearch />
        <button
          type="button"
          className="header-lang playstore-button is-plain"
          aria-label={nextLang === "en" ? t("langEn") : t("langFi")}
          title={nextLang === "en" ? t("switchToEn") : t("switchToFi")}
          onClick={() => {
            window.location.assign(
              switchLangPath(
                location.pathname,
                nextLang,
                location.search,
              ),
            );
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
