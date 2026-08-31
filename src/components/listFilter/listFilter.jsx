import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./listFilter.scss";

const PROPERTY_TYPES = [
  "apartment",
  "house",
  "villa",
  "land",
  "office",
  "shop",
  "warehouse",
];

const initialFilters = {
  city: "",
  type: "",
  property: "",
  q: "",
  bedroom: "",
  bathroom: "",
  minPrice: "",
  maxPrice: "",
  minSize: "",
  maxSize: "",
  sort: "",
  availability: "",
};

function normalizeType(value) {
  const type = String(value || "").trim().toLowerCase();

  if (type === "rent") return "rent";
  if (type === "buy" || type === "sale") return "buy";

  return "";
}

function normalizeProperty(value) {
  const property = String(value || "").trim().toLowerCase();

  if (PROPERTY_TYPES.includes(property)) {
    return property;
  }

  return "";
}

function normalizeSort(value) {
  const sort = String(value || "").trim().toLowerCase();

  if (["newest", "oldest", "price_asc", "price_desc", "popular"].includes(sort)) {
    return sort;
  }

  return "";
}

function normalizeAvailability(value, includeClosed) {
  const availability = String(value || "").trim().toLowerCase();

  if (availability === "available" || includeClosed === "false") {
    return "available";
  }

  return "";
}

