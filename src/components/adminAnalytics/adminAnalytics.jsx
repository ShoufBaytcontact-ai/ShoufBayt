import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./adminAnalytics.scss";

const PROPERTY_TYPES = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "VILLA",
  "OFFICE",
  "SHOP",
  "WAREHOUSE",
];

function listingKind(post) {
  const value = String(post?.listingType || post?.type || "").toUpperCase();
  if (value === "BUY") return "SALE";
  return value;
}

function propertyKind(post) {
  return String(post?.propertyType || post?.property || "").toUpperCase();
}

function countFromLists(items, predicate) {
  return items.filter(predicate).length;
}

function AdminAnalytics({
  users = [],
  posts = [],
  agents = [],
  contactMessages = [],
  stats = {},
}) {
  const { t, i18n } = useTranslation();

  const analytics = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    const safePosts = Array.isArray(posts) ? posts : [];
    const safeAgents = Array.isArray(agents) ? agents : [];
    const safeMessages = Array.isArray(contactMessages)
      ? contactMessages
      : [];
    const typeCounts = stats?.propertyTypeCounts || {};

    const usersByRole = [
      {
        label: t("adminAnalytics.roles.admins"),
        value: countFromLists(safeUsers, (user) => user.role === "ADMIN"),
      },
      {
        label: t("adminAnalytics.roles.agents"),
        value: countFromLists(safeUsers, (user) => user.role === "AGENT"),
      },
      {
        label: t("adminAnalytics.roles.users"),
        value: countFromLists(safeUsers, (user) => user.role === "USER"),
      },
    ];

    const postsByType = [
      {
        label: t("adminAnalytics.values.buy"),
        value: Number(
          stats?.saleListingsCount ??
            countFromLists(safePosts, (post) => listingKind(post) === "SALE")
        ),
      },
      {
        label: t("adminAnalytics.values.rent"),
        value: Number(
          stats?.rentListingsCount ??
            countFromLists(safePosts, (post) => listingKind(post) === "RENT")
        ),
      },
    ];

    const postsByProperty = PROPERTY_TYPES.map((type) => ({
      key: type,
      label: t(`adminAnalytics.values.${type.toLowerCase()}`),
      value: Number(
        typeCounts[type] ??
          countFromLists(safePosts, (post) => propertyKind(post) === type)
      ),
    })).filter(
      (item) =>
        item.value > 0 ||
        item.key === "APARTMENT" ||
        item.key === "HOUSE" ||
        item.key === "LAND"
    );

    const messagesByStatus = [
      {
        label: t("adminAnalytics.status.open"),
        value: countFromLists(safeMessages, (item) => item.status === "OPEN"),
      },
      {
        label: t("adminAnalytics.status.read"),
        value: countFromLists(safeMessages, (item) => item.status === "READ"),
      },
      {
        label: t("adminAnalytics.status.resolved"),
        value: countFromLists(
          safeMessages,
          (item) => item.status === "RESOLVED"
        ),
      },
    ];

    const cityCounts = safePosts.reduce((acc, post) => {
      const city = post.city || t("adminAnalytics.fallback.unknown");
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    const topCities = Object.entries(cityCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const prices = safePosts
      .map((post) => Number(post.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    const totalPrice = prices.reduce((sum, price) => sum + price, 0);
    const averagePrice = prices.length > 0 ? totalPrice / prices.length : 0;
    const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const reportsCount = Number(
      stats?.reportsCount ??
        stats?.contactReportsCount ??
        countFromLists(safeMessages, (item) => item.type === "REPORT")
    );

    const openReportsCount = Number(
      stats?.pendingReportsCount ??
        stats?.openReportsCount ??
        countFromLists(
          safeMessages,
          (item) => item.type === "REPORT" && item.status === "OPEN"
        )
    );

    const verifiedAgentsCount = Number(
      stats?.verifiedAgentsCount ??
        countFromLists(safeAgents, (agent) => Boolean(agent.isVerified))
    );

    const monthlyActivity = buildMonthlyActivity(
      safeUsers,
      safePosts,
      i18n.language
    );

    return {
      usersByRole,
      postsByType,
      postsByProperty,
      messagesByStatus,
      topCities,
      averagePrice,
      highestPrice,
      reportsCount,
      openReportsCount,
      verifiedAgentsCount,
      monthlyActivity,
    };
  }, [users, posts, agents, contactMessages, stats, t, i18n.language]);

  return (
    <section className="adminAnalytics">
      <div className="analyticsHeader">
        <div>
          <span>{t("adminAnalytics.header.badge")}</span>
          <h2>{t("adminAnalytics.header.title")}</h2>
          <p>{t("adminAnalytics.header.description")}</p>
        </div>
      </div>

      <div className="analyticsMiniGrid">
        <MiniMetric
          label={t("adminAnalytics.metrics.averagePrice")}
          value={formatMoney(analytics.averagePrice)}
        />

        <MiniMetric
          label={t("adminAnalytics.metrics.highestPrice")}
          value={formatMoney(analytics.highestPrice)}
        />

        <MiniMetric
          label={t("adminAnalytics.metrics.verifiedAgents")}
          value={analytics.verifiedAgentsCount}
        />

        <MiniMetric
          label={t("adminAnalytics.metrics.openReports")}
          value={analytics.openReportsCount}
          danger={analytics.openReportsCount > 0}
        />
      </div>

      <div className="analyticsGrid">
        <AnalyticsCard
          title={t("adminAnalytics.cards.usersByRole")}
          data={analytics.usersByRole}
        />

        <AnalyticsCard
          title={t("adminAnalytics.cards.postsByType")}
          data={analytics.postsByType}
        />

        <AnalyticsCard
          title={t("adminAnalytics.cards.propertiesByCategory")}
          data={analytics.postsByProperty}
        />

        <AnalyticsCard
          title={t("adminAnalytics.cards.messagesByStatus")}
          data={analytics.messagesByStatus}
        />
      </div>

      <div className="analyticsBottomGrid">
        <div className="analyticsPanel">
          <div className="panelHeader">
            <span>{t("adminAnalytics.locations.badge")}</span>
            <h3>{t("adminAnalytics.locations.title")}</h3>
          </div>

          {analytics.topCities.length > 0 ? (
            <div className="cityList">
              {analytics.topCities.map((city, index) => (
                <div className="cityItem" key={city.label}>
                  <b>{index + 1}</b>

                  <div>
                    <span>{city.label}</span>
                    <small>
                      {t("adminAnalytics.locations.listings", {
                        count: city.value,
                      })}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="analyticsEmpty">
              {t("adminAnalytics.locations.empty")}
            </div>
          )}
        </div>

        <div className="analyticsPanel">
          <div className="panelHeader">
            <span>{t("adminAnalytics.growth.badge")}</span>
            <h3>{t("adminAnalytics.growth.title")}</h3>
          </div>

          <div className="monthlyChart">
            {analytics.monthlyActivity.map((item) => (
              <div className="monthColumn" key={item.label}>
                <div className="monthBars">
                  <span
                    className="usersBar"
                    style={{
                      height: `${item.userPercent}%`,
                    }}
                  ></span>

                  <span
                    className="postsBar"
                    style={{
                      height: `${item.postPercent}%`,
                    }}
                  ></span>
                </div>

                <small>{item.label}</small>
              </div>
            ))}
          </div>

          <div className="chartLegend">
            <span>
              <b className="userDot"></b>
              {t("adminAnalytics.growth.users")}
            </span>

            <span>
              <b className="postDot"></b>
              {t("adminAnalytics.growth.posts")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value, danger }) {
  return (
    <div className={danger ? "miniMetric dangerMetric" : "miniMetric"}>
      <span>{label}</span>
      <h3>{value}</h3>
    </div>
  );
}

function AnalyticsCard({ title, data }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="analyticsCard">
      <div className="cardTop">
        <h3>{title}</h3>
        <span>{total}</span>
      </div>

      <div className="barList">
        {data.map((item) => {
          const percent = (item.value / maxValue) * 100;

          return (
            <div className="barItem" key={item.label}>
              <div className="barInfo">
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>

              <div className="barTrack">
                <div
                  className="barFill"
                  style={{
                    width: `${percent}%`,
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildMonthlyActivity(users, posts, language) {
  const months = [];

  const now = new Date();
  const locale = language === "ar" ? "ar-LB" : "en-US";

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

    const label = date.toLocaleDateString(locale, {
      month: "short",
    });

    const month = date.getMonth();
    const year = date.getFullYear();

    const userCount = users.filter((user) => {
      if (!user.createdAt) return false;

      const createdAt = new Date(user.createdAt);

      return createdAt.getMonth() === month && createdAt.getFullYear() === year;
    }).length;

    const postCount = posts.filter((post) => {
      if (!post.createdAt) return false;

      const createdAt = new Date(post.createdAt);

      return createdAt.getMonth() === month && createdAt.getFullYear() === year;
    }).length;

    months.push({
      label,
      userCount,
      postCount,
    });
  }

  const maxUsers = Math.max(...months.map((item) => item.userCount), 1);
  const maxPosts = Math.max(...months.map((item) => item.postCount), 1);

  return months.map((item) => ({
    ...item,
    userPercent:
      item.userCount > 0 ? (item.userCount / maxUsers) * 100 : 0,
    postPercent:
      item.postCount > 0 ? (item.postCount / maxPosts) * 100 : 0,
  }));
}

function formatMoney(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return "$0";
  }

  return `$${Math.round(numberValue).toLocaleString()}`;
}

export default AdminAnalytics;