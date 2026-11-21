import { Outlet, useLocation } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import CookieBanner from "./CookieBanner";
import { LocationProvider } from "../context/LocationContext";
import { NavTracker } from "../nav/backNav";
import PreviewBanner from "./PreviewBanner";

function AppLayout() {
  const { pathname } = useLocation();
  const home = pathname === "/" || pathname === "/en";
  const browse = /\/(fi|en)\/(kuntosalit|gyms)(\/|$)/.test(pathname);

  return (
    <LocationProvider>
        <ScrollToTop />
        <NavTracker />
        <PreviewBanner />
        <div className={["layout", home ? "is-home" : "", browse ? "is-browse" : ""].filter(Boolean).join(" ")}>
          <Header />
          <div className="layout-content">
            <Outlet />
          </div>
          <Footer />
        </div>
        <CookieBanner />
    </LocationProvider>
  );
}

export default AppLayout;
