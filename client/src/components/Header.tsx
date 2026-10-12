import { useEffect, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dumbbell, Heart, Home, Menu, Store, X } from "lucide-react";
import AreaSelect from "./AreaSelect";
import FavoritesPopup from "./FavoritesPopup";
import HeaderSearch from "./HeaderSearch";
import { readFavoriteSlugs } from "../data/favorites";
import { useAppLocation } from "../context/LocationContext";
import { pathGyms, pathGymsFromLocation, pathHome, switchLangPath } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { useChainPopup } from "../context/ChainPopupContext";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, t } = useLang();
  const location = useLocation();
  const { label: locationLabel } = useAppLocation();
  const { openChains } = useChainPopup();
  const nextLang = lang === "fi" ? "en" : "fi";
  const homePath = pathHome(lang);
  const gymsPath = pathGymsFromLocation(lang, locationLabel);
  const gymsBase = pathGyms(lang);
  const homeOn = location.pathname === homePath;
  const gymsOn =
    location.pathname === gymsBase ||
    location.pathname.startsWith(gymsBase + "/") ||
    location.pathname.startsWith(lang === "en" ? "/en/chain/" : "/fi/ketju/");

  function stayIfSame(e: MouseEvent, path: string) {
    if (location.pathname === path) e.preventDefault();
  }
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
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  function goLang() {
    window.location.assign(
      switchLangPath(location.pathname, nextLang, location.search),
    );
  }

  return (
    <header className={menuOpen ? "header is-menu-open" : "header"}>
      <div className="header-left">
        <Link
          to={homePath}
          className="header-logo"
          onClick={(e) => stayIfSame(e, homePath)}
        >
          <img
            src="/liikux-logo-light.png?v=3"
            alt="Liikux"
            width={140}
            height={63}
            decoding="async"
            fetchPriority="high"
          />
        </Link>
        <div className="header-area-desktop">
          <AreaSelect />
        </div>
        <span className="header-sep" aria-hidden="true" />
        <nav className="header-nav" aria-label={t("menu")}>
          <Link
            to={homePath}
            className={homeOn ? "header-nav-link is-on" : "header-nav-link"}
            onClick={(e) => stayIfSame(e, homePath)}
          >
            <Home size={16} strokeWidth={2.2} />
            {t("home")}
          </Link>
          <Link
            to={gymsPath}
            className={gymsOn ? "header-nav-link is-on" : "header-nav-link"}
            onClick={(e) => stayIfSame(e, gymsPath)}
          >
            <Dumbbell size={16} strokeWidth={2.2} />
            {t("navBrowse")}
          </Link>
          <button
            type="button"
            className="header-nav-link"
            onClick={() => openChains()}
          >
            <Store size={16} strokeWidth={2.2} />
            {t("chains")}
          </button>
        </nav>
      </div>

      <button
        type="button"
        className={
          "header-nav-link header-fav" +
          (favShown > 0 ? " is-typing" : "") +
          (favHover ? " is-full" : "")
        }
        aria-label={favCount > 0 ? `${favWord}, ${favCount}` : favWord}
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

      <div className="header-right">
        <HeaderSearch />
        <button
          type="button"
          className="header-lang playstore-button is-plain header-lang-desktop"
          aria-label={nextLang === "en" ? t("langEn") : t("langFi")}
          title={nextLang === "en" ? t("switchToEn") : t("switchToFi")}
          onClick={goLang}
        >
          <span className={nextLang === "en" ? "fi fi-gb" : "fi fi-fi"}></span>
        </button>
        <button
          type="button"
          className="header-menu-btn"
          aria-label={menuOpen ? t("closeMenu") : t("menu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            <X size={22} strokeWidth={2.3} />
          ) : (
            <Menu size={22} strokeWidth={2.3} />
          )}
        </button>
      </div>

      <div
        className="header-menu-backdrop"
        role="presentation"
        onClick={() => setMenuOpen(false)}
      />
      <div
        className="header-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t("menu")}
        aria-hidden={menuOpen ? undefined : true}
      >
        <div className="header-menu-top">
          <span className="header-menu-brand">Liikux</span>
          <button
            type="button"
            className="header-menu-close"
            aria-label={t("closeMenu")}
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} strokeWidth={2.3} />
          </button>
        </div>
        <div className="header-menu-area">
          <p className="header-menu-area-label">{t("location")}</p>
          <AreaSelect />
        </div>
        <nav className="header-menu-nav" aria-label={t("menu")}>
          <Link
            to={homePath}
            className={
              homeOn ? "header-menu-link is-on" : "header-menu-link"
            }
            onClick={(e) => {
              stayIfSame(e, homePath);
              setMenuOpen(false);
            }}
          >
            <Home size={18} strokeWidth={2.2} />
            <span>{t("home")}</span>
          </Link>
          <Link
            to={gymsPath}
            className={
              gymsOn ? "header-menu-link is-on" : "header-menu-link"
            }
            onClick={(e) => {
              stayIfSame(e, gymsPath);
              setMenuOpen(false);
            }}
          >
            <Dumbbell size={18} strokeWidth={2.2} />
            <span>{t("navBrowse")}</span>
          </Link>
          <button
            type="button"
            className="header-menu-link"
            onClick={() => {
              setMenuOpen(false);
              openChains();
            }}
          >
            <Store size={18} strokeWidth={2.2} />
            <span>{t("chains")}</span>
          </button>
          <button
            type="button"
            className="header-menu-link header-menu-lang"
            onClick={goLang}
          >
            <span
              className={
                (nextLang === "en" ? "fi fi-gb" : "fi fi-fi") +
                " header-menu-flag"
              }
            />
            <span>
              {nextLang === "en" ? t("switchToEn") : t("switchToFi")}
            </span>
          </button>
        </nav>
      </div>

      <FavoritesPopup
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
      />
    </header>
  );
}

export default Header;
