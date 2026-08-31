import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./smartSearchAssistant.scss";

const knownCities = [
  { value: "Beirut", aliases: ["beirut", "بيروت"] },
  { value: "Tripoli", aliases: ["tripoli", "طرابلس"] },
  { value: "Saida", aliases: ["saida", "sidon", "صيدا"] },
  { value: "Tyre", aliases: ["tyre", "sour", "صور"] },
  { value: "Jounieh", aliases: ["jounieh", "جونية"] },
  { value: "Byblos", aliases: ["byblos", "jbeil", "جبيل"] },
  { value: "Zahle", aliases: ["zahle", "زحلة"] },
  { value: "Baalbek", aliases: ["baalbek", "بعلبك"] },
  { value: "Batroun", aliases: ["batroun", "البترون"] },
  { value: "Nabatieh", aliases: ["nabatieh", "النبطية"] },
  { value: "Aley", aliases: ["aley", "عاليه"] },
  { value: "Hamra", aliases: ["hamra", "الحمرا", "حمرا"] },
  {
    value: "Achrafieh",
    aliases: ["achrafieh", "ashrafieh", "الأشرفية", "اشرفية"],
  },
  { value: "Verdun", aliases: ["verdun", "فردان"] },
  { value: "Hazmieh", aliases: ["hazmieh", "الحازمية"] },
  { value: "Jnah", aliases: ["jnah", "الجناح"] },
];

