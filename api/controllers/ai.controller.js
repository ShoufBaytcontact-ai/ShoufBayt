import prisma from "../lib/prisma.js";

const PROPERTY_TYPES = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "VILLA",
  "OFFICE",
  "SHOP",
  "WAREHOUSE",
];

const LISTING_TYPES = ["SALE", "RENT"];

const CONTACT_TYPES = ["MESSAGE", "REPORT"];

const CONTACT_STATUSES = [
  "OPEN",
  "READ",
  "RESOLVED",
];

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    /^[0-9a-fA-F]{24}$/.test(id)
  );
};

const cleanText = (
  value,
  fallback = ""
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
};

const escapeHtml = (value) => {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const parsePositiveNumber = (
  value,
  fallback = null
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return parsedValue;
};

const pickRandom = (items) => {
  return items[
    Math.floor(Math.random() * items.length)
  ];
};

const handleError = (
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

  return res.status(500).json({
    message: fallbackMessage,
  });
};

const checkAdmin = async (userId) => {
  if (!isValidObjectId(userId)) {
    return false;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        status: true,
      },
    });

  return (
    user?.role === "ADMIN" &&
    user?.status === "ACTIVE"
  );
};

const getPropertyLabel = (
  propertyType
) => {
  const normalizedType = cleanText(
    propertyType,
    "PROPERTY"
  ).toUpperCase();

  const labels = {
    APARTMENT: "apartment",
    HOUSE: "house",
    LAND: "land",
    VILLA: "villa",
    OFFICE: "office",
    SHOP: "shop",
    WAREHOUSE: "warehouse",
  };

  return labels[normalizedType] || "property";
};

const getListingLabel = (
  listingType
) => {
  const normalizedType = cleanText(
    listingType,
    "SALE"
  ).toUpperCase();

  if (normalizedType === "RENT") {
    return "for rent";
  }

  if (normalizedType === "SALE") {
    return "for sale";
  }

  return "available";
};

const formatPrice = (price) => {
  const parsedPrice =
    parsePositiveNumber(price);

  if (!parsedPrice) {
    return "a competitive price";
  }

  return `$${parsedPrice.toLocaleString(
    "en-US"
  )}`;
};

/* =========================================================
   PROPERTY DESCRIPTION GENERATOR
========================================================= */

