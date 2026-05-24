import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./listFilter.scss";

const initialFilters = {
  city: "",
  type: "",
  property: "",
  bedroom: "",
  bathroom: "",
  minPrice: "",
  maxPrice: "",
};

function ListFilter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    setFilters({
      city: searchParams.get("city") || "",
      type: searchParams.get("type") || "",
      property: searchParams.get("property") || "",
      bedroom: searchParams.get("bedroom") || "",
      bathroom: searchParams.get("bathroom") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
    });
  }, [searchParams]);

  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  const handleChange = (e) => {
    setFilters((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const buildUrl = (nextFilters) => {
    const params = new URLSearchParams();

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    const queryString = params.toString();

    return queryString ? `/list?${queryString}` : "/list";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(buildUrl(filters));
  };

  const handleReset = () => {
    setFilters(initialFilters);
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

  return (
    <div className="listFilter">
      <div className="filterHeader">
        <div>
          <span>Smart Filters</span>
          <h2>Find Your Property</h2>
          <p>
            Refine your search by city, property type, price range, and property
            details.
          </p>
        </div>

        {activeFilters.length > 0 && (
          <button type="button" className="resetBtn" onClick={handleReset}>
            Reset Filters
          </button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="activeFilters">
          {activeFilters.map(([key, value]) => (
            <button type="button" key={key} onClick={() => removeFilter(key)}>
              <span>{key}</span>
              <b>{value}</b>
              <small>×</small>
            </button>
          ))}
        </div>
      )}

      <form className="filterForm" onSubmit={handleSubmit}>
        <div className="inputGroup wide">
          <label htmlFor="city">City / Area</label>
          <input
            id="city"
            name="city"
            type="text"
            value={filters.city}
            onChange={handleChange}
            placeholder="Beirut, Tripoli, Byblos..."
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="type">Listing Type</label>
          <select
            id="type"
            name="type"
            value={filters.type}
            onChange={handleChange}
          >
            <option value="">Any Type</option>
            <option value="rent">Rent</option>
            <option value="buy">Buy</option>
          </select>
        </div>

        <div className="inputGroup">
          <label htmlFor="property">Property</label>
          <select
            id="property"
            name="property"
            value={filters.property}
            onChange={handleChange}
          >
            <option value="">Any Property</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="land">Land</option>
          </select>
        </div>

        <div className="inputGroup">
          <label htmlFor="bedroom">Bedrooms</label>
          <input
            id="bedroom"
            name="bedroom"
            type="number"
            min="0"
            value={filters.bedroom}
            onChange={handleChange}
            placeholder="2"
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="bathroom">Bathrooms</label>
          <input
            id="bathroom"
            name="bathroom"
            type="number"
            min="0"
            value={filters.bathroom}
            onChange={handleChange}
            placeholder="1"
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="minPrice">Min Price</label>
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
          <label htmlFor="maxPrice">Max Price</label>
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

        <div className="filterActions">
          <button type="submit">Apply Filters</button>
        </div>
      </form>
    </div>
  );
}

export default ListFilter;