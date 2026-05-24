import "./searchBar.scss";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const types = ["buy", "rent"];

function SearchBar() {
  const navigate = useNavigate();

  const [query, setQuery] = useState({
    type: "buy",
    city: "",
    property: "",
    bedroom: "",
    minPrice: "",
    maxPrice: "",
  });

  const [error, setError] = useState("");

  const switchType = (val) => {
    setQuery((prev) => ({ ...prev, type: val }));
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setQuery((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const handleReset = () => {
    setQuery({
      type: "buy",
      city: "",
      property: "",
      bedroom: "",
      minPrice: "",
      maxPrice: "",
    });

    setError("");
  };

  const handleSearch = (e) => {
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

  return (
    <div className="searchBar">
      <div className="type">
        {types.map((type) => (
          <button
            type="button"
            key={type}
            onClick={() => switchType(type)}
            className={query.type === type ? "active" : ""}
          >
            {type === "buy" ? "Buy" : "Rent"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch}>
        <div className="inputGroup location">
          <label>Location</label>
          <input
            type="text"
            name="city"
            placeholder="Search city..."
            value={query.city}
            onChange={handleChange}
          />
        </div>

        <div className="inputGroup">
          <label>Property</label>
          <select name="property" value={query.property} onChange={handleChange}>
            <option value="">Any</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="land">Land</option>
          </select>
        </div>

        <div className="inputGroup">
          <label>Bedrooms</label>
          <select name="bedroom" value={query.bedroom} onChange={handleChange}>
            <option value="">Any</option>
            <option value="1">1 Bedroom</option>
            <option value="2">2 Bedrooms</option>
            <option value="3">3 Bedrooms</option>
            <option value="4">4 Bedrooms</option>
          </select>
        </div>

        <div className="inputGroup">
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

        <div className="inputGroup">
          <label>Max Price</label>
          <input
            type="number"
            name="maxPrice"
            min={0}
            placeholder="$999999"
            value={query.maxPrice}
            onChange={handleChange}
          />
        </div>

        <div className="actions">
          <button type="submit" className="searchBtn">
            <img src="/search.png" alt="Search" />
            <span>Search</span>
          </button>

          <button type="button" className="resetBtn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {error && <p className="searchError">{error}</p>}
    </div>
  );
}

export default SearchBar;