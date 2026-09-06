import { Outlet } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";

function AppLayout() {
  return (
    <div className="layout">
      <div className="layout-content">
        <Header />
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
