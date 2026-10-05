import { Link } from "react-router-dom";
import { openCookieSettings } from "../data/cookieConsent";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to="/" className="footer-brand">
          <img src="/liikux-logo-light.png?v=white" alt="Liikux" />
        </Link>
        <nav className="footer-nav" aria-label="Alatunniste">
          <button
            type="button"
            className="footer-nav-btn"
            onClick={() => openCookieSettings()}
          >
            Evästeasetukset
          </button>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Liikux</p>
      </div>
    </footer>
  );
}

export default Footer;
