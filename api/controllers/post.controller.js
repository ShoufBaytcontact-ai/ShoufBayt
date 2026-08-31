import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import {
  assertAgentSubscriptionAccess,
  getSelfListingQuota,
} from "../lib/subscription.js";
import { SESSION_IDLE_JWT } from "../lib/sessionIdle.js";
import { createNotification } from "../lib/notify.js";
import { findPropertyIdsByTextSearch } from "../lib/ensureSearchIndexes.js";

/* =========================================================
   CONSTANTS
========================================================= */

const PROPERTY_TYPES = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "VILLA",
  "OFFICE",
  "SHOP",
  "WAREHOUSE",
];

const LISTING_TYPES = [
  "SALE",
  "RENT",
];

const PROPERTY_STATUSES = [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "SOLD",
  "RENTED",
  "ARCHIVED",
];

const SORT_OPTIONS = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "popular",
];

/* =========================================================
   BASIC HELPERS
========================================================= */

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    /^[0-9a-fA-F]{24}$/.test(id)
  );
};

const normalizeId = (id) => {
  return String(id || "").trim();
};

const hasValue = (value) => {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ""
  );
};

const cleanString = (value) => {
  if (!hasValue(value)) {
    return undefined;
  }

  return String(value).trim();
};

const cleanNullableString = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const cleaned = String(value).trim();

  return cleaned || null;
};

/* =========================================================
   JSON PARSING
========================================================= */

const parseJsonField = (
  value,
  fieldName
) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(
      `${fieldName} must be valid JSON`
    );

    error.status = 400;

    throw error;
  }
};

/* =========================================================
   NUMBER PARSING
========================================================= */

const toNumber = (
  value,
  fieldName
) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    const error = new Error(
      `${fieldName} must be a valid number`
    );

    error.status = 400;

    throw error;
  }

  return number;
};

const toPositiveNumber = (
  value,
  fieldName
) => {
  const number = toNumber(
    value,
    fieldName
  );

  if (number <= 0) {
    const error = new Error(
      `${fieldName} must be greater than 0`
    );

    error.status = 400;

    throw error;
  }

  return number;
};

const toNonNegativeInteger = (
  value,
  fieldName
) => {
  const number = toNumber(
    value,
    fieldName
  );

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    const error = new Error(
      `${fieldName} must be 0 or more`
    );

    error.status = 400;

    throw error;
  }

  return number;
};

const toPositiveInteger = (
  value,
  fieldName
) => {
  const number =
    toNonNegativeInteger(
      value,
      fieldName
    );

  if (number < 1) {
    const error = new Error(
      `${fieldName} must be at least 1`
    );

    error.status = 400;

    throw error;
  }

  return number;
};

/* =========================================================
   BOOLEAN PARSING
========================================================= */

const toBoolean = (
  value,
  fieldName
) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(
    value
  )
    .trim()
    .toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  const error = new Error(
    `${fieldName} must be true or false`
  );

  error.status = 400;

  throw error;
};

const toOptionalBoolean = (
  value,
  fieldName
) => {
  if (!hasValue(value)) {
    return undefined;
  }

  return toBoolean(
    value,
    fieldName
  );
};

/* =========================================================
   ENUM NORMALIZATION
========================================================= */

const normalizeListingType = (
  value
) => {
  const normalized = cleanString(
    value
  )?.toUpperCase();

  if (!normalized) {
    return undefined;
  }

  // Compatibility with the old frontend
  if (normalized === "BUY") {
    return "SALE";
  }

  if (
    LISTING_TYPES.includes(
      normalized
    )
  ) {
    return normalized;
  }

  const error = new Error(
    "Invalid listing type"
  );

  error.status = 400;

  throw error;
};

const normalizePropertyType = (
  value
) => {
  const normalized = cleanString(
    value
  )?.toUpperCase();

  if (!normalized) {
    return undefined;
  }

  if (
    PROPERTY_TYPES.includes(
      normalized
    )
  ) {
    return normalized;
  }

  const error = new Error(
    "Invalid property type"
  );

  error.status = 400;

  throw error;
};

const normalizePropertyStatus = (
  value
) => {
  const normalized = cleanString(
    value
  )?.toUpperCase();

  if (!normalized) {
    return undefined;
  }

  // Compatibility with old frontend values
  const statusMap = {
    AVAILABLE: "PUBLISHED",
    SOLD: "SOLD",
    RENTED: "RENTED",
  };

  const finalStatus =
    statusMap[normalized] ||
    normalized;

  if (
    PROPERTY_STATUSES.includes(
      finalStatus
    )
  ) {
    return finalStatus;
  }

  const error = new Error(
    "Invalid property status"
  );

  error.status = 400;

  throw error;
};

