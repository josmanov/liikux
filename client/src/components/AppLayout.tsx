import { Outlet } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import CookieBanner from "./CookieBanner";
import { LocationProvider } from "../context/LocationContext";
import { ChainPopupProvider } from "../context/ChainPopupContext";
import ChainPopup from "./ChainPopup";

function AppLayout() {
  return (
    <LocationProvider>
      <ChainPopupProvider>
        <ScrollToTop />
        <div className="layout">
          <Header />
          <div className="layout-content">
            <Outlet />
          </div>
          <Footer />
        </div>
        <ChainPopup />
        <CookieBanner />
      </ChainPopupProvider>
    </LocationProvider>
  );
}

export default AppLayout;
