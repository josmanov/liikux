import { Link } from "react-router-dom"

import "./Header.css"

function Header () {
    return (
        <header className="header">
					<div className="header-left">
						<Link to="/" className="header-logo">Liikux</Link>
						<input className="header-area" placeholder="Alue" />
					</div>
					<div className="header-right">
						<Link to="/gyms">Selaa</Link>
						<button type="button" className="header-lang" aria-label="Kieli">🇫🇮</button>
						<Link to="/login">Kirjaudu</Link>
					</div>
        </header>
    )
}

export default Header;