/* =========================================================
   IMAGE HELPERS
========================================================= */

const getImageUrl = (
  req,
  file
) => {
  if (!file) {
    return "";
  }

  if (file.secure_url) {
    return file.secure_url;
  }

  if (file.url) {
    return file.url;
  }

  if (
    file.path &&
    /^https?:\/\//i.test(file.path)
  ) {
    return file.path;
  }

  if (file.filename) {
    return "";
  }

  return file.path || "";
};

const getUploadedImages = (
  req
) => {
  const files = Array.isArray(
    req.files
  )
    ? req.files
    : [];

  return files
    .filter((file) => {
      return (
        !file.fieldname ||
        file.fieldname === "images"
      );
    })
    .map((file) =>
      getImageUrl(req, file)
    )
    .filter(Boolean);
};

const sanitizeImageArray = (
  images
) => {
  if (!Array.isArray(images)) {
    return [];
  }

  return [
    ...new Set(
      images
        .filter(
          (image) =>
            typeof image ===
              "string" &&
            image.trim()
        )
        .map((image) =>
          image.trim()
        )
    ),
  ].slice(0, 20);
};

/* =========================================================
   USER AND AUTH HELPERS
========================================================= */

const getLoggedUser = async (
  userId
) => {
  if (!isValidObjectId(userId)) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      role: true,
      status: true,
      emailVerified: true,

      agentProfile: {
        select: {
          id: true,
          isVerified: true,
        },
      },
    },
  });
};

const sameUserId = (left, right) =>
  Boolean(left) && Boolean(right) && String(left) === String(right);

const canModifyProperty = (property, user) => {
  if (!property || !user) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  return (
    sameUserId(property.userId, user.id) ||
    sameUserId(property.requestedByUserId, user.id)
  );
};

const canDeleteProperty = (property, user) => {
  if (!property || !user) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  return sameUserId(property.userId, user.id);
};

const canCreateProperty = (
  user
) => {
  if (!user) {
    return false;
  }

  if (
    user.status !== "ACTIVE"
  ) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  if (
    user.role === "AGENT" &&
    user.agentProfile
  ) {
    return true;
  }

  return user.role === "USER";
};

const canPublishImmediately = (user) => {
  if (!user || user.status !== "ACTIVE") {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  return user.role === "AGENT" && Boolean(user.agentProfile);
};

const notifyAdminsOfPendingListing = async (property) => {
  if (!property?.id) {
    return;
  }

  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "GENERAL",
        title: "Listing waiting for review",
        message: `"${property.title}" was submitted and needs approval before it goes live.`,
        link: "/admin",
        metadata: {
          propertyId: property.id,
          kind: "PENDING_LISTING",
        },
      })
    )
  );
};

const isPublicListingAgent = (user) => {
  const role = String(user?.role || "").toUpperCase();
  const status = String(user?.status || "").toUpperCase();

  return status === "ACTIVE" && (role === "AGENT" || role === "ADMIN");
};

/* =========================================================
   TOKEN HELPER
========================================================= */

const getOptionalAuthenticatedUserId = (
  req
) => {
  if (
    req.userId &&
    isValidObjectId(req.userId)
  ) {
    return req.userId;
  }

  const token =
    req.cookies?.token;

  if (
    !token ||
    !process.env.JWT_SECRET_KEY
  ) {
    return null;
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY,
      { maxAge: SESSION_IDLE_JWT }
    );

    const id = normalizeId(
      payload.id ||
        payload.userId
    );

    return isValidObjectId(id)
      ? id
      : null;
  } catch {
    return null;
  }
};

/* =========================================================
   QUERY HELPERS
========================================================= */

const getPagination = (
  query
) => {
  const page = hasValue(query.page)
    ? toPositiveInteger(
        query.page,
        "Page"
      )
    : 1;

  const limit = hasValue(
    query.limit
  )
    ? toPositiveInteger(
        query.limit,
        "Limit"
      )
    : 10;

  const safeLimit =
    Math.min(limit, 100);

  return {
    page,
    limit: safeLimit,
    skip:
      (page - 1) * safeLimit,
  };
};

