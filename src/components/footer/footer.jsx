import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HouseMark from "../houseMark/houseMark";
import "./footer.scss";

function Footer() {
  const year = new Date().getFullYear();
  const { t } = useTranslation();
  const { pathname } = useLocation();

  if (pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footerBar">
        <Link to="/" className="footerBrand" aria-label="ShoufBayt">
          <HouseMark size="mini" />
          <span>ShoufBayt</span>
        </Link>

        <nav className="footerNav" aria-label={t("footer.explore.title")}>
          <Link to="/list">{t("footer.explore.properties")}</Link>
          <Link to="/agents">{t("footer.explore.agents")}</Link>
          <Link to="/about">{t("footer.explore.about")}</Link>
          <Link to="/contact">{t("footer.explore.contact")}</Link>
        </nav>

        <p className="footerCopy">
          © {year} ShoufBayt
        </p>
      </div>
    </footer>
  );
}

export default Footer;
