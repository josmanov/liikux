import { Link } from "react-router-dom";
import { LayoutGrid, Dumbbell, PersonStanding } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";
import "./Header.css";

function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">
          Liikux
        </Link>
        <input className="header-area" placeholder="Alue" />
      </div>

      <nav className="header-center">
        <Link to="/">
          <LayoutGrid size={18} stroke="#fff" />
          Kaikki
        </Link>
        <Link to="/gyms">
          <Dumbbell size={18} stroke="#fff" />
          Kuntosalit
        </Link>
        <Link to="/harjoitukset">
          <PersonStanding size={18} stroke="#fff" />
          Harjoitukset
        </Link>
      </nav>

      <div className="header-right">
        <Link to="/gyms">Selaa</Link>
        <button type="button" className="header-lang" aria-label="Suomi">
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
