import { Link, useLocation } from "react-router-dom";
import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import { useNotificationStore } from "../../lib/notificationStore";
import "./navbar.scss";

function Navbar() {
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const notificationNumber = useNotificationStore((state) => state.number);
  const fetchNotifications = useNotificationStore((state) => state.fetch);
  const increaseNotification = useNotificationStore((state) => state.increase);
  const resetNotification = useNotificationStore((state) => state.reset);

  const isAdmin = currentUser?.role?.toUpperCase() === "ADMIN";

  const navLinks = useMemo(() => {
    const links = [
      { label: "Home", path: "/" },
      { label: "Properties", path: "/list" },
      { label: "Agents", path: "/agents" },
      { label: "About", path: "/about" },
      { label: "Support", path: "/contact" },
    ];

    if (isAdmin) {
      links.push({ label: "Dashboard", path: "/admin", admin: true });
    }

    return links;
  }, [isAdmin]);

  useEffect(() => {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchNotifications();
    } else {
      resetNotification();
    }
  }, [currentUser?.id, fetchNotifications, resetNotification]);

  useEffect(() => {
    const handleNotification = () => {
      increaseNotification();
    };

    socket?.on("getNotification", handleNotification);

    return () => {
      socket?.off("getNotification", handleNotification);
    };
  }, [socket, increaseNotification]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const closeMenu = () => {
    setOpen(false);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleMessagesClick = () => {
    resetNotification();
    closeMenu();
  };

  const isActivePath = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(path);
  };

  return (
    <nav className={scrolled ? "navbar scrolled" : "navbar"}>
      <div className="navWrapper">
        <Link to="/" className="brand" onClick={closeMenu}>
          <div className="brandIcon">
            <span className="roof"></span>
            <span className="tower"></span>
            <span className="door"></span>
          </div>

          <div className="brandText">
            <span>SmartEstate</span>
            <small>Real Estate Platform</small>
          </div>
        </Link>

        <div className="navLinks">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={closeMenu}
              className={
                isActivePath(link.path)
                  ? link.admin
                    ? "navLink adminNav active"
                    : "navLink active"
                  : link.admin
                  ? "navLink adminNav"
                  : "navLink"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="navActions">
          <button
            type="button"
            className={theme === "dark" ? "themeToggle active" : "themeToggle"}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span>{theme === "dark" ? "🌙" : "☀️"}</span>
          </button>

          {currentUser ? (
            <div className="userArea">
              <Link
                to="/chat"
                className="messageButton"
                onClick={handleMessagesClick}
              >
                Messages

                {notificationNumber > 0 && (
                  <span className="notificationBadge">
                    {notificationNumber > 9 ? "9+" : notificationNumber}
                  </span>
                )}
              </Link>

              <Link to="/profile" className="profileButton" onClick={closeMenu}>
                <img
                  src={currentUser.avatar || "/no-avatar.png"}
                  alt="User"
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />

                <div>
                  <span>{currentUser.username || "User"}</span>
                  <small>{currentUser.role || "USER"}</small>
                </div>
              </Link>
            </div>
          ) : (
            <div className="authButtons">
              <Link to="/login" className="loginButton">
                Login
              </Link>

              <Link to="/register" className="registerButton">
                Register
              </Link>
            </div>
          )}

          <button
            type="button"
            className={open ? "menuButton active" : "menuButton"}
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Open menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      <div className={open ? "mobileMenu active" : "mobileMenu"}>
        <div className="mobileMenuTop">
          <div>
            <span>Navigation</span>
            <h3>SmartEstate Menu</h3>
          </div>

          <button type="button" onClick={closeMenu}>
            ×
          </button>
        </div>

        <div className="mobileLinks">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={closeMenu}
              className={
                isActivePath(link.path)
                  ? link.admin
                    ? "mobileLink adminNav active"
                    : "mobileLink active"
                  : link.admin
                  ? "mobileLink adminNav"
                  : "mobileLink"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mobileDivider"></div>

        <button
          type="button"
          className={theme === "dark" ? "mobileTheme active" : "mobileTheme"}
          onClick={toggleTheme}
        >
          <span>{theme === "dark" ? "🌙" : "☀️"}</span>
          {theme === "dark" ? "Dark Mode" : "Light Mode"}
        </button>

        {currentUser ? (
          <div className="mobileUserBox">
            <Link
              to="/chat"
              className="mobileMessageButton"
              onClick={handleMessagesClick}
            >
              Messages

              {notificationNumber > 0 && (
                <span>{notificationNumber > 9 ? "9+" : notificationNumber}</span>
              )}
            </Link>

            <Link to="/profile" className="mobileProfileButton" onClick={closeMenu}>
              <img
                src={currentUser.avatar || "/no-avatar.png"}
                alt="User"
                onError={(e) => {
                  e.currentTarget.src = "/no-avatar.png";
                }}
              />

              <div>
                <b>{currentUser.username || "User"}</b>
                <small>Open Profile</small>
              </div>
            </Link>
          </div>
        ) : (
          <div className="mobileAuth">
            <Link to="/login" className="loginButton" onClick={closeMenu}>
              Login
            </Link>

            <Link to="/register" className="registerButton" onClick={closeMenu}>
              Register
            </Link>
          </div>
        )}
      </div>

      {open && <div className="menuBackdrop" onClick={closeMenu}></div>}
    </nav>
  );
}

export default Navbar;