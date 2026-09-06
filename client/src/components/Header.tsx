import { Link } from "react-router-dom"

import "./Header.css"

function Header () {
    return (
        <header className="header">
					<div className="header-left">
						<Link to="/" className="header-logo">Liikux</Link>
						<input className="header-area" placeholder="Alue" />
					</div>
						<Link to="/gyms">Selaa</Link>
						<button type="button" aria-labe="Kieli">🇫🇮</button>
						<Link to="/login">Kirjaudu</Link>
        </header>
    )
}

export default Header;