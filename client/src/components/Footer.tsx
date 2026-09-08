import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to="/" className="footer-brand">
          <img src="/liikux-logo-light.png?v=white" alt="Liikux" />
        </Link>

        <nav className="footer-nav">
          <Link to="/gyms">Kuntosalit</Link>
          <Link to="/harjoitukset">Harrastukset</Link>
          <Link to="/login">Kirjaudu</Link>
        </nav>

        <p className="footer-copy">© {new Date().getFullYear()} Liikux</p>
      </div>
    </footer>
  );
}

export default Footer;