const getSortOrder = (
  sort
) => {
  const normalized = cleanString(
    sort
  )?.toLowerCase();

  if (
    normalized &&
    !SORT_OPTIONS.includes(
      normalized
    )
  ) {
    const error = new Error(
      "Invalid sort option"
    );

    error.status = 400;

    throw error;
  }

  switch (normalized) {
    case "oldest":
      return {
        createdAt: "asc",
      };

    case "price_asc":
      return {
        price: "asc",
      };

    case "price_desc":
      return {
        price: "desc",
      };

    case "popular":
      return {
        views: "desc",
      };

    case "newest":
    default:
      return {
        createdAt: "desc",
      };
  }
};

/* =========================================================
   PROPERTY DATA PARSING
========================================================= */

const getPropertyPayload = (
  req
) => {
  const propertyData =
    req.body.propertyData !==
    undefined
      ? parseJsonField(
          req.body.propertyData,
          "propertyData"
        )
      : req.body.postData !==
          undefined
        ? parseJsonField(
            req.body.postData,
            "postData"
          )
        : req.body;

  const detailData =
    req.body.detail !== undefined
      ? parseJsonField(
          req.body.detail,
          "detail"
        )
      : req.body.propertyDetail !==
          undefined
        ? parseJsonField(
            req.body.propertyDetail,
            "propertyDetail"
          )
        : req.body.postDetail !==
            undefined
          ? parseJsonField(
              req.body.postDetail,
              "postDetail"
            )
          : req.body;

  return {
    propertyData:
      propertyData || {},
    detailData:
      detailData || {},
  };
};

/* =========================================================
   ERROR HANDLER
========================================================= */

const handleControllerError = (
  res,
  error,
  fallbackMessage
) => {
  console.error(
    fallbackMessage.toUpperCase(),
    error
  );

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  if (error?.code === "P2002") {
    return res.status(409).json({
      message:
        "A record with the same unique value already exists",
    });
  }

  return res
    .status(error.status || 500)
    .json({
      message: error.status
        ? error.message
        : fallbackMessage,
    });
};

/* =========================================================
   SLUG + RESPONSE HELPERS
========================================================= */

const slugify = (value) => {
  return cleanString(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "property";
};

const createUniqueSlug = async (title) => {
  const base = slugify(title);
  let slug = base;
  let counter = 1;

  while (
    await prisma.property.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    })
  ) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
};

const propertyInclude = {
  detail: true,

  user: {
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      phone: true,
      role: true,
      status: true,

      agentProfile: {
        select: {
          id: true,
          name: true,
          agencyName: true,
          phone: true,
          image: true,
          isVerified: true,
          rating: true,
          totalReviews: true,
        },
      },
    },
  },

  _count: {
    select: {
      savedBy: true,
      reports: true,
      reviews: true,
    },
  },
};

const listPropertyInclude = {
  detail: true,
  user: {
    select: {
      id: true,
      username: true,
      avatar: true,
      phone: true,
      role: true,
      status: true,
      agentProfile: {
        select: {
          id: true,
          name: true,
          agencyName: true,
          phone: true,
          image: true,
          isVerified: true,
          rating: true,
          totalReviews: true,
        },
      },
    },
  },
  _count: {
    select: {
      savedBy: true,
      reviews: true,
    },
  },
};

function pickListingPhone(user) {
  if (!user || typeof user !== "object") {
    return "";
  }

  const nested = Object.values(user).find(
    (value) => value && typeof value === "object" && !Array.isArray(value) && value.phone
  );

  return String(user.phone || nested?.phone || "").trim();
}

const formatPropertyResponse = (property, extras = {}) => {
  if (!property) {
    return null;
  }

  const listingPhone = pickListingPhone(property.user);

  return {
    ...property,
    listingPhone,

    // Compatibility aliases for older frontend
    postDetail: property.detail || null,
    bedroom: property.bedrooms,
    bathroom: property.bathrooms,
    size: property.area,
    type:
      property.listingType === "SALE"
        ? "buy"
        : property.listingType?.toLowerCase(),
    property: property.propertyType?.toLowerCase(),

    ...extras,
  };
};

