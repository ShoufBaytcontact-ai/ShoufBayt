import { Link, useLocation } from "react-router-dom";
import { useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { useNotificationStore } from "../../lib/notificationStore";
import HouseMark from "../houseMark/houseMark";
import NotificationBell from "../notificationBell/notificationBell";
import "./navbar.scss";

function Navbar() {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      if (!localStorage.getItem("se_light_default")) {
        localStorage.setItem("se_light_default", "1");
        localStorage.setItem("theme", "light");
        localStorage.setItem("darkMode", "false");
        return "light";
      }

      return localStorage.getItem("theme") || "light";
    } catch {
      return "light";
    }
  });

  const { currentUser } = useContext(AuthContext);

  const notificationNumber = useNotificationStore((state) => state.number);
  const messageNumber = useNotificationStore((state) => state.messages);
  const fetchNotifications = useNotificationStore((state) => state.fetch);
  const resetNotification = useNotificationStore((state) => state.reset);

  const isAdmin = currentUser?.role?.toUpperCase() === "ADMIN";
  const isAgent = currentUser?.role?.toUpperCase() === "AGENT";
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];

  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  const getAvatarUrl = (avatar) => {
    if (!avatar || typeof avatar !== "string") {
      return "/no-avatar.png";
    }

    if (avatar.startsWith("http") || avatar.startsWith("data:")) {
      return avatar;
    }

    return `${SERVER_URL}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
  };

  const navLinks = useMemo(() => {
    const links = [
      { labelKey: "nav.properties", path: "/list" },
      { labelKey: "nav.agents", path: "/agents" },
      { labelKey: "nav.live", path: "/live" },
    ];

    if (currentUser) {
      links.push({ labelKey: "nav.myHomes", path: "/my-homes" });
      links.push({ labelKey: "nav.saved", path: "/saved" });

      if (!isAgent && !isAdmin) {
        links.push({ labelKey: "nav.offers", path: "/offers" });
      }
    }

    if (isAgent) {
      links.push({
        labelKey: "nav.agentDashboard",
        path: "/agent",
        admin: false,
      });
    }

    if (isAdmin) {
      links.push({ labelKey: "nav.dashboard", path: "/admin", admin: true });
    }

    return links;
  }, [currentUser, isAdmin, isAgent]);

  useEffect(() => {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
    localStorage.setItem("shoufbayt_language", currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (currentUser?.id) {
      Promise.resolve(fetchNotifications()).catch(() => {});
    } else {
      resetNotification();
    }
  }, [currentUser?.id, fetchNotifications, resetNotification]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLanguageChange = async () => {
    const newLanguage = currentLanguage === "ar" ? "en" : "ar";

    await i18n.changeLanguage(newLanguage);

    document.documentElement.lang = newLanguage;
    document.documentElement.dir = newLanguage === "ar" ? "rtl" : "ltr";
    localStorage.setItem("shoufbayt_language", newLanguage);

    closeMenu();
  };

  const isActivePath = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(path);
  };

  const linkClassName = (link, mobile = false) => {
    const base = mobile ? "mobileLink" : "navLink";
    const active = isActivePath(link.path) ? " active" : "";
    const admin = link.admin ? " adminNav" : "";

    return `${base}${active}${admin}`;
  };

  return (
    <>
    <nav className={scrolled ? "navbar scrolled" : "navbar"}>
      <div className="navWrapper">
        <Link to="/" className="brand" onClick={closeMenu}>
          <HouseMark size="nav" />

          <div className="brandText">
            <div className="brandName">
              <span className="brandTitle">ShoufBayt</span>
              <span className="betaBadge">{t("nav.beta")}</span>
            </div>
            <small>{t("nav.brandSubtitle")}</small>
          </div>
        </Link>

        <div className="navLinks">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={closeMenu}
              className={linkClassName(link)}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>

        <div className="navActions">
          <nav className="navMeta" aria-label={t("nav.about")}>
            <Link
              to="/about"
              className={isActivePath("/about") ? "navMetaLink active" : "navMetaLink"}
              onClick={closeMenu}
            >
              {t("nav.about")}
            </Link>
            <Link
              to="/contact"
              className={isActivePath("/contact") ? "navMetaLink active" : "navMetaLink"}
              onClick={closeMenu}
            >
              {t("nav.contact")}
            </Link>
          </nav>

          <button
            type="button"
            className={theme === "dark" ? "themeToggle active" : "themeToggle"}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span>{theme === "dark" ? "🌙" : "☀️"}</span>
          </button>

          <button
            type="button"
            className={
              currentLanguage === "ar"
                ? "languageToggle active"
                : "languageToggle"
            }
            onClick={handleLanguageChange}
            aria-label="Change language"
          >
            {currentLanguage === "ar" ? "EN" : "AR"}
          </button>

          {currentUser ? (
            <div className="userArea">
              <NotificationBell />

              <Link to="/chat" className="messageButton" onClick={closeMenu}>
                {t("nav.messages")}

                {messageNumber > 0 && (
                  <span className="notificationBadge">
                    {messageNumber > 9 ? "9+" : messageNumber}
                  </span>
                )}
              </Link>

              <Link to="/profile" className="profileButton" onClick={closeMenu}>
                <img
                  src={getAvatarUrl(currentUser.avatar)}
                  alt="User"
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />

                <div>
                  <span>{currentUser.username || t("nav.openProfile")}</span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="authButtons">
              <Link to="/login" className="loginButton" onClick={closeMenu}>
                {t("nav.login")}
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
    </nav>
    {typeof document !== "undefined" &&
      createPortal(
        <>
          <div className={open ? "mobileMenu active" : "mobileMenu"}>
            <div className="mobileMenuTop">
              <div>
                <span>{t("nav.navigation")}</span>
                <h3>{t("nav.menuTitle")}</h3>
              </div>
            </div>

            <div className="mobileLinks">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeMenu}
                  className={linkClassName(link, true)}
                >
                  {t(link.labelKey)}
                </Link>
              ))}
              <Link
                to="/about"
                onClick={closeMenu}
                className={linkClassName({ path: "/about" }, true)}
              >
                {t("nav.about")}
              </Link>
              <Link
                to="/contact"
                onClick={closeMenu}
                className={linkClassName({ path: "/contact" }, true)}
              >
                {t("nav.contact")}
              </Link>
            </div>

            <div className="mobileDivider"></div>

            <button
              type="button"
              className={theme === "dark" ? "mobileTheme active" : "mobileTheme"}
              onClick={toggleTheme}
            >
              <span>{theme === "dark" ? "🌙" : "☀️"}</span>
              {theme === "dark" ? t("nav.darkMode") : t("nav.lightMode")}
            </button>

            <button
              type="button"
              className={
                currentLanguage === "ar"
                  ? "mobileLanguage active"
                  : "mobileLanguage"
              }
              onClick={handleLanguageChange}
            >
              <span>🌐</span>
              {currentLanguage === "ar" ? "English" : "العربية"}
            </button>

            {currentUser ? (
              <div className="mobileUserBox">
                <Link
                  to="/notifications"
                  className="mobileMessageButton"
                  onClick={closeMenu}
                >
                  {t("nav.alerts", { defaultValue: "Alerts" })}

                  {notificationNumber > 0 && (
                    <span>
                      {notificationNumber > 9 ? "9+" : notificationNumber}
                    </span>
                  )}
                </Link>

                <Link
                  to="/chat"
                  className="mobileMessageButton"
                  onClick={closeMenu}
                >
                  {t("nav.messages")}

                  {messageNumber > 0 && (
                    <span>{messageNumber > 9 ? "9+" : messageNumber}</span>
                  )}
                </Link>

                <Link
                  to="/profile"
                  className="mobileProfileButton"
                  onClick={closeMenu}
                >
                  <img
                    src={getAvatarUrl(currentUser.avatar)}
                    alt="User"
                    onError={(e) => {
                      e.currentTarget.src = "/no-avatar.png";
                    }}
                  />

                  <div>
                    <b>{currentUser.username || t("nav.openProfile")}</b>
                    <small>{t("nav.openProfile")}</small>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="mobileAuth">
                <Link to="/login" className="loginButton" onClick={closeMenu}>
                  {t("nav.login")}
                </Link>
              </div>
            )}
          </div>
          {open ? <div className="menuBackdrop" onClick={closeMenu} /> : null}
        </>,
        document.body
      )}
    </>
  );
}

export default Navbar;