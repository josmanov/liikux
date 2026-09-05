import { Outlet } from "react-router-dom";
import "./AppLayout.css";
import Header from "./Header";

function AppLayout() {
  return (
    <div className="layout">
      <Header />
      <Outlet />
    </div>
  );
}

export default AppLayout;
