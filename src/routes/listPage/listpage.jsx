import "./listpage.scss";
import { useContext } from "react";
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Card from "../../components/card/card";
import Map from "../../components/map/map";
import ListFilter from "../../components/listFilter/listFilter";
import PageState from "../../components/pageState/pageState";
import { AuthContext } from "../../context/AuthContext.jsx";

function normalizeProperties(data) {
  const unwrap = (item) => {
    if (!item || typeof item !== "object") {
      return null;
    }

    if (item.property && typeof item.property === "object") {
      return item.property;
    }

    if (item.post && typeof item.post === "object") {
      return item.post;
    }

    return item;
  };

  if (Array.isArray(data)) {
    return data.map(unwrap).filter(Boolean);
  }

  if (Array.isArray(data?.properties)) {
    return data.properties.map(unwrap).filter(Boolean);
  }

  if (Array.isArray(data?.posts)) {
    return data.posts.map(unwrap).filter(Boolean);
  }

  if (Array.isArray(data?.items)) {
    return data.items.map(unwrap).filter(Boolean);
  }

  if (Array.isArray(data?.data)) {
    return data.data.map(unwrap).filter(Boolean);
  }

  return [];
}

function ListPage() {
  const data = useLoaderData();
  const properties = normalizeProperties(data);
  const pagination = data?.pagination || null;
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const role = String(currentUser?.role || "").toUpperCase();
  const canCreateDirectly = role === "AGENT" || role === "ADMIN";
  const createPath = canCreateDirectly ? "/newPostPage" : "/request-listing";
  const createLabel = canCreateDirectly
    ? t("list.hero.createListing")
    : t("list.hero.requestListing");

  const listedProperties = properties.filter((property) =>
    ["PUBLISHED", "SOLD", "RENTED"].includes(
      String(property.status || "").toUpperCase()
    )
  );

  const activeType = searchParams.get("type") || "";
  const currentPage = Number(pagination?.page || searchParams.get("page") || 1);
  const totalPages = Number(pagination?.totalPages || 1);
  const totalResults = Number(pagination?.total || listedProperties.length);

  const setType = (type) => {
    const next = new URLSearchParams(searchParams);

    if (!type) {
      next.delete("type");
    } else {
      next.set("type", type);
    }

    next.delete("page");
    const query = next.toString();
    navigate(query ? `/list?${query}` : "/list");
  };

  const setPage = (page) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(page));
    }
    const query = next.toString();
    navigate(query ? `/list?${query}` : "/list");
  };

  return (
    <main className="listPage pageFade">
      <section className="listHero">
        <div>
          <p className="listEyebrow">{t("list.hero.badge")}</p>
          <h1>{t("list.hero.title")}</h1>
          <span>{t("list.hero.description")}</span>
        </div>

        {currentUser && (
          <Link to={createPath} className="createListingBtn">
            {createLabel}
          </Link>
        )}
      </section>

      <nav className="listTabs" aria-label={t("list.hero.badge")}>
        <button
          type="button"
          className={!activeType ? "isActive" : ""}
          onClick={() => setType("")}
        >
          {t("list.tabs.all")}
        </button>
        <button
          type="button"
          className={activeType === "buy" ? "isActive" : ""}
          onClick={() => setType("buy")}
        >
          {t("list.tabs.buy")}
        </button>
        <button
          type="button"
          className={activeType === "rent" ? "isActive" : ""}
          onClick={() => setType("rent")}
        >
          {t("list.tabs.rent")}
        </button>
      </nav>

      <section className="filterSection">
        <ListFilter />
      </section>

      <section className="listContent">
        <div className="resultsPanel">
          <div className="resultsHeader">
            <h2>
              {totalResults === 1
                ? t("list.results.propertyFound", {
                    count: totalResults,
                  })
                : t("list.results.propertiesFound", {
                    count: totalResults,
                  })}
            </h2>
            <p>
              {listedProperties.length > 0
                ? t("list.results.descriptionWithResults")
                : t("list.results.descriptionEmpty")}
            </p>
          </div>

          <div className="cardsContainer">
            {listedProperties.length > 0 ? (
              listedProperties.map((property) => (
                <Card key={property.id} item={property} />
              ))
            ) : (
              <PageState
                type="empty"
                title={t("list.empty.title")}
                message={t("list.empty.message")}
                buttonText={t("list.empty.button")}
                buttonLink="/list"
              />
            )}
          </div>

          {totalPages > 1 && (
            <div className="listPagination">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("list.pagination.prev")}
              </button>
              <span>
                {t("list.pagination.page", {
                  page: currentPage,
                  pages: totalPages,
                })}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("list.pagination.next")}
              </button>
            </div>
          )}
        </div>

        <aside className="mapPanel">
          <div className="mapCard">
            <div className="mapHeader">
              <h2>{t("list.map.title")}</h2>
              <p>{t("list.map.badge")}</p>
            </div>

            <div className="mapBox">
              <Map items={listedProperties} />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default ListPage;
