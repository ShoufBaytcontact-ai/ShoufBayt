import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import HouseLoader from "../../components/houseLoader/houseLoader";
import "./investmentsPage.scss";

export function InvestmentLoader() {
  const { t } = useTranslation();
  const label = t("investments.loading");
  return (
    <div className="investLoader" role="status" aria-live="polite" aria-label={label}>
      <HouseLoader variant="inline" size="sm" jumping={false} label={label} />
      <span>{label}</span>
      <i />
    </div>
  );
}

function imageUrl(image) {
  if (!image) return "/no-image.png";
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `/${image}`;
}

function InvestmentsPage() {
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();
  const canAdd = role === "AGENT" || role === "ADMIN";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest
      .get("/investments")
      .then((res) => {
        if (!cancelled) setItems(res.data?.items || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || t("investments.errors.load"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <main className="investmentsPage pageFade">
      <header className="investHero">
        <h1>{t("investments.title")}</h1>
        {canAdd ? (
          <Link className="investAdd" to="/investments/new">
            {t("investments.add")}
          </Link>
        ) : null}
      </header>

      {loading ? <InvestmentLoader /> : null}
      {error ? <p className="investState isError">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <section className="investEmpty">
          <h2>{t("investments.emptyTitle")}</h2>
        </section>
      ) : null}

      {items.length > 0 ? (
        <section className="investGrid">
          {items.map((item) => (
            <Link key={item.id} to={`/investments/${item.id}`} className="investCard">
              <img src={imageUrl(item.images?.[0])} alt={item.title} />
              <div>
                <small>
                  {t(`investments.types.${item.type}`, { defaultValue: item.type })}
                  {item.city ? ` · ${item.city}` : ""}
                </small>
                <h2>{item.title}</h2>
                <strong>${Number(item.price || 0).toLocaleString()}</strong>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}

export default InvestmentsPage;
