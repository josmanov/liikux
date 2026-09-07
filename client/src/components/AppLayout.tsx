import { Outlet } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";

function AppLayout() {
  return (
    <div className="layout">
      <div className="layout-pattern" aria-hidden="true" />
      <Header />
      <div className="layout-content">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
