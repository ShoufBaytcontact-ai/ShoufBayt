import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./smartSearchAssistant.scss";

const knownCities = [
  "beirut",
  "tripoli",
  "saida",
  "sidon",
  "tyre",
  "sour",
  "jounieh",
  "byblos",
  "jbeil",
  "zahle",
  "baalbek",
  "batroun",
  "nabatieh",
  "aley",
  "hamra",
  "achrafieh",
  "verdun",
  "hazmieh",
  "jnah",
];

const cityNames = {
  beirut: "Beirut",
  tripoli: "Tripoli",
  saida: "Saida",
  sidon: "Saida",
  tyre: "Tyre",
  sour: "Tyre",
  jounieh: "Jounieh",
  byblos: "Byblos",
  jbeil: "Byblos",
  zahle: "Zahle",
  baalbek: "Baalbek",
  batroun: "Batroun",
  nabatieh: "Nabatieh",
  aley: "Aley",
  hamra: "Hamra",
  achrafieh: "Achrafieh",
  verdun: "Verdun",
  hazmieh: "Hazmieh",
  jnah: "Jnah",
};

function SmartSearchAssistant() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [detectedFilters, setDetectedFilters] = useState(null);
  const [error, setError] = useState("");

  const detectNumberBeforeWords = (text, words) => {
    for (const word of words) {
      const regex = new RegExp(`(\\d+)\\s*${word}`, "i");
      const match = text.match(regex);

      if (match) {
        return match[1];
      }
    }

    return "";
  };

  const detectPrice = (text) => {
    const underRegex =
      /(under|below|less than|max|maximum|budget|up to)\s*\$?\s*(\d+)/i;

    const overRegex = /(over|above|more than|min|minimum)\s*\$?\s*(\d+)/i;

    const underMatch = text.match(underRegex);
    const overMatch = text.match(overRegex);

    return {
      maxPrice: underMatch ? underMatch[2] : "",
      minPrice: overMatch ? overMatch[2] : "",
    };
  };

  const detectCity = (text) => {
    const lowerText = text.toLowerCase();

    const foundCity = knownCities.find((city) => lowerText.includes(city));

    return foundCity ? cityNames[foundCity] : "";
  };

  const parseSmartQuery = (text) => {
    const lowerText = text.toLowerCase();

    const filters = {
      city: detectCity(lowerText),
      type: "",
      property: "",
      bedroom: "",
      bathroom: "",
      minPrice: "",
      maxPrice: "",
    };

    if (
      lowerText.includes("rent") ||
      lowerText.includes("rental") ||
      lowerText.includes("monthly")
    ) {
      filters.type = "rent";
    }

    if (
      lowerText.includes("buy") ||
      lowerText.includes("sale") ||
      lowerText.includes("purchase")
    ) {
      filters.type = "buy";
    }

    if (lowerText.includes("apartment") || lowerText.includes("flat")) {
      filters.property = "apartment";
    }

    if (lowerText.includes("house") || lowerText.includes("villa")) {
      filters.property = "house";
    }

    if (lowerText.includes("land") || lowerText.includes("plot")) {
      filters.property = "land";
    }

    filters.bedroom = detectNumberBeforeWords(lowerText, [
      "bedroom",
      "bedrooms",
      "bed",
      "beds",
    ]);

    filters.bathroom = detectNumberBeforeWords(lowerText, [
      "bathroom",
      "bathrooms",
      "bath",
      "baths",
    ]);

    const priceFilters = detectPrice(lowerText);

    filters.minPrice = priceFilters.minPrice;
    filters.maxPrice = priceFilters.maxPrice;

    return filters;
  };

  const buildSearchUrl = (filters) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    return `/list?${params.toString()}`;
  };

  const handleAnalyze = () => {
    if (!query.trim()) {
      setError("Please write what kind of property you are searching for.");
      return;
    }

    const filters = parseSmartQuery(query);

    const hasAnyFilter = Object.values(filters).some(Boolean);

    if (!hasAnyFilter) {
      setError(
        "I could not detect filters. Try writing something like: apartment in Beirut under 500 with 2 bedrooms."
      );
      setDetectedFilters(null);
      return;
    }

    setError("");
    setDetectedFilters(filters);
  };

  const handleSearch = () => {
    if (!detectedFilters) {
      const filters = parseSmartQuery(query);
      navigate(buildSearchUrl(filters));
      return;
    }

    navigate(buildSearchUrl(detectedFilters));
  };

  const handleExample = (text) => {
    setQuery(text);
    setError("");

    const filters = parseSmartQuery(text);
    setDetectedFilters(filters);
  };

  return (
    <div className="smartSearchAssistant">
      <div className="smartHeader">
        <span>SmartEstate AI</span>

        <h2>Smart Property Search</h2>

        <p>
          Describe what you are looking for, and SmartEstate will turn your text
          into property search filters.
        </p>
      </div>

      <div className="smartInputBox">
        <textarea
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError("");
            setDetectedFilters(null);
          }}
          placeholder="Example: I want an apartment in Beirut under 500 with 2 bedrooms"
        ></textarea>

        <div className="smartActions">
          <button type="button" onClick={handleAnalyze}>
            Analyze Request
          </button>

          <button
            type="button"
            className="searchBtn"
            onClick={handleSearch}
            disabled={!query.trim()}
          >
            Search Properties
          </button>
        </div>
      </div>

      <div className="smartExamples">
        <button
          type="button"
          onClick={() =>
            handleExample("I want an apartment in Beirut under 500 with 2 bedrooms")
          }
        >
          Apartment in Beirut under 500
        </button>

        <button
          type="button"
          onClick={() =>
            handleExample("Find me a house in Tripoli for buy under 100000")
          }
        >
          House in Tripoli for buy
        </button>

        <button
          type="button"
          onClick={() =>
            handleExample("Land in Byblos above 50000 for sale")
          }
        >
          Land in Byblos
        </button>
      </div>

      {error && <div className="smartError">{error}</div>}

      {detectedFilters && (
        <div className="detectedBox">
          <h3>Detected Filters</h3>

          <div className="detectedGrid">
            <div>
              <span>City</span>
              <b>{detectedFilters.city || "Any"}</b>
            </div>

            <div>
              <span>Type</span>
              <b>{detectedFilters.type || "Any"}</b>
            </div>

            <div>
              <span>Property</span>
              <b>{detectedFilters.property || "Any"}</b>
            </div>

            <div>
              <span>Bedrooms</span>
              <b>{detectedFilters.bedroom || "Any"}</b>
            </div>

            <div>
              <span>Bathrooms</span>
              <b>{detectedFilters.bathroom || "Any"}</b>
            </div>

            <div>
              <span>Min Price</span>
              <b>{detectedFilters.minPrice || "Any"}</b>
            </div>

            <div>
              <span>Max Price</span>
              <b>{detectedFilters.maxPrice || "Any"}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSearchAssistant;