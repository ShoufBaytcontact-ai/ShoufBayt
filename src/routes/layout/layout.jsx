import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import "./layout.scss";
import Navbar from "../../components/navbar/Navbar";
import Footer from "../../components/footer/footer";
import { RouteLoader } from "../../components/houseLoader/houseLoader";
import { AuthContext } from "../../context/AuthContext.jsx";
import { needsPhoneVerification } from "../../lib/phoneGate";

function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <RouteLoader />

      <main className="content">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export function RequireAuth() {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (
    needsPhoneVerification(currentUser) &&
    location.pathname !== "/verify-phone"
  ) {
    return <Navigate to="/verify-phone" replace />;
  }

  return <Outlet />;
}

export default Layout;