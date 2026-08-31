import prisma from "./prisma.js";

const PROPERTY_COLLECTION = "Property";
const TEXT_SEARCH_LIMIT = 5000;

const INDEXES = [
  {
    name: "Property_text_title_address_city",
    key: { title: "text", address: "text", city: "text" },
    default_language: "none",
    weights: { title: 10, city: 6, address: 3 },
  },
];

const toObjectIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value)) {
    return value;
  }

  if (typeof value === "object") {
    if (typeof value.$oid === "string") {
      return value.$oid;
    }

    if (typeof value.toString === "function") {
      const asString = value.toString();
      if (/^[0-9a-fA-F]{24}$/.test(asString)) {
        return asString;
      }
    }
  }

  return null;
};

const toTextSearchQuery = (keyword) => {
  const tokens = String(keyword || "")
    .replace(/["\\]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+/, ""))
    .filter(Boolean);

  return tokens.length ? tokens.join(" ") : null;
};

const extractRawDocuments = (result) => {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.cursor?.firstBatch)) {
    return result.cursor.firstBatch;
  }

  if (Array.isArray(result?.cursor?.batch)) {
    return result.cursor.batch;
  }

  return [];
};

export const ensurePropertySearchIndexes = async () => {
  try {
    await prisma.$runCommandRaw({
      createIndexes: PROPERTY_COLLECTION,
      indexes: INDEXES,
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (
      message.includes("already exists") ||
      message.includes("IndexOptionsConflict") ||
      message.includes("IndexKeySpecsConflict")
    ) {
      return;
    }

    console.error("Property search index setup failed:", message);
  }
};

/**
 * Uses the MongoDB text index. Returns null if the index is missing so callers
 * can fall back to regex contains.
 */
export const findPropertyIdsByTextSearch = async (keyword) => {
  const search = toTextSearchQuery(keyword);

  if (!search) {
    return [];
  }

  try {
    const result = await prisma.property.findRaw({
      filter: {
        $text: {
          $search: search,
        },
      },
      options: {
        projection: {
          _id: 1,
        },
        limit: TEXT_SEARCH_LIMIT,
      },
    });

    return [
      ...new Set(
        extractRawDocuments(result)
          .map((doc) => toObjectIdString(doc?._id))
          .filter(Boolean)
      ),
    ];
  } catch (error) {
    const message = String(error?.message || error);

    if (
      message.includes("text index required") ||
      message.includes("text index") ||
      message.includes("unknown operator: $text")
    ) {
      return null;
    }

    console.error("Property text search failed:", message);
    return null;
  }
};
