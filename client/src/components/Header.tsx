import { Link } from "react-router-dom";
import AreaSelect from "./AreaSelect";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">
          <img src="/liikux-logo-light.png?v=white" alt="Liikux" />
        </Link>
        <AreaSelect />
      </div>

      <div className="header-right">
        <Link to="/fi/kuntosalit" className="playstore-button is-plain">
          <span className="texts">
            <span className="text-2">Selaa kuntosaleja</span>
          </span>
        </Link>
        <button
          type="button"
          className="playstore-button is-plain header-lang"
          aria-label="Suomi"
        >
          <span className="fi fi-fi"></span>
        </button>
        <Link to="/login" className="header-login">
          Kirjaudu
        </Link>
      </div>
    </header>
  );
}

export default Header;