export const generatePropertyDescription = async (
  req,
  res
) => {
  try {
    const title = cleanText(
      req.body.title,
      "This property"
    );

    const address = cleanText(
      req.body.address
    );

    const city = cleanText(
      req.body.city,
      "a prime location"
    );

    const price =
      parsePositiveNumber(
        req.body.price
      );

    const bedrooms =
      parsePositiveNumber(
        req.body.bedrooms ??
          req.body.bedroom
      );

    const bathrooms =
      parsePositiveNumber(
        req.body.bathrooms ??
          req.body.bathroom
      );

    const area =
      parsePositiveNumber(
        req.body.area ??
          req.body.size
      );

    const rawPropertyType =
      cleanText(
        req.body.propertyType ??
          req.body.property
      ).toUpperCase();

    const rawListingType =
      cleanText(
        req.body.listingType ??
          req.body.type
      ).toUpperCase();

    const normalizedPropertyType =
      PROPERTY_TYPES.includes(rawPropertyType)
        ? rawPropertyType
        : "APARTMENT";

    let normalizedListingType =
      rawListingType;

    // Compatibility with older frontend values
    if (rawListingType === "BUY") {
      normalizedListingType = "SALE";
    }

    if (
      !LISTING_TYPES.includes(
        normalizedListingType
      )
    ) {
      normalizedListingType = "SALE";
    }

    const propertyLabel =
      getPropertyLabel(
        normalizedPropertyType
      );

    const listingLabel =
      getListingLabel(
        normalizedListingType
      );

    const priceLabel =
      formatPrice(price);

    const safeTitle =
      escapeHtml(title);

    const safeCity =
      escapeHtml(city);

    const safeAddress =
      escapeHtml(
        address || city
      );

    let specifications = "";

    if (
      normalizedPropertyType ===
      "LAND"
    ) {
      specifications = area
        ? `The land offers approximately ${area.toLocaleString(
            "en-US"
          )}m², providing excellent flexibility for construction, investment, or future development.`
        : "The land provides excellent potential for construction, investment, or future development.";
    } else {
      const bedroomText = bedrooms
        ? `${bedrooms} bedroom${
            bedrooms === 1 ? "" : "s"
          }`
        : "comfortable rooms";

      const bathroomText = bathrooms
        ? `${bathrooms} bathroom${
            bathrooms === 1 ? "" : "s"
          }`
        : "practical bathroom space";

      const areaText = area
        ? `${area.toLocaleString(
            "en-US"
          )}m² of interior space`
        : "a practical interior layout";

      specifications =
        `The property includes ${bedroomText}, ` +
        `${bathroomText}, and approximately ${areaText}. ` +
        "Its layout makes it suitable for families, professionals, or investors.";
    }

    const features = [];

    // Schema-aligned amenities array (PropertyDetail.amenities)
    if (Array.isArray(req.body.amenities)) {
      for (const amenity of req.body.amenities) {
        const cleaned = cleanText(amenity);
        if (cleaned) {
          features.push(cleaned);
        }
      }
    }

    // Legacy boolean feature flags (kept for older frontend forms)
    const legacyFeatures = [
      ["furnished", "Furnished"],
      ["parking", "Parking"],
      ["balcony", "Balcony"],
      ["garden", "Garden"],
      ["pool", "Swimming pool"],
      ["elevator", "Elevator"],
    ];

    for (const [key, label] of legacyFeatures) {
      if (
        req.body[key] === true ||
        req.body[key] === "true"
      ) {
        if (!features.includes(label)) {
          features.push(label);
        }
      }
    }

    const featuresParagraph =
      features.length > 0
        ? `<p>Additional features include ${features
            .map((feature) =>
              escapeHtml(feature)
            )
            .join(", ")}.</p>`
        : "";

    const description = `
<p><strong>${safeTitle}</strong> is a well-presented ${propertyLabel} ${listingLabel} in ${safeCity}.</p>

<p>Located near ${safeAddress}, this property provides convenient access to local services, transportation, shops, and other daily necessities.</p>

<p>${escapeHtml(
      specifications
    )}</p>

${featuresParagraph}

<p>Offered at <strong>${escapeHtml(
      priceLabel
    )}</strong>, this property represents an attractive opportunity for buyers, renters, families, professionals, or investors looking for value in the Lebanese real estate market.</p>

<ul>
  <li>Property type: ${escapeHtml(
    propertyLabel
  )}</li>
  <li>Listing type: ${escapeHtml(
    listingLabel
  )}</li>
  <li>Location: ${safeCity}</li>
  ${
    area
      ? `<li>Area: ${area.toLocaleString(
          "en-US"
        )}m²</li>`
      : ""
  }
  <li>Price: ${escapeHtml(
    priceLabel
  )}</li>
</ul>
`.trim();

    return res.status(200).json({
      message:
        "Description generated successfully",

      description,

      normalizedData: {
        propertyType:
          normalizedPropertyType,
        listingType:
          normalizedListingType,
        bedrooms,
        bathrooms,
        area,
        price,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to generate description"
    );
  }
};

/* =========================================================
   ADMIN REPLY GENERATOR
========================================================= */

const detectMessageTopic = (
  subject,
  message
) => {
  const text =
    `${subject} ${message}`.toLowerCase();

  if (
    text.includes("fake") ||
    text.includes("scam") ||
    text.includes("fraud") ||
    text.includes(
      "wrong information"
    ) ||
    text.includes("false")
  ) {
    return "fakeListing";
  }

  if (
    text.includes("payment") ||
    text.includes("price") ||
    text.includes("money") ||
    text.includes("deposit") ||
    text.includes("cost")
  ) {
    return "payment";
  }

  if (
    text.includes("login") ||
    text.includes("account") ||
    text.includes("password") ||
    text.includes("profile")
  ) {
    return "account";
  }

  if (
    text.includes("chat") ||
    text.includes("message") ||
    text.includes("owner") ||
    text.includes("agent")
  ) {
    return "communication";
  }

  if (
    text.includes("image") ||
    text.includes("photo") ||
    text.includes("upload") ||
    text.includes("property") ||
    text.includes("post") ||
    text.includes("listing")
  ) {
    return "listing";
  }

  if (
    text.includes("visit") ||
    text.includes("appointment") ||
    text.includes("schedule") ||
    text.includes("viewing")
  ) {
    return "appointment";
  }

  return "general";
};

const buildTopicResponse = (
  topic,
  type
) => {
  const responses = {
    fakeListing: [
      "We will carefully review the reported property, including its information, images, owner details, and publication status.",
      "Our team will investigate the listing and take action if it contains misleading, fraudulent, or unsafe information.",
      "We will compare the report with the property details and handle it according to ShoufBayt safety policies.",
    ],

    payment: [
      "Please avoid transferring money outside trusted communication channels before confirming the property and agent information.",
      "We recommend verifying all payment details directly with the property owner or verified agent before making any commitment.",
      "Our team will review the payment concern and check whether the listing contains misleading financial information.",
    ],

    account: [
      "We will review the account issue and help ensure that your ShoufBayt profile remains secure and accessible.",
      "Our support team will investigate the account problem and provide the appropriate next steps.",
      "We will check the login or profile issue and work to resolve it as soon as possible.",
    ],

    communication: [
      "We will review the communication issue and check whether there is a problem with messages, property owners, or agents.",
      "Our team will investigate the chat or contact issue and make sure communication is working correctly.",
      "We will verify the reported communication problem and request more information when necessary.",
    ],

    listing: [
      "We will review the property details, images, location, and listing information to confirm that everything is accurate.",
      "Our team will inspect the property listing and update, reject, or remove information that violates ShoufBayt standards.",
      "We will investigate the listing issue and ensure that the property information is accurate and clear.",
    ],

    appointment: [
      "We recommend coordinating viewing times directly with the property owner or agent through ShoufBayt messages.",
      "Our team will review the visit request and help ensure that communication with the agent is clear.",
      "We will investigate the appointment concern and assist if the property owner or agent is not responding.",
    ],

    general: [
      type === "REPORT"
        ? "We will carefully review the report and take the appropriate action according to ShoufBayt policies."
        : "We will review your message and assist you with the most appropriate solution.",

      type === "REPORT"
        ? "Our administrative team will investigate this report and update its status after completing the review."
        : "Our support team will check your request and contact you if more information is needed.",

      type === "REPORT"
        ? "We appreciate your report and will handle it carefully to keep ShoufBayt professional and safe."
        : "Thank you for contacting us. We will do our best to assist you.",
    ],
  };

  return pickRandom(
    responses[topic] ||
      responses.general
  );
};

export const generateAdminReply = async (
  req,
  res
) => {
  try {
    const isAdmin =
      await checkAdmin(req.userId);

    if (!isAdmin) {
      return res.status(403).json({
        message:
          "Only active admins can generate replies",
      });
    }

    const name = cleanText(
      req.body.name,
      "there"
    );

    const email = cleanText(
      req.body.email
    );

    const subject = cleanText(
      req.body.subject
    );

    const message = cleanText(
      req.body.message
    );

    const requestedType = cleanText(
      req.body.type,
      "MESSAGE"
    ).toUpperCase();

    const requestedStatus = cleanText(
      req.body.status,
      "OPEN"
    ).toUpperCase();

    if (!subject || !message) {
      return res.status(400).json({
        message:
          "Subject and message are required",
      });
    }

    const type =
      CONTACT_TYPES.includes(
        requestedType
      )
        ? requestedType
        : "MESSAGE";

    const status =
      CONTACT_STATUSES.includes(
        requestedStatus
      )
        ? requestedStatus
        : "OPEN";

    const topic =
      detectMessageTopic(
        subject,
        message
      );

    const greetings = [
      `Hello ${name},`,
      `Hi ${name},`,
      `Dear ${name},`,
    ];

    const thankYouLines =
      type === "REPORT"
        ? [
            "Thank you for sending this report to ShoufBayt.",
            "Thank you for helping us keep ShoufBayt safe and reliable.",
            "We appreciate you taking the time to report this issue.",
          ]
        : [
            "Thank you for contacting ShoufBayt support.",
            "Thank you for reaching out to the ShoufBayt team.",
            "We appreciate your message and are happy to assist you.",
          ];

    const statusLines = {
      OPEN: [
        "Your request is currently open and will be reviewed by our administrative team.",
        "The request is currently open, and our team will review it shortly.",
        "We have marked the request as open while we investigate the details.",
      ],

      READ: [
        "Your request has been reviewed, and we are currently checking the details.",
        "We have read your message and are reviewing the appropriate next step.",
        "The request has been read and is now being handled by our team.",
      ],

      RESOLVED: [
        "This request has been reviewed and marked as resolved.",
        "The issue has been investigated and marked as resolved.",
        "We have completed our review and updated the request status to resolved.",
      ],
    };

    const closingLines = [
      "Best regards,\nShoufBayt Admin Team",
      "Kind regards,\nShoufBayt Support Team",
      "Thank you,\nShoufBayt Admin Team",
    ];

    const messagePreview =
      message.length > 160
        ? `${message.slice(
            0,
            160
          )}...`
        : message;

    const replyParts = [
      pickRandom(greetings),
      "",
      pickRandom(thankYouLines),
      "",
      `We received your ${
        type === "REPORT"
          ? "report"
          : "message"
      } regarding "${subject}".`,
      "",
      buildTopicResponse(
        topic,
        type
      ),
    ];

    if (messagePreview) {
      replyParts.push("");
      replyParts.push(
        `We reviewed the details you provided: "${messagePreview}"`
      );
    }

    replyParts.push("");
    replyParts.push(
      pickRandom(
        statusLines[status]
      )
    );

    replyParts.push("");

    if (type === "REPORT") {
      replyParts.push(
        "When necessary, we may update the property, contact the related user, reject the listing, or remove content that violates our platform policies."
      );
    } else {
      replyParts.push(
        "If additional information is required, we will contact you using the email associated with your message."
      );
    }

    replyParts.push("");
    replyParts.push(
      pickRandom(closingLines)
    );

    const reply =
      replyParts.join("\n");

    return res.status(200).json({
      message:
        "Reply generated successfully",

      reply,
      email: email || null,
      topic,
      type,
      status,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to generate admin reply"
    );
  }
};