const buildPropertyFilters = (query) => {
  const filters = {};

  const city = cleanString(query.city);
  if (city) {
    // Prefix match can use the city index; mid-string regex cannot.
    filters.city = {
      startsWith: city,
    };
  }

  const keyword = cleanString(query.q || query.keyword);
  if (keyword) {
    filters.OR = [
      { title: { contains: keyword } },
      { address: { contains: keyword } },
      { city: { contains: keyword } },
    ];
  }

  const listingType = normalizeListingType(
    query.listingType || query.type
  );
  if (listingType) {
    filters.listingType = listingType;
  }

  const propertyType = normalizePropertyType(
    query.propertyType || query.property
  );
  if (propertyType) {
    filters.propertyType = propertyType;
  }

  if (hasValue(query.bedrooms || query.bedroom)) {
    filters.bedrooms = {
      gte: toNonNegativeInteger(
        query.bedrooms || query.bedroom,
        "Bedrooms"
      ),
    };
  }

  if (hasValue(query.bathrooms || query.bathroom)) {
    filters.bathrooms = {
      gte: toNonNegativeInteger(
        query.bathrooms || query.bathroom,
        "Bathrooms"
      ),
    };
  }

  const minPrice = hasValue(query.minPrice)
    ? toNonNegativeInteger(query.minPrice, "Min price")
    : undefined;
  const maxPrice = hasValue(query.maxPrice)
    ? toPositiveInteger(query.maxPrice, "Max price")
    : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filters.price = {};

    if (minPrice !== undefined) {
      filters.price.gte = minPrice;
    }

    if (maxPrice !== undefined) {
      filters.price.lte = maxPrice;
    }
  }

  const minSize = hasValue(query.minSize || query.minArea)
    ? toNonNegativeInteger(query.minSize || query.minArea, "Min size")
    : undefined;
  const maxSize = hasValue(query.maxSize || query.maxArea)
    ? toPositiveInteger(query.maxSize || query.maxArea, "Max size")
    : undefined;

  if (minSize !== undefined || maxSize !== undefined) {
    filters.area = {};

    if (minSize !== undefined) {
      filters.area.gte = minSize;
    }

    if (maxSize !== undefined) {
      filters.area.lte = maxSize;
    }
  }

  const status = normalizePropertyStatus(query.status);
  if (status) {
    filters.status = status;
  } else if (query.includeClosed === "false") {
    filters.status = "PUBLISHED";
  } else {
    // Keep sold/rented visible on the public listing with a Sold/Rented badge
    filters.status = {
      in: ["PUBLISHED", "SOLD", "RENTED"],
    };
  }

  const featured = toOptionalBoolean(query.featured, "Featured");
  if (featured !== undefined) {
    filters.featured = featured;
  }

  const userId = cleanString(query.userId || query.agentId);
  if (userId) {
    if (!isValidObjectId(userId)) {
      const error = new Error("Invalid agent/user ID");
      error.status = 400;
      throw error;
    }

    filters.userId = userId;
  }

  return filters;
};

/* =========================================================
   GET PROPERTIES (PUBLIC)
========================================================= */

