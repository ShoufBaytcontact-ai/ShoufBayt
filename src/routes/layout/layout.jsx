import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import "./layout.scss";
import Navbar from "../../components/navbar/Navbar";
import Footer from "../../components/footer/footer";
import { AuthContext } from "../../context/AuthContext.jsx";

function PageShell() {
  return (
    <div className="layout">
      <Navbar />

      <main className="content">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Layout() {
  return <PageShell />;
}

export function RequireAuth() {
  const { currentUser } = useContext(AuthContext);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <PageShell />;
}

export default Layout;