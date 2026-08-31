import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./homepage.scss";
import { AuthContext } from "../../context/AuthContext";
import Map from "../../components/map/map";
import Card from "../../components/card/card";
import apiRequest from "../../lib/apiRequest";
import { getMapCoordinates } from "../../lib/mapCoordinates";

const HOME_CITIES = [
  { id: "beirut", name: "Beirut" },
  { id: "tripoli", name: "Tripoli" },
  { id: "jounieh", name: "Jounieh" },
  { id: "byblos", name: "Byblos" },
];

const LISTED_STATUSES = ["PUBLISHED", "SOLD", "RENTED"];

function unwrapPosts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.properties)) return payload.properties;
  if (Array.isArray(payload?.posts)) return payload.posts;
  return [];
}

function listingKind(post) {
  const type = String(post?.type || post?.listingType || "").toLowerCase();

  if (type === "rent") return "rent";
  if (type === "buy" || type === "sale") return "buy";
  return "";
}

function isListed(post) {
  const status = String(post?.status || "").toUpperCase();
  return !status || LISTED_STATUSES.includes(status);
}

function HomeSearch({ type, city, onTypeChange, onCityChange }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const buildPath = (nextCity = city, nextType = type) => {
    const params = new URLSearchParams();

    if (nextType) {
      params.set("type", nextType);
    }

    if (String(nextCity || "").trim()) {
      params.set("city", String(nextCity).trim());
    }

    const query = params.toString();
    return query ? `/list?${query}` : "/list";
  };

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(buildPath());
  };

  return (
    <form className="homeSearch" onSubmit={handleSearch}>
      <div className="homeSearchTypes" role="group" aria-label={t("home.hero.label")}>
        {[
          { value: "", labelKey: "home.search.all", tone: "all" },
          { value: "buy", labelKey: "home.search.buy", tone: "buy" },
          { value: "rent", labelKey: "home.search.rent", tone: "rent" },
        ].map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            className={`${option.tone}${type === option.value ? " isActive" : ""}`}
            onClick={() => onTypeChange(option.value)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>

      <div className="homeSearchRow">
        <label className="srOnly" htmlFor="homeCity">
          {t("home.hero.searchPlaceholder")}
        </label>
        <input
          id="homeCity"
          type="text"
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          placeholder={t("home.hero.searchPlaceholder")}
        />
        <button type="submit">{t("home.hero.searchButton")}</button>
      </div>

      <div className="homeCities">
        <span>{t("home.hero.popular")}</span>
        {HOME_CITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(buildPath(item.name))}
          >
            {t(`home.cities.${item.id}`)}
          </button>
        ))}
      </div>
    </form>
  );
}

function HomePage() {
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const role = String(currentUser?.role || "USER").toUpperCase();
  const canCreateDirectly = role === "AGENT" || role === "ADMIN";

  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [posts, setPosts] = useState([]);
  const [mapReady, setMapReady] = useState(false);

  const listPath = currentUser
    ? canCreateDirectly
      ? "/newPostPage"
      : "/request-listing"
    : "/register";

  useEffect(() => {
    let cancelled = false;

    apiRequest
      .get("/posts?limit=10")
      .then((res) => {
        if (cancelled) return;
        setPosts(unwrapPosts(res.data));
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setMapReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const cityQuery = String(city || "").trim().toLowerCase();

    return posts.filter((post) => {
      if (!isListed(post)) return false;

      if (type) {
        const kind = listingKind(post);
        if (kind !== type) return false;
      }

      if (cityQuery) {
        const postCity = String(post?.city || "").toLowerCase();
        if (!postCity.includes(cityQuery)) return false;
      }

      return true;
    });
  }, [posts, type, city]);

  const mapItems = useMemo(
    () => filteredPosts.filter((post) => getMapCoordinates(post)),
    [filteredPosts]
  );

  const latestHomes = useMemo(() => filteredPosts.slice(0, 6), [filteredPosts]);

  return (
    <main className="homepage">
      <section className="homeCover">
        <div className="homeCoverCopy">
          <p>{t("home.hero.label")}</p>
          <h1>{t("home.hero.title")}</h1>
          <span>{t("home.hero.description")}</span>
          {currentUser && (
            <em>
              {t("home.hero.welcomeBack")}, {currentUser.username}
            </em>
          )}
          <HomeSearch
            type={type}
            city={city}
            onTypeChange={setType}
            onCityChange={setCity}
          />
          <div className="homeCoverLinks">
            <Link to={listPath}>{t("home.hero.listProperty")}</Link>
          </div>
        </div>
        <div className="homeCoverArt">
          {mapReady ? (
            <Map items={mapItems} className="homeMap" />
          ) : (
            <div className="homeMap homeMapPending" />
          )}
        </div>
      </section>

      <section className="homeLatest">
        <div className="homeLatestHead">
          <div>
            <p>{t("home.latest.label")}</p>
            <h2>{t("home.latest.title")}</h2>
            <span>{t("home.latest.description")}</span>
          </div>
          <Link to="/list">{t("home.hero.browseHomes")}</Link>
        </div>

        {!mapReady ? (
          <div className="homeLatestEmpty">{t("home.latest.loading")}</div>
        ) : latestHomes.length === 0 ? (
          <div className="homeLatestEmpty">{t("home.latest.empty")}</div>
        ) : (
          <div className="homeLatestGrid">
            {latestHomes.map((post) => (
              <Card key={post.id} item={post} />
            ))}
          </div>
        )}
      </section>

      <section className="homeRoles">
        <Link to="/list" className="roleBuyer">
          <small>01</small>
          <strong>{t("home.roles.buyerTitle")}</strong>
          <span>{t("home.roles.buyerText")}</span>
        </Link>
        <Link to={listPath} className="roleOwner">
          <small>02</small>
          <strong>{t("home.roles.ownerTitle")}</strong>
          <span>{t("home.roles.ownerText")}</span>
        </Link>
      </section>
    </main>
  );
}

export default HomePage;
