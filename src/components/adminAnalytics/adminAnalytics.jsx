import { useMemo } from "react";
import "./adminAnalytics.scss";

function AdminAnalytics({
  users = [],
  posts = [],
  agents = [],
  contactMessages = [],
  stats = {},
}) {
  const analytics = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    const safePosts = Array.isArray(posts) ? posts : [];
    const safeMessages = Array.isArray(contactMessages)
      ? contactMessages
      : [];

    const usersByRole = [
      {
        label: "Admins",
        value: safeUsers.filter((user) => user.role === "ADMIN").length,
      },
      {
        label: "Agents",
        value: safeUsers.filter((user) => user.role === "AGENT").length,
      },
      {
        label: "Users",
        value: safeUsers.filter((user) => user.role === "USER").length,
      },
    ];

    const postsByType = [
      {
        label: "Buy",
        value: safePosts.filter((post) => post.type === "buy").length,
      },
      {
        label: "Rent",
        value: safePosts.filter((post) => post.type === "rent").length,
      },
    ];

    const postsByProperty = [
      {
        label: "Apartment",
        value: safePosts.filter((post) => post.property === "apartment")
          .length,
      },
      {
        label: "House",
        value: safePosts.filter((post) => post.property === "house").length,
      },
      {
        label: "Land",
        value: safePosts.filter((post) => post.property === "land").length,
      },
    ];

    const messagesByStatus = [
      {
        label: "Open",
        value: safeMessages.filter((item) => item.status === "OPEN").length,
      },
      {
        label: "Read",
        value: safeMessages.filter((item) => item.status === "READ").length,
      },
      {
        label: "Resolved",
        value: safeMessages.filter((item) => item.status === "RESOLVED")
          .length,
      },
    ];

    const cityCounts = safePosts.reduce((acc, post) => {
      const city = post.city || "Unknown";
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

    const reportsCount = safeMessages.filter(
      (item) => item.type === "REPORT"
    ).length;

    const openReportsCount = safeMessages.filter(
      (item) => item.type === "REPORT" && item.status === "OPEN"
    ).length;

    const monthlyActivity = buildMonthlyActivity(safeUsers, safePosts);

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
      monthlyActivity,
    };
  }, [users, posts, contactMessages]);

  return (
    <section className="adminAnalytics">
      <div className="analyticsHeader">
        <div>
          <span>Analytics</span>
          <h2>Platform Insights</h2>
          <p>
            Review SmartEstate performance, activity, property distribution, and
            support status in one professional analytics panel.
          </p>
        </div>
      </div>

      <div className="analyticsMiniGrid">
        <MiniMetric
          label="Average Property Price"
          value={formatMoney(analytics.averagePrice)}
        />

        <MiniMetric
          label="Highest Property Price"
          value={formatMoney(analytics.highestPrice)}
        />

        <MiniMetric label="Verified Agents" value={agents.length} />

        <MiniMetric
          label="Open Reports"
          value={stats?.openContactMessagesCount ?? analytics.openReportsCount}
          danger={analytics.openReportsCount > 0}
        />
      </div>

      <div className="analyticsGrid">
        <AnalyticsCard title="Users by Role" data={analytics.usersByRole} />
        <AnalyticsCard title="Posts by Type" data={analytics.postsByType} />
        <AnalyticsCard
          title="Properties by Category"
          data={analytics.postsByProperty}
        />
        <AnalyticsCard
          title="Messages by Status"
          data={analytics.messagesByStatus}
        />
      </div>

      <div className="analyticsBottomGrid">
        <div className="analyticsPanel">
          <div className="panelHeader">
            <span>Locations</span>
            <h3>Top Property Cities</h3>
          </div>

          {analytics.topCities.length > 0 ? (
            <div className="cityList">
              {analytics.topCities.map((city, index) => (
                <div className="cityItem" key={city.label}>
                  <b>{index + 1}</b>

                  <div>
                    <span>{city.label}</span>
                    <small>{city.value} listing(s)</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="analyticsEmpty">No city data available.</div>
          )}
        </div>

        <div className="analyticsPanel">
          <div className="panelHeader">
            <span>Growth</span>
            <h3>Monthly Activity</h3>
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
              Users
            </span>

            <span>
              <b className="postDot"></b>
              Posts
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

function buildMonthlyActivity(users, posts) {
  const months = [];

  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

    const label = date.toLocaleDateString("en-US", {
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
    userPercent: Math.max((item.userCount / maxUsers) * 100, 8),
    postPercent: Math.max((item.postCount / maxPosts) * 100, 8),
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