import { Outlet, useLocation } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import CookieBanner from "./CookieBanner";
import { LocationProvider } from "../context/LocationContext";
import { ChainPopupProvider } from "../context/ChainPopupContext";
import ChainPopup from "./ChainPopup";

function AppLayout() {
  const { pathname } = useLocation();
  const home = pathname === "/" || pathname === "/en";
  const browse = /\/(fi|en)\/(kuntosalit|gyms)(\/|$)/.test(pathname);

  return (
    <LocationProvider>
      <ChainPopupProvider>
        <ScrollToTop />
        <div className={home ? "layout is-home" : "layout"}>
          <Header />
          <div className="layout-content">
            <Outlet />
          </div>
          {browse ? null : <Footer />}
        </div>
        <ChainPopup />
        <CookieBanner />
      </ChainPopupProvider>
    </LocationProvider>
  );
}

export default AppLayout;
