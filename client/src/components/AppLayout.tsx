import { Outlet } from "react-router-dom";
import "./AppLayout.css";

function AppLayout() {
  return (
    <div className="layout">
      <p className="layout-note">Menoksi</p>
      <Outlet />
    </div>
  );
}

export default AppLayout;
