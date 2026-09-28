import { Outlet } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import { LocationProvider } from "../context/LocationContext";

function AppLayout() {
  return (
    <LocationProvider>
      <ScrollToTop />
      <div className="layout">
        <Header />
        <div className="layout-content">
          <Outlet />
        </div>
        <Footer />
      </div>
    </LocationProvider>
  );
}

export default AppLayout;