export const getPosts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const where = buildPropertyFilters(req.query);
    const orderBy = getSortOrder(req.query.sort);
    const keyword = cleanString(req.query.q || req.query.keyword);

    if (keyword) {
      const textMatchIds = await findPropertyIdsByTextSearch(keyword);

      // Word-level text index first. If it finds nothing, keep substring
      // contains so partial tokens like "villa" still match "villafor".
      if (Array.isArray(textMatchIds) && textMatchIds.length > 0) {
        delete where.OR;
        where.id = { in: textMatchIds };
      }
    }

    let properties = [];
    let total = 0;

    const queryOptions = {
      where,
      include: listPropertyInclude,
      orderBy,
      skip,
      take: limit,
    };

    try {
      [properties, total] = await Promise.all([
        prisma.property.findMany(queryOptions),
        prisma.property.count({
          where,
        }),
      ]);
    } catch (relationError) {
      // Orphaned Property.userId can make Prisma reject the whole findMany
      console.error(
        "GET PROPERTIES include failed, falling back:",
        relationError.message
      );

      const { user: _listingAgentFilter, ...whereWithoutUser } = where;

      const bare = await prisma.property.findMany({
        where: whereWithoutUser,
        include: {
          detail: true,
          _count: {
            select: {
              savedBy: true,
              reviews: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      const userIds = [...new Set(bare.map((item) => item.userId).filter(Boolean))];
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: propertyInclude.user.select,
          })
        : [];
      const usersById = Object.fromEntries(users.map((user) => [user.id, user]));

      properties = bare
        .filter((item) => usersById[item.userId])
        .map((item) => ({
          ...item,
          user: usersById[item.userId],
        }));
      total = await prisma.property.count({
        where: whereWithoutUser,
      });
    }

    const formatted = properties
      .map((property) => formatPropertyResponse(property));

    return res.status(200).json({
      items: formatted,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("GET PROPERTIES ERROR:", error);

    if (error.status === 400) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to get properties",
    });
  }
};

/* =========================================================
   GET SINGLE PROPERTY
========================================================= */

export const getPost = async (req, res) => {
  const idOrSlug = normalizeId(req.params.id);

  try {
    if (!idOrSlug) {
      return res.status(400).json({
        message: "Property ID is required",
      });
    }

    const where = isValidObjectId(idOrSlug)
      ? {
          OR: [
            {
              id: idOrSlug,
            },
            {
              slug: idOrSlug,
            },
          ],
        }
      : {
          slug: idOrSlug,
        };

    const property = await prisma.property.findFirst({
      where,
      include: {
        ...propertyInclude,
        reviews: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            reviewer: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    const tokenUserId = getOptionalAuthenticatedUserId(req);
    const statusUpper = String(property.status || "").toUpperCase();
    const isPubliclyListed = ["PUBLISHED", "SOLD", "RENTED"].includes(
      statusUpper
    );
    const canViewPrivateListing =
      Boolean(tokenUserId) &&
      (tokenUserId === property.userId ||
        tokenUserId === property.requestedByUserId);

    if (!isPubliclyListed && !canViewPrivateListing) {
      const viewer = tokenUserId ? await getLoggedUser(tokenUserId) : null;
      if (viewer?.role !== "ADMIN") {
        return res.status(404).json({
          message:
            statusUpper === "SOLD" || statusUpper === "RENTED"
              ? "This listing is no longer available"
              : "Property not found",
        });
      }
    }

    // Increment views (best-effort)
    prisma.property
      .update({
        where: {
          id: property.id,
        },
        data: {
          views: {
            increment: 1,
          },
        },
      })
      .catch(() => {});

    let isSaved = false;

    if (tokenUserId) {
      const saved = await prisma.savedProperty.findUnique({
        where: {
          userId_propertyId: {
            userId: tokenUserId,
            propertyId: property.id,
          },
        },
        select: {
          id: true,
        },
      });

      isSaved = Boolean(saved);
    }

    return res.status(200).json(
      formatPropertyResponse(property, {
        isSaved,
        views: (property.views || 0) + 1,
      })
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to get property"
    );
  }
};

/* =========================================================
   CREATE PROPERTY
========================================================= */

export const addPost = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);

  try {
    const user = await getLoggedUser(tokenUserId);

    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!canCreateProperty(user)) {
      return res.status(403).json({
        message: "Your account cannot create listings.",
        code: "LISTING_CREATE_FORBIDDEN",
      });
    }

    if (user.role === "AGENT") {
      try {
        await assertAgentSubscriptionAccess(tokenUserId);
      } catch (subscriptionError) {
        return res.status(subscriptionError.status || 403).json({
          message:
            subscriptionError.message ||
            "Active subscription required to create listings",
          code: subscriptionError.code || "SUBSCRIPTION_REQUIRED",
        });
      }
    }

    if (user.role === "USER") {
      const listingQuota = await getSelfListingQuota(tokenUserId);

      if (!listingQuota.allowed) {
        return res.status(403).json({
          message:
            "You've used your free self-listing. Subscribe to Premium ($" +
            listingQuota.priceMonthly +
            "/month) to list again yourself, or ask an agent to list for you.",
          code: "SELF_LISTING_LIMIT",
          listingQuota,
        });
      }
    }

    const { propertyData, detailData } = getPropertyPayload(req);

    const title = cleanString(
      propertyData.title || req.body.title
    );
    const address = cleanString(
      propertyData.address || req.body.address
    );
    const city = cleanString(
      propertyData.city || req.body.city
    );

    const price = toPositiveInteger(
      propertyData.price ?? req.body.price,
      "Price"
    );

    const bedrooms = toNonNegativeInteger(
      propertyData.bedrooms ??
        propertyData.bedroom ??
        req.body.bedrooms ??
        req.body.bedroom,
      "Bedrooms"
    );

    const bathrooms = toNonNegativeInteger(
      propertyData.bathrooms ??
        propertyData.bathroom ??
        req.body.bathrooms ??
        req.body.bathroom,
      "Bathrooms"
    );

    const latitude = toNumber(
      propertyData.latitude ?? req.body.latitude,
      "Latitude"
    );

    const longitude = toNumber(
      propertyData.longitude ?? req.body.longitude,
      "Longitude"
    );

    const listingType = normalizeListingType(
      propertyData.listingType ||
        propertyData.type ||
        req.body.listingType ||
        req.body.type
    );

    const propertyType = normalizePropertyType(
      propertyData.propertyType ||
        propertyData.property ||
        req.body.propertyType ||
        req.body.property
    );

    if (!title || !address || !city) {
      return res.status(400).json({
        message: "Title, address, and city are required",
      });
    }

    if (!listingType || !propertyType) {
      return res.status(400).json({
        message: "Listing type and property type are required",
      });
    }

    const areaValue =
      propertyData.area ??
      detailData.area ??
      detailData.size ??
      req.body.area ??
      req.body.size;

    const area = hasValue(areaValue)
      ? toPositiveInteger(areaValue, "Area")
      : null;

    const description = cleanString(
      detailData.description ||
        detailData.desc ||
        req.body.description ||
        req.body.desc
    );

    if (!description) {
      return res.status(400).json({
        message: "Description is required",
      });
    }

    const amenitiesRaw =
      detailData.amenities ?? req.body.amenities ?? [];

    const amenities = Array.isArray(amenitiesRaw)
      ? amenitiesRaw.map((item) => cleanString(item)).filter(Boolean)
      : [];

    const uploadedImages = getUploadedImages(req);
    const bodyImages = sanitizeImageArray(
      parseJsonField(
        propertyData.images ?? req.body.images ?? req.body.existingImages,
        "images"
      ) || []
    );

    const images = sanitizeImageArray([
      ...bodyImages,
      ...uploadedImages,
    ]);

    if (images.length === 0) {
      return res.status(400).json({
        message: "At least one image is required",
      });
    }

    const slug = await createUniqueSlug(title);

    const initialStatus = canPublishImmediately(user)
      ? "PUBLISHED"
      : "PENDING";

    const property = await prisma.property.create({
      data: {
        slug,
        title,
        price,
        images,
        address,
        city,
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        area,
        propertyType,
        listingType,
        status: initialStatus,
        publishedAt:
          initialStatus === "PUBLISHED" ? new Date() : null,
        userId: tokenUserId,

        detail: {
          create: {
            description,
            yearBuilt: hasValue(detailData.yearBuilt)
              ? toPositiveInteger(detailData.yearBuilt, "Year built")
              : null,
            floor: hasValue(detailData.floor)
              ? toNonNegativeInteger(detailData.floor, "Floor")
              : null,
            totalFloors: hasValue(detailData.totalFloors)
              ? toPositiveInteger(
                  detailData.totalFloors,
                  "Total floors"
                )
              : null,
            amenities,
          },
        },
      },
      include: propertyInclude,
    });

    if (initialStatus === "PENDING") {
      await notifyAdminsOfPendingListing(property);
    }

    return res.status(201).json(formatPropertyResponse(property));
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to create property"
    );
  }
};

/* =========================================================
   UPDATE PROPERTY
========================================================= */

export const updatePost = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const propertyId = normalizeId(req.params.id);

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    const user = await getLoggedUser(tokenUserId);

    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const existing = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      include: {
        detail: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    if (!canModifyProperty(existing, user)) {
      return res.status(403).json({
        message: "You are not allowed to edit this property",
      });
    }

    const { propertyData, detailData } = getPropertyPayload(req);

    const data = {};

    if (hasValue(propertyData.title ?? req.body.title)) {
      data.title = cleanString(propertyData.title ?? req.body.title);
    }

    if (hasValue(propertyData.price ?? req.body.price)) {
      data.price = toPositiveInteger(
        propertyData.price ?? req.body.price,
        "Price"
      );
    }

    if (hasValue(propertyData.address ?? req.body.address)) {
      data.address = cleanString(
        propertyData.address ?? req.body.address
      );
    }

    if (hasValue(propertyData.city ?? req.body.city)) {
      data.city = cleanString(propertyData.city ?? req.body.city);
    }

    if (
      hasValue(
        propertyData.bedrooms ??
          propertyData.bedroom ??
          req.body.bedrooms ??
          req.body.bedroom
      )
    ) {
      data.bedrooms = toNonNegativeInteger(
        propertyData.bedrooms ??
          propertyData.bedroom ??
          req.body.bedrooms ??
          req.body.bedroom,
        "Bedrooms"
      );
    }

    if (
      hasValue(
        propertyData.bathrooms ??
          propertyData.bathroom ??
          req.body.bathrooms ??
          req.body.bathroom
      )
    ) {
      data.bathrooms = toNonNegativeInteger(
        propertyData.bathrooms ??
          propertyData.bathroom ??
          req.body.bathrooms ??
          req.body.bathroom,
        "Bathrooms"
      );
    }

    if (hasValue(propertyData.latitude ?? req.body.latitude)) {
      data.latitude = toNumber(
        propertyData.latitude ?? req.body.latitude,
        "Latitude"
      );
    }

    if (hasValue(propertyData.longitude ?? req.body.longitude)) {
      data.longitude = toNumber(
        propertyData.longitude ?? req.body.longitude,
        "Longitude"
      );
    }

    if (
      hasValue(
        propertyData.listingType ||
          propertyData.type ||
          req.body.listingType ||
          req.body.type
      )
    ) {
      data.listingType = normalizeListingType(
        propertyData.listingType ||
          propertyData.type ||
          req.body.listingType ||
          req.body.type
      );
    }

    if (
      hasValue(
        propertyData.propertyType ||
          propertyData.property ||
          req.body.propertyType ||
          req.body.property
      )
    ) {
      data.propertyType = normalizePropertyType(
        propertyData.propertyType ||
          propertyData.property ||
          req.body.propertyType ||
          req.body.property
      );
    }

    const areaValue =
      propertyData.area ??
      detailData.area ??
      detailData.size ??
      req.body.area ??
      req.body.size;

    if (hasValue(areaValue)) {
      data.area = toPositiveInteger(areaValue, "Area");
    }

    let keptImages = existing.images || [];

    if (
      propertyData.existingImages !== undefined ||
      req.body.existingImages !== undefined
    ) {
      keptImages = sanitizeImageArray(
        parseJsonField(
          propertyData.existingImages ?? req.body.existingImages,
          "existingImages"
        ) || []
      );
    }

    const uploadedImages = getUploadedImages(req);

    if (
      propertyData.existingImages !== undefined ||
      req.body.existingImages !== undefined ||
      uploadedImages.length > 0 ||
      propertyData.images !== undefined
    ) {
      const bodyImages = sanitizeImageArray(
        parseJsonField(
          propertyData.images ?? req.body.images,
          "images"
        ) || []
      );

      data.images = sanitizeImageArray([
        ...keptImages,
        ...bodyImages,
        ...uploadedImages,
      ]);

      if (data.images.length === 0) {
        return res.status(400).json({
          message: "At least one image is required",
        });
      }
    }

    if (data.title && data.title !== existing.title) {
      data.slug = await createUniqueSlug(data.title);
    }

    const updatedProperty = await prisma.property.update({
      where: {
        id: propertyId,
      },
      data,
    });

    const detailUpdate = {};

    const description = cleanNullableString(
      detailData.description ??
        detailData.desc ??
        req.body.description ??
        req.body.desc
    );

    if (description !== undefined) {
      detailUpdate.description = description || existing.detail?.description || "";
    }

    if (detailData.yearBuilt !== undefined || req.body.yearBuilt !== undefined) {
      const yearBuilt = detailData.yearBuilt ?? req.body.yearBuilt;
      detailUpdate.yearBuilt = hasValue(yearBuilt)
        ? toPositiveInteger(yearBuilt, "Year built")
        : null;
    }

    if (detailData.floor !== undefined || req.body.floor !== undefined) {
      const floor = detailData.floor ?? req.body.floor;
      detailUpdate.floor = hasValue(floor)
        ? toNonNegativeInteger(floor, "Floor")
        : null;
    }

    if (
      detailData.totalFloors !== undefined ||
      req.body.totalFloors !== undefined
    ) {
      const totalFloors = detailData.totalFloors ?? req.body.totalFloors;
      detailUpdate.totalFloors = hasValue(totalFloors)
        ? toPositiveInteger(totalFloors, "Total floors")
        : null;
    }

    if (
      detailData.amenities !== undefined ||
      req.body.amenities !== undefined
    ) {
      const amenitiesRaw = detailData.amenities ?? req.body.amenities;
      detailUpdate.amenities = Array.isArray(amenitiesRaw)
        ? amenitiesRaw.map((item) => cleanString(item)).filter(Boolean)
        : [];
    }

    let detail = existing.detail;

    if (Object.keys(detailUpdate).length > 0) {
      detail = await prisma.propertyDetail.upsert({
        where: {
          propertyId,
        },
        update: detailUpdate,
        create: {
          propertyId,
          description:
            detailUpdate.description ||
            existing.detail?.description ||
            "",
          yearBuilt: detailUpdate.yearBuilt ?? null,
          floor: detailUpdate.floor ?? null,
          totalFloors: detailUpdate.totalFloors ?? null,
          amenities: detailUpdate.amenities || [],
        },
      });
    }

    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      include: propertyInclude,
    });

    return res.status(200).json(
      formatPropertyResponse(property || {
        ...updatedProperty,
        detail,
      })
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to update property"
    );
  }
};

/* =========================================================
   DELETE PROPERTY
========================================================= */

export const deletePost = async (req, res) => {
  const propertyId = normalizeId(req.params.id);
  const tokenUserId = normalizeId(req.userId);

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    const user = await getLoggedUser(tokenUserId);

    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    if (!canDeleteProperty(property, user)) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    await prisma.savedProperty.deleteMany({
      where: {
        propertyId,
      },
    });

    await prisma.propertyReview.deleteMany({
      where: {
        propertyId,
      },
    });

    await prisma.propertyReport.deleteMany({
      where: {
        propertyId,
      },
    });

    await prisma.propertyDetail.deleteMany({
      where: {
        propertyId,
      },
    });

    await prisma.chat.updateMany({
      where: {
        propertyId,
      },
      data: {
        propertyId: null,
      },
    });

    await prisma.property.delete({
      where: {
        id: propertyId,
      },
    });

    return res.status(200).json({
      message: "Property has been deleted",
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to delete property"
    );
  }
};

/* =========================================================
   UPDATE PROPERTY STATUS
========================================================= */

export const updatePostStatus = async (req, res) => {
  const propertyId = normalizeId(req.params.id);
  const tokenUserId = normalizeId(req.userId);

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    const user = await getLoggedUser(tokenUserId);

    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const status = normalizePropertyStatus(
      req.body.status
    );

    if (!status) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    const isAdmin = user.role === "ADMIN";
    const isListingManager = sameUserId(property.userId, tokenUserId);
    const listingManagerAllowed = ["SOLD", "RENTED", "ARCHIVED", "PUBLISHED"];

    if (!isAdmin && !isListingManager) {
      return res.status(403).json({
        message: "Only the listing manager can update this property status",
      });
    }

    if (!isAdmin && !listingManagerAllowed.includes(status)) {
      return res.status(403).json({
        message: "You can mark a listing as available, sold, rented, or archived",
      });
    }

    if (
      !isAdmin &&
      status === "PUBLISHED" &&
      ["PENDING", "REJECTED"].includes(String(property.status || "").toUpperCase())
    ) {
      return res.status(403).json({
        message: "This listing is waiting for admin approval before it can go live",
        code: "ADMIN_APPROVAL_REQUIRED",
      });
    }

    if (
      property.listingType === "SALE" &&
      status === "RENTED"
    ) {
      return res.status(400).json({
        message: "A property for sale cannot be marked as rented",
      });
    }

    if (
      property.listingType === "RENT" &&
      status === "SOLD"
    ) {
      return res.status(400).json({
        message: "A property for rent cannot be marked as sold",
      });
    }

    const rejectionReason = cleanString(req.body.rejectionReason);

    if (status === "REJECTED" && isAdmin && !rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required",
      });
    }

    const updated = await prisma.property.update({
      where: {
        id: propertyId,
      },
      data: {
        status,
        publishedAt:
          status === "PUBLISHED"
            ? property.publishedAt || new Date()
            : property.publishedAt,
        rejectionReason:
          status === "REJECTED" ? rejectionReason : null,
        reviewedAt: isAdmin ? new Date() : property.reviewedAt,
        reviewedBy: isAdmin ? tokenUserId : property.reviewedBy,
      },
      include: propertyInclude,
    });

    if (isAdmin && (status === "PUBLISHED" || status === "REJECTED")) {
      const recipientIds = Array.from(
        new Set(
          [property.userId, property.requestedByUserId].filter(Boolean)
        )
      );
      const notice = {
        type:
          status === "PUBLISHED"
            ? "PROPERTY_APPROVED"
            : "PROPERTY_REJECTED",
        title:
          status === "PUBLISHED"
            ? "Listing approved"
            : "Listing not approved",
        message:
          status === "PUBLISHED"
            ? "Your listing is now live on ShoufBayt."
            : rejectionReason ||
              "Your listing was not approved.",
        link: `/properties/${updated.id}`,
        metadata: {
          propertyId: updated.id,
          status,
        },
      };

      await Promise.all(
        recipientIds.map((userId) =>
          createNotification({
            userId,
            ...notice,
          })
        )
      );
    }

    return res.status(200).json(formatPropertyResponse(updated));
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to update property status"
    );
  }
};
