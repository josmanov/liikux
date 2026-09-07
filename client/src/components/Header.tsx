import { Link } from "react-router-dom";
import { LayoutGrid, Dumbbell, PersonStanding } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";
import "./uiverse-playstore.css";
import "./Header.css";

function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">
          <img src="/liikux-logo.png" alt="Liikux" />
        </Link>
        <input className="header-area" placeholder="Alue" />
      </div>

      <nav className="header-center">
        <Link to="/" className="playstore-button">
          <LayoutGrid className="icon" size={24} />
          <span className="texts">
            <span className="text-2">Kaikki</span>
          </span>
        </Link>
        <Link to="/gyms" className="playstore-button">
          <Dumbbell className="icon" size={24} />
          <span className="texts">
            <span className="text-2">Kuntosalit</span>
          </span>
        </Link>
        <Link to="/harjoitukset" className="playstore-button">
          <PersonStanding className="icon" size={24} />
          <span className="texts">
            <span className="text-2">Harjoitukset</span>
          </span>
        </Link>
      </nav>

      <div className="header-right">
        <Link to="/gyms" className="playstore-button">
          <span className="texts">
            <span className="text-2">Selaa</span>
          </span>
        </Link>
        <button type="button" className="playstore-button header-lang" aria-label="Suomi">
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
