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

const PROPERTY_TYPES = [
  "apartment",
  "house",
  "villa",
  "land",
  "building",
  "office",
  "shop",
  "warehouse",
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

function listingProperty(post) {
  return String(post?.property || post?.propertyType || "").toLowerCase();
}

function isListed(post) {
  const status = String(post?.status || "").toUpperCase();
  return !status || LISTED_STATUSES.includes(status);
}

function TypeIcon({ type }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "apartment") {
    return (
      <svg {...common}>
        <path d="M5 20V6h8v14" />
        <path d="M13 10h6v10" />
        <path d="M8 9h2M8 13h2M8 17h2M16 14h1.5M16 17h1.5" />
      </svg>
    );
  }

  if (type === "villa") {
    return (
      <svg {...common}>
        <path d="M3 20V11l9-7 9 7v9" />
        <path d="M9 20v-6h6v6" />
        <path d="M7 11h10" />
      </svg>
    );
  }

  if (type === "land") {
    return (
      <svg {...common}>
        <path d="M3 17h18" />
        <path d="M5 17 9 9l4 5 3-3 3 6" />
        <path d="M16 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    );
  }

  if (type === "building") {
    return (
      <svg {...common}>
        <path d="M5 20V4h10v16" />
        <path d="M15 9h4v11" />
        <path d="M8 8h4M8 12h4M8 16h4" />
        <path d="M16.5 13h1M16.5 16h1" />
      </svg>
    );
  }

  if (type === "office") {
    return (
      <svg {...common}>
        <path d="M4 20V5h10v15" />
        <path d="M14 9h6v11" />
        <path d="M7 8h4M7 12h4M7 16h4M17 13h1M17 16h1" />
      </svg>
    );
  }

  if (type === "shop") {
    return (
      <svg {...common}>
        <path d="M4 10h16v10H4z" />
        <path d="M4 10 6.2 5h11.6L20 10" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }

  if (type === "warehouse") {
    return (
      <svg {...common}>
        <path d="M3 20V10l9-6 9 6v10" />
        <path d="M8 20v-6h8v6" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 20V11l8-7 8 7v9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function HomeSearch({ type, city, property, onTypeChange, onCityChange, onPropertyChange }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const buildPath = (nextCity = city, nextType = type, nextProperty = property) => {
    const params = new URLSearchParams();

    if (nextType) {
      params.set("type", nextType);
    }

    if (String(nextCity || "").trim()) {
      params.set("city", String(nextCity).trim());
    }

    if (nextProperty) {
      params.set("property", nextProperty);
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

      <div className="homePropertyChips" role="group" aria-label={t("home.types.label")}>
        <button
          type="button"
          className={!property ? "isActive" : ""}
          onClick={() => onPropertyChange("")}
        >
          {t("home.search.all")}
        </button>
        {PROPERTY_TYPES.map((item) => (
          <button
            key={item}
            type="button"
            className={property === item ? "isActive" : ""}
            onClick={() => onPropertyChange(property === item ? "" : item)}
          >
            {t(`home.types.${item}`)}
          </button>
        ))}
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
  const [property, setProperty] = useState("");
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

      if (property) {
        if (listingProperty(post) !== property) return false;
      }

      if (cityQuery) {
        const postCity = String(post?.city || "").toLowerCase();
        if (!postCity.includes(cityQuery)) return false;
      }

      return true;
    });
  }, [posts, type, city, property]);

  const mapItems = useMemo(
    () => filteredPosts.filter((post) => getMapCoordinates(post)),
    [filteredPosts]
  );

  const latestListings = useMemo(() => filteredPosts.slice(0, 6), [filteredPosts]);

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
            property={property}
            onTypeChange={setType}
            onCityChange={setCity}
            onPropertyChange={setProperty}
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

      <section className="homeTypes">
        <div className="homeTypesHead">
          <p>{t("home.types.label")}</p>
          <h2>{t("home.types.title")}</h2>
          <span>{t("home.types.description")}</span>
        </div>
        <div className="homeTypesGrid">
          {PROPERTY_TYPES.map((item) => (
            <Link
              key={item}
              to={`/list?property=${item}${type ? `&type=${type}` : ""}`}
              className={`homeTypeCard homeTypeCard--${item}`}
            >
              <span className="homeTypeIcon">
                <TypeIcon type={item} />
              </span>
              <strong>{t(`home.types.${item}`)}</strong>
            </Link>
          ))}
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
        ) : latestListings.length === 0 ? (
          <div className="homeLatestEmpty">{t("home.latest.empty")}</div>
        ) : (
          <div className="homeLatestGrid">
            {latestListings.map((post) => (
              <Card key={post.id} item={post} />
            ))}
          </div>
        )}
      </section>

      <section className="homeBuild">
        <header>
          <p>{t("home.build.label")}</p>
          <h2>{t("home.build.title")}</h2>
        </header>
        <div className="homeBuildGrid">
          <article>
            <b>01</b>
            <h3>{t("home.build.oneTitle")}</h3>
            <p>{t("home.build.oneText")}</p>
          </article>
          <article>
            <b>02</b>
            <h3>{t("home.build.twoTitle")}</h3>
            <p>{t("home.build.twoText")}</p>
          </article>
          <article>
            <b>03</b>
            <h3>{t("home.build.threeTitle")}</h3>
            <p>{t("home.build.threeText")}</p>
          </article>
        </div>
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