function ListFilter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [filters, setFilters] = useState(initialFilters);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const nextFilters = {
      city: searchParams.get("city") || "",
      type: normalizeType(searchParams.get("type")),
      property: normalizeProperty(searchParams.get("property")),
      q: searchParams.get("q") || "",
      bedroom: searchParams.get("bedroom") || "",
      bathroom: searchParams.get("bathroom") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      minSize: searchParams.get("minSize") || "",
      maxSize: searchParams.get("maxSize") || "",
      sort: normalizeSort(searchParams.get("sort")),
      availability: normalizeAvailability(
        searchParams.get("availability"),
        searchParams.get("includeClosed")
      ),
    };

    setFilters(nextFilters);

    if (
      nextFilters.q ||
      nextFilters.bedroom ||
      nextFilters.bathroom ||
      nextFilters.minPrice ||
      nextFilters.maxPrice ||
      nextFilters.minSize ||
      nextFilters.maxSize ||
      nextFilters.availability
    ) {
      setShowMore(true);
    }
  }, [searchParams]);

  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value && key !== "type"
  );

  const handleChange = (e) => {
    setFilters((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const buildUrl = (nextFilters) => {
    const params = new URLSearchParams();

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (!value || key === "availability") {
        return;
      }

      params.append(key, value);
    });

    if (nextFilters.availability === "available") {
      params.set("includeClosed", "false");
    }

    const queryString = params.toString();

    return queryString ? `/list?${queryString}` : "/list";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(buildUrl(filters));
  };

  const handleReset = () => {
    setFilters(initialFilters);
    setShowMore(false);
    navigate("/list");
  };

  const removeFilter = (key) => {
    const updatedFilters = {
      ...filters,
      [key]: "",
    };

    setFilters(updatedFilters);
    navigate(buildUrl(updatedFilters));
  };

  const getFilterLabel = (key) => {
    return t(`listFilter.activeLabels.${key}`, { defaultValue: key });
  };

  const getFilterValue = (key, value) => {
    if (key === "type") {
      return t(`listFilter.values.type.${value}`, { defaultValue: value });
    }

    if (key === "property") {
      return t(`listFilter.values.property.${value}`, { defaultValue: value });
    }

    if (key === "sort") {
      return t(`listFilter.values.sort.${value}`, { defaultValue: value });
    }

    if (key === "availability") {
      return t(`listFilter.values.availability.${value}`, { defaultValue: value });
    }

    if (key === "bedroom" || key === "bathroom") {
      return `${value}+`;
    }

    if (key === "minSize" || key === "maxSize") {
      return `${value} m²`;
    }

    return value;
  };

  return (
    <form className="listFilter" onSubmit={handleSubmit}>
      <div className="filterHeader">
        <div>
          <span>{t("listFilter.header.badge")}</span>
          <h2>{t("listFilter.header.title")}</h2>
          <p>{t("listFilter.header.description")}</p>
        </div>

        <div className="headerActions">
          {activeFilters.length > 0 && (
            <button type="button" className="resetBtn" onClick={handleReset}>
              {t("listFilter.buttons.resetFilters")}
            </button>
          )}
          <button
            type="button"
            className="resetBtn"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore
              ? t("listFilter.buttons.fewerFilters")
              : t("listFilter.buttons.moreFilters")}
          </button>
          <button type="submit" className="applyBtn">
            {t("listFilter.buttons.applyFilters")}
          </button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="activeFilters">
          {activeFilters.map(([key, value]) => (
            <button type="button" key={key} onClick={() => removeFilter(key)}>
              <span>{getFilterLabel(key)}</span>
              <b>{getFilterValue(key, value)}</b>
              <small>×</small>
            </button>
          ))}
        </div>
      )}

      <div className={showMore ? "filterForm isExpanded" : "filterForm"}>
        <div className="inputGroup wide">
          <label htmlFor="city">{t("listFilter.labels.city")}</label>
          <input
            id="city"
            name="city"
            type="text"
            value={filters.city}
            onChange={handleChange}
            placeholder={t("listFilter.placeholders.city")}
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="property">{t("listFilter.labels.property")}</label>
          <select
            id="property"
            name="property"
            value={filters.property}
            onChange={handleChange}
          >
            <option value="">{t("listFilter.options.anyProperty")}</option>
            {PROPERTY_TYPES.map((type) => (
              <option value={type} key={type}>
                {t(`listFilter.options.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="inputGroup">
          <label htmlFor="sort">{t("listFilter.labels.sort")}</label>
          <select
            id="sort"
            name="sort"
            value={filters.sort}
            onChange={handleChange}
          >
            <option value="">{t("listFilter.options.sortNewest")}</option>
            <option value="price_asc">{t("listFilter.options.sortPriceAsc")}</option>
            <option value="price_desc">{t("listFilter.options.sortPriceDesc")}</option>
            <option value="popular">{t("listFilter.options.sortPopular")}</option>
            <option value="oldest">{t("listFilter.options.sortOldest")}</option>
          </select>
        </div>

        {showMore && (
          <>
            <div className="inputGroup wide">
              <label htmlFor="q">{t("listFilter.labels.keyword")}</label>
              <input
                id="q"
                name="q"
                type="text"
                value={filters.q}
                onChange={handleChange}
                placeholder={t("listFilter.placeholders.keyword")}
              />
            </div>

            <div className="inputGroup">
              <label htmlFor="bedroom">{t("listFilter.labels.bedrooms")}</label>
              <select
                id="bedroom"
                name="bedroom"
                value={filters.bedroom}
                onChange={handleChange}
              >
                <option value="">{t("listFilter.options.any")}</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
              </select>
            </div>

            <div className="inputGroup">
              <label htmlFor="bathroom">{t("listFilter.labels.bathrooms")}</label>
              <select
                id="bathroom"
                name="bathroom"
                value={filters.bathroom}
                onChange={handleChange}
              >
                <option value="">{t("listFilter.options.any")}</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>

            <div className="inputGroup">
              <label htmlFor="minPrice">{t("listFilter.labels.minPrice")}</label>
              <input
                id="minPrice"
                name="minPrice"
                type="number"
                min="0"
                value={filters.minPrice}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="inputGroup">
              <label htmlFor="maxPrice">{t("listFilter.labels.maxPrice")}</label>
              <input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min="0"
                value={filters.maxPrice}
                onChange={handleChange}
                placeholder="500000"
              />
            </div>

            <div className="inputGroup">
              <label htmlFor="minSize">{t("listFilter.labels.minSize")}</label>
              <input
                id="minSize"
                name="minSize"
                type="number"
                min="0"
                value={filters.minSize}
                onChange={handleChange}
                placeholder="80"
              />
            </div>

            <div className="inputGroup">
              <label htmlFor="maxSize">{t("listFilter.labels.maxSize")}</label>
              <input
                id="maxSize"
                name="maxSize"
                type="number"
                min="0"
                value={filters.maxSize}
                onChange={handleChange}
                placeholder="300"
              />
            </div>

            <div className="inputGroup">
              <label htmlFor="availability">{t("listFilter.labels.availability")}</label>
              <select
                id="availability"
                name="availability"
                value={filters.availability}
                onChange={handleChange}
              >
                <option value="">{t("listFilter.options.anyListed")}</option>
                <option value="available">
                  {t("listFilter.options.availableOnly")}
                </option>
              </select>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

export default ListFilter;
