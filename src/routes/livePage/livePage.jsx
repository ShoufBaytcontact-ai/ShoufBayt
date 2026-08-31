import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import apiRequest from "../../lib/apiRequest";
import "./livePage.scss";

const emptyStats = {
  onlineNow: 0,
  liveListings: 0,
  sold: 0,
  rented: 0,
  forSale: 0,
  forRent: 0,
  agents: 0,
  members: 0,
  cities: 0,
  closed: 0,
  monthly: [],
  topCities: [],
  updatedAt: "",
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function LivePage() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async (silent = false) => {
      try {
        if (!silent) {
          setError("");
        }

        const res = await apiRequest.get("/public/stats");
        if (!cancelled) {
          setStats({ ...emptyStats, ...(res.data || {}) });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || t("live.errors.load"));
          setLoading(false);
        }
      }
    };

    load();
    const timer = window.setInterval(() => load(true), 20000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [t]);

  const maxMonthly = useMemo(
    () =>
      Math.max(1, ...((stats.monthly || []).map((item) => item.listings || 0))),
    [stats.monthly]
  );

  const updatedLabel = useMemo(() => {
    if (!stats.updatedAt) {
      return t("live.updated.live");
    }

    return new Date(stats.updatedAt).toLocaleTimeString(
      i18n.language === "ar" ? "ar-LB" : "en-US",
      { hour: "2-digit", minute: "2-digit" }
    );
  }, [stats.updatedAt, i18n.language, t]);

  const cards = [
    {
      key: "liveListings",
      value: stats.liveListings,
      label: t("live.cards.liveListings"),
    },
    {
      key: "closed",
      value: stats.closed,
      label: t("live.cards.closed"),
    },
    {
      key: "agents",
      value: stats.agents,
      label: t("live.cards.agents"),
    },
    {
      key: "members",
      value: stats.members,
      label: t("live.cards.members"),
    },
    {
      key: "cities",
      value: stats.cities,
      label: t("live.cards.cities"),
    },
    {
      key: "onlineNow",
      value: stats.onlineNow,
      label: t("live.cards.onlineNow"),
    },
  ];

  const splitTotal = Math.max(1, stats.forSale + stats.forRent);

  return (
    <main className="livePage pageFade">
      <header className="liveHero">
        <div>
          <p className="liveEyebrow">{t("live.hero.badge")}</p>
          <h1>{t("live.hero.title")}</h1>
          <span>{t("live.hero.description")}</span>
        </div>

        <div className="liveHeroMeta">
          <p className="livePulse">
            <i />
            {t("live.updated.now", { time: updatedLabel })}
          </p>
          <Link to="/list" className="livePrimary">
            {t("live.hero.browse")}
          </Link>
        </div>
      </header>

      {error && <div className="liveAlert">{error}</div>}

      <section className="liveGrid">
        {cards.map((card) => (
          <article key={card.key} className="liveCard">
            <span>{card.label}</span>
            <strong>{loading ? "—" : formatNumber(card.value)}</strong>
          </article>
        ))}
      </section>

      <section className="liveSplit">
        <article className="livePanel">
          <div className="livePanelHead">
            <p className="liveEyebrow">{t("live.mix.badge")}</p>
            <h2>{t("live.mix.title")}</h2>
          </div>

          <div className="liveMix">
            <div>
              <span>{t("live.mix.sale")}</span>
              <b>{formatNumber(stats.forSale)}</b>
              <em style={{ width: `${(stats.forSale / splitTotal) * 100}%` }} />
            </div>
            <div>
              <span>{t("live.mix.rent")}</span>
              <b>{formatNumber(stats.forRent)}</b>
              <em style={{ width: `${(stats.forRent / splitTotal) * 100}%` }} />
            </div>
            <div>
              <span>{t("live.mix.sold")}</span>
              <b>{formatNumber(stats.sold)}</b>
            </div>
            <div>
              <span>{t("live.mix.rented")}</span>
              <b>{formatNumber(stats.rented)}</b>
            </div>
          </div>
        </article>

        <article className="livePanel">
          <div className="livePanelHead">
            <p className="liveEyebrow">{t("live.cities.badge")}</p>
            <h2>{t("live.cities.title")}</h2>
          </div>

          {stats.topCities?.length ? (
            <ol className="liveCities">
              {stats.topCities.map((item, index) => (
                <li key={item.city}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{item.city}</b>
                  <em>{formatNumber(item.count)}</em>
                </li>
              ))}
            </ol>
          ) : (
            <p className="liveEmpty">{t("live.cities.empty")}</p>
          )}
        </article>
      </section>

      <section className="livePanel liveChart">
        <div className="livePanelHead">
          <p className="liveEyebrow">{t("live.chart.badge")}</p>
          <h2>{t("live.chart.title")}</h2>
          <p>{t("live.chart.description")}</p>
        </div>

        <div className="liveBars">
          {(stats.monthly || []).map((item) => {
            const height = Math.max(
              6,
              Math.round(((item.listings || 0) / maxMonthly) * 100)
            );
            const label = new Date(item.year, item.month, 1).toLocaleString(
              i18n.language === "ar" ? "ar-LB" : "en-US",
              { month: "short" }
            );

            return (
              <div key={item.key}>
                <b>{item.listings || 0}</b>
                <span style={{ height: `${height}%` }} />
                <small>{label}</small>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default LivePage;