function SmartSearchAssistant() {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      /(under|below|less than|max|maximum|budget|up to|تحت|أقل من|اقل من|حتى|بحدود)\s*\$?\s*(\d+)/i;

    const overRegex =
      /(over|above|more than|min|minimum|فوق|أكثر من|اكثر من|أعلى من|اعلى من)\s*\$?\s*(\d+)/i;

    const underMatch = text.match(underRegex);
    const overMatch = text.match(overRegex);

    return {
      maxPrice: underMatch ? underMatch[2] : "",
      minPrice: overMatch ? overMatch[2] : "",
    };
  };

  const detectCity = (text) => {
    const lowerText = text.toLowerCase();

    const foundCity = knownCities.find((city) =>
      city.aliases.some((alias) => lowerText.includes(alias.toLowerCase()))
    );

    return foundCity ? foundCity.value : "";
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
      lowerText.includes("monthly") ||
      lowerText.includes("إيجار") ||
      lowerText.includes("ايجار") ||
      lowerText.includes("استئجار") ||
      lowerText.includes("شهري")
    ) {
      filters.type = "rent";
    }

    if (
      lowerText.includes("buy") ||
      lowerText.includes("sale") ||
      lowerText.includes("purchase") ||
      lowerText.includes("للبيع") ||
      lowerText.includes("بيع") ||
      lowerText.includes("شراء")
    ) {
      filters.type = "buy";
    }

    if (
      lowerText.includes("apartment") ||
      lowerText.includes("flat") ||
      lowerText.includes("شقة") ||
      lowerText.includes("شقق")
    ) {
      filters.property = "apartment";
    }

    if (
      lowerText.includes("house") ||
      lowerText.includes("villa") ||
      lowerText.includes("منزل") ||
      lowerText.includes("بيت") ||
      lowerText.includes("فيلا")
    ) {
      filters.property = "house";
    }

    if (
      lowerText.includes("land") ||
      lowerText.includes("plot") ||
      lowerText.includes("أرض") ||
      lowerText.includes("ارض")
    ) {
      filters.property = "land";
    }

    filters.bedroom = detectNumberBeforeWords(lowerText, [
      "bedroom",
      "bedrooms",
      "bed",
      "beds",
      "غرفة",
      "غرف",
    ]);

    filters.bathroom = detectNumberBeforeWords(lowerText, [
      "bathroom",
      "bathrooms",
      "bath",
      "baths",
      "حمام",
      "حمامات",
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

    const queryString = params.toString();

    return queryString ? `/list?${queryString}` : "/list";
  };

  const handleSearch = () => {
    if (!query.trim()) {
      setError(t("smartSearchAssistant.errors.empty"));
      setDetectedFilters(null);
      return;
    }

    const filters = parseSmartQuery(query);
    const hasAnyFilter = Object.values(filters).some(Boolean);

    if (!hasAnyFilter) {
      setError(t("smartSearchAssistant.errors.failed"));
      setDetectedFilters(null);
      return;
    }

    setError("");
    setDetectedFilters(filters);
    navigate(buildSearchUrl(filters));
  };

  const handleClear = () => {
    setQuery("");
    setDetectedFilters(null);
    setError("");
  };

  const handleExample = (text) => {
    const filters = parseSmartQuery(text);

    setQuery(text);
    setError("");
    setDetectedFilters(filters);
  };

  const formatAny = () => {
    return t("searchBar.options.any");
  };

  const formatType = (value) => {
    if (!value) return formatAny();
    return t(`listFilter.values.type.${value}`);
  };

  const formatProperty = (value) => {
    if (!value) return formatAny();
    return t(`listFilter.values.property.${value}`);
  };

  const formatCity = (value) => {
    return value || formatAny();
  };

  return (
    <div className="smartSearchAssistant">
      <div className="smartHeader">
        <span>{t("smartSearchAssistant.header.badge")}</span>

        <h2>{t("smartSearchAssistant.header.title")}</h2>

        <p>{t("smartSearchAssistant.header.description")}</p>
      </div>

      <div className="smartInputBox">
        <textarea
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError("");
            setDetectedFilters(null);
          }}
          placeholder={t("smartSearchAssistant.input.placeholder")}
        ></textarea>

        <div className="smartActions">
          <button
            type="button"
            className="searchBtn"
            onClick={handleSearch}
            disabled={!query.trim()}
          >
            {t("smartSearchAssistant.buttons.search")}
          </button>

          <button type="button" onClick={handleClear}>
            {t("smartSearchAssistant.buttons.clear")}
          </button>
        </div>
      </div>

      <div className="smartExamples">
        <button
          type="button"
          onClick={() => handleExample(t("smartSearchAssistant.examples.one"))}
        >
          {t("smartSearchAssistant.examples.one")}
        </button>

        <button
          type="button"
          onClick={() => handleExample(t("smartSearchAssistant.examples.two"))}
        >
          {t("smartSearchAssistant.examples.two")}
        </button>

        <button
          type="button"
          onClick={() => handleExample(t("smartSearchAssistant.examples.three"))}
        >
          {t("smartSearchAssistant.examples.three")}
        </button>
      </div>

      {error && <div className="smartError">{error}</div>}

      {detectedFilters && (
        <div className="detectedBox">
          <h3>{t("smartSearchAssistant.detected.title")}</h3>

          <div className="detectedGrid">
            <div>
              <span>{t("smartSearchAssistant.detected.city")}</span>
              <b>{formatCity(detectedFilters.city)}</b>
            </div>

            <div>
              <span>{t("smartSearchAssistant.detected.type")}</span>
              <b>{formatType(detectedFilters.type)}</b>
            </div>

            <div>
              <span>{t("smartSearchAssistant.detected.property")}</span>
              <b>{formatProperty(detectedFilters.property)}</b>
            </div>

            <div>
              <span>{t("smartSearchAssistant.detected.bedrooms")}</span>
              <b>{detectedFilters.bedroom || formatAny()}</b>
            </div>

            <div>
              <span>{t("listFilter.labels.bathrooms")}</span>
              <b>{detectedFilters.bathroom || formatAny()}</b>
            </div>

            <div>
              <span>{t("smartSearchAssistant.detected.minPrice")}</span>
              <b>{detectedFilters.minPrice || formatAny()}</b>
            </div>

            <div>
              <span>{t("smartSearchAssistant.detected.maxPrice")}</span>
              <b>{detectedFilters.maxPrice || formatAny()}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSearchAssistant;