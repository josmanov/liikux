import { Link } from "react-router-dom"

import "./Header.css"

function Header () {
    return (
        <header className="header">
            <p className="header-logo">Menoksi</p>

            <nav className="header-nav">
                <Link className="header-link" to="/gyms">Haku</Link>
                <Link className="header-link" to="/favorites">Suosikit</Link>
                <Link className="header-link" to="/login">Kirjaudu</Link>
                <Link className="header-link" to="/register">Luo tili</Link>
            </nav>
        </header>
    )
}

export default Header;