import { useEffect, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dumbbell, Heart, Home, Menu, MessageSquarePlus, Store, TriangleAlert, X } from "lucide-react";
import AreaSelect from "./AreaSelect";
import HeaderSearch from "./HeaderSearch";
import HeaderFeedbackLinks from "./HeaderFeedbackLinks";
import { readFavoriteSlugs } from "../data/favorites";
import { useAppLocation } from "../context/LocationContext";
import { pathChains, pathFavorites, pathFeedback, pathGyms, pathGymsFromLocation, pathHome, switchLangPath } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, t } = useLang();
  const location = useLocation();
  const { label: locationLabel } = useAppLocation();
  const chainsPath = pathChains(lang);
  const chainsOn = location.pathname === chainsPath;
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
  const favPath = pathFavorites(lang);
  const favPageOn = location.pathname === favPath;
  const favOn = favHover || favKept || favPageOn;

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
            src="/brand/logo-white.png?v=1"
            alt="Liikux"
            width={120}
            height={38}
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
          <Link to={chainsPath} className={chainsOn ? "header-nav-link is-on" : "header-nav-link"}>
            <Store size={16} strokeWidth={2.2} />
            {t("chains")}
          </Link>
        </nav>
      </div>

      <Link
        to={favPath}
        className={
          "header-nav-link header-fav" +
          (favShown > 0 ? " is-typing" : "") +
          (favHover ? " is-full" : "") +
          (favCount > 0 ? " has-count" : "")
        }
        aria-label={favCount > 0 ? `${favWord}, ${favCount}` : favWord}
        onMouseEnter={() => setFavHover(true)}
        onMouseLeave={() => setFavHover(false)}
      >
        <span className="header-fav-icon">
          <Heart size={20} strokeWidth={2.4} />
          {favCount > 0 ? (
            <span className="header-fav-count">{favCount}</span>
          ) : null}
        </span>
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
      </Link>

      <div className="header-right">
        <HeaderFeedbackLinks />
        {/* the home page has its own big search in the hero */}
        {homeOn ? null : <HeaderSearch />}
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
          <Link
            to={chainsPath}
            className={chainsOn ? "header-menu-link is-on" : "header-menu-link"}
            onClick={() => setMenuOpen(false)}
          >
            <Store size={18} strokeWidth={2.2} />
            <span>{t("chains")}</span>
          </Link>
          <Link
            to={pathFeedback(lang, "suggest")}
            className="header-menu-link"
            onClick={() => setMenuOpen(false)}
          >
            <MessageSquarePlus size={18} strokeWidth={2.2} />
            <span>{t("headerMissingGym")}</span>
          </Link>
          <Link
            to={pathFeedback(lang, "error")}
            className="header-menu-link"
            onClick={() => setMenuOpen(false)}
          >
            <TriangleAlert size={18} strokeWidth={2.2} />
            <span>{t("reportError")}</span>
          </Link>
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

    </header>
  );
}

export default Header;
