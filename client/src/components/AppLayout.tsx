import { Outlet } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";
import Footer from "./Footer";

function AppLayout() {
  return (
    <div className="layout">
      <Header />
      <div className="layout-content">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

export default AppLayout;
