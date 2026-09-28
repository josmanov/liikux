import { useState } from "react";
import { Link } from "react-router-dom";
import AreaSelect from "./AreaSelect";
import FavoritesPopup from "./FavoritesPopup";
import HeaderSearch from "./HeaderSearch";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">
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
            <span className="text-2">Suosikit</span>
          </span>
        </button>
        <button
          type="button"
          className="header-lang playstore-button is-plain"
          aria-label="Suomi"
        >
          <span className="fi fi-fi"></span>
        </button>
        <Link to="/fi/kuntosalit" className="header-cta">
          Selaa kuntosaleja
        </Link>
      </div>

      <FavoritesPopup
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
      />
    </header>
  );
}

export default Header;
