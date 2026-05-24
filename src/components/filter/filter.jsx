import "./filter.scss";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";

function Filter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState({
    city: searchParams.get("city") || "",
    type: searchParams.get("type") || "",
    property: searchParams.get("property") || "",
    bedroom: searchParams.get("bedroom") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setQuery((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const minPrice = Number(query.minPrice);
    const maxPrice = Number(query.maxPrice);

    if (query.minPrice && query.maxPrice && minPrice > maxPrice) {
      setError("Min price cannot be greater than max price.");
      return;
    }

    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== "") {
        params.append(key, value);
      }
    });

    navigate(`/list?${params.toString()}`);
  };

  const handleReset = () => {
    setQuery({
      city: "",
      type: "",
      property: "",
      bedroom: "",
      minPrice: "",
      maxPrice: "",
    });

    setError("");
    navigate("/list");
  };

  return (
    <div className="filter">
      <div className="filterHeader">
        <div>
          <span>Advanced Search</span>
          <h2>Find Your Best Property</h2>
        </div>

        <button type="button" onClick={handleReset}>
          Reset
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="inputBox large">
          <label>City</label>
          <input
            type="text"
            name="city"
            placeholder="Search by city"
            value={query.city}
            onChange={handleChange}
          />
        </div>

        <div className="inputBox">
          <label>Type</label>
          <select name="type" value={query.type} onChange={handleChange}>
            <option value="">Any</option>
            <option value="buy">Buy</option>
            <option value="rent">Rent</option>
          </select>
        </div>

        <div className="inputBox">
          <label>Property</label>
          <select name="property" value={query.property} onChange={handleChange}>
            <option value="">Any</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="land">Land</option>
          </select>
        </div>

        <div className="inputBox">
          <label>Bedrooms</label>
          <select name="bedroom" value={query.bedroom} onChange={handleChange}>
            <option value="">Any</option>
            <option value="1">1 Bedroom</option>
            <option value="2">2 Bedrooms</option>
            <option value="3">3 Bedrooms</option>
            <option value="4">4 Bedrooms</option>
          </select>
        </div>

        <div className="inputBox">
          <label>Min Price</label>
          <input
            type="number"
            name="minPrice"
            min={0}
            placeholder="$0"
            value={query.minPrice}
            onChange={handleChange}
          />
        </div>

        <div className="inputBox">
          <label>Max Price</label>
          <input
            type="number"
            name="maxPrice"
            min={0}
            placeholder="$500000"
            value={query.maxPrice}
            onChange={handleChange}
          />
        </div>

        <button type="submit" className="searchButton">
          <img src="/search.png" alt="Search" />
          Search
        </button>
      </form>

      {error && <p className="filterError">{error}</p>}
    </div>
  );
}

export default Filter;