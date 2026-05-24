import prisma from "../lib/prisma.js";

const formatText = (value, fallback = "") => {
  if (!value && value !== 0) {
    return fallback;
  }

  return String(value).trim();
};

const formatPrice = (price) => {
  const numberPrice = Number(price);

  if (!Number.isFinite(numberPrice) || numberPrice <= 0) {
    return "a competitive price";
  }

  return `$${numberPrice.toLocaleString()}`;
};

const getPropertyLabel = (property) => {
  if (property === "apartment") {
    return "apartment";
  }

  if (property === "house") {
    return "house";
  }

  if (property === "land") {
    return "land";
  }

  return "property";
};

const getDealLabel = (type) => {
  if (type === "rent") {
    return "for rent";
  }

  if (type === "buy") {
    return "for sale";
  }

  return "available";
};

const checkAdmin = async (userId) => {
  if (!userId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  return user?.role === "ADMIN";
};

export const generatePropertyDescription = async (req, res) => {
  try {
    const {
      title,
      price,
      address,
      city,
      bedroom,
      bathroom,
      size,
      type,
      property,
    } = req.body;

    const cleanTitle = formatText(title, "This property");
    const cleanCity = formatText(city, "a prime location");
    const cleanAddress = formatText(address, cleanCity);
    const propertyLabel = getPropertyLabel(property);
    const dealLabel = getDealLabel(type);
    const priceLabel = formatPrice(price);

    const bedrooms = Number(bedroom);
    const bathrooms = Number(bathroom);
    const propertySize = Number(size);

    let specs = "";

    if (propertyLabel === "land") {
      specs = propertySize
        ? `The land offers approximately ${propertySize}m², giving buyers excellent flexibility for future development or investment.`
        : "The land offers excellent flexibility for future development or investment.";
    } else {
      const bedroomText =
        Number.isFinite(bedrooms) && bedrooms > 0
          ? `${bedrooms} bedroom${bedrooms === 1 ? "" : "s"}`
          : "comfortable rooms";

      const bathroomText =
        Number.isFinite(bathrooms) && bathrooms > 0
          ? `${bathrooms} bathroom${bathrooms === 1 ? "" : "s"}`
          : "practical bathroom space";

      const sizeText =
        Number.isFinite(propertySize) && propertySize > 0
          ? `and ${propertySize}m² of living space`
          : "and a practical interior layout";

      specs = `It features ${bedroomText}, ${bathroomText}, ${sizeText}, making it suitable for families, professionals, or investors.`;
    }

    const description = `
      <p><strong>${cleanTitle}</strong> is a well-presented ${propertyLabel} ${dealLabel} in ${cleanCity}.</p>

      <p>Located near ${cleanAddress}, this listing offers a convenient location with easy access to nearby services, transportation, and daily needs.</p>

      <p>${specs}</p>

      <p>With a price of <strong>${priceLabel}</strong>, this property is a strong option for users looking for comfort, value, and a reliable real estate opportunity through SmartEstate.</p>

      <ul>
        <li>Property type: ${propertyLabel}</li>
        <li>Listing type: ${dealLabel}</li>
        <li>Location: ${cleanCity}</li>
        <li>Price: ${priceLabel}</li>
      </ul>
    `;

    res.status(200).json({
      message: "Description generated successfully",
      description,
    });
  } catch (error) {
    console.log("GENERATE DESCRIPTION ERROR:", error);
    res.status(500).json({
      message: "Failed to generate description",
    });
  }
};



const pickRandom = (items) => {
  return items[Math.floor(Math.random() * items.length)];
};

const cleanText = (value, fallback = "") => {
  if (!value && value !== 0) {
    return fallback;
  }

  return String(value).trim();
};

const detectMessageTopic = (subject, message) => {
  const text = `${subject} ${message}`.toLowerCase();

  if (
    text.includes("fake") ||
    text.includes("scam") ||
    text.includes("fraud") ||
    text.includes("wrong information") ||
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
    text.includes("post") ||
    text.includes("listing")
  ) {
    return "listing";
  }

  if (
    text.includes("visit") ||
    text.includes("appointment") ||
    text.includes("schedule") ||
    text.includes("view")
  ) {
    return "appointment";
  }

  return "general";
};

const buildTopicResponse = (topic, type) => {
  const responses = {
    fakeListing: [
      "We will review the reported listing carefully and check whether the information, images, and owner details are valid.",
      "Our team will investigate the listing and take action if we find misleading or unsafe information.",
      "We will compare the reported information with the listing details and handle it according to SmartEstate safety rules.",
    ],

    payment: [
      "Please avoid sending any payment outside trusted communication channels until the property and owner are verified.",
      "We recommend confirming all payment details directly with the verified owner or agent before making any commitment.",
      "Our team will review the payment-related concern and make sure the listing does not include misleading financial information.",
    ],

    account: [
      "We will check the account-related issue and help make sure your SmartEstate profile remains secure and accessible.",
      "Our support team will review the account problem and guide you with the next steps if more action is needed.",
      "We will look into the profile or login issue and work on resolving it as soon as possible.",
    ],

    communication: [
      "We will review the communication issue and check if there is a problem with messages, owners, or agent contact.",
      "Our team will look into the chat or contact issue and make sure the communication flow is working properly.",
      "We will verify the reported communication problem and follow up if additional details are required.",
    ],

    listing: [
      "We will review the listing details, images, and property information to make sure everything is accurate.",
      "Our team will check the property post and update or remove anything that does not follow SmartEstate standards.",
      "We will investigate the listing issue and make sure the property information is clear and correct.",
    ],

    appointment: [
      "We recommend coordinating visit times directly with the property owner or agent through SmartEstate messages.",
      "Our team will check the request and help make sure property visit communication is clear.",
      "We will review the appointment-related concern and assist if the owner or agent is not responding properly.",
    ],

    general: [
      type === "REPORT"
        ? "We will review the report carefully and take the necessary action based on SmartEstate policies."
        : "We will review your message and assist you with the best possible solution.",
      type === "REPORT"
        ? "Our admin team will investigate this report and update the status once it has been checked."
        : "Our support team will check your request and follow up if more details are needed.",
      type === "REPORT"
        ? "We appreciate your report and will handle it carefully to keep SmartEstate safe and professional."
        : "Thank you for reaching out. We will do our best to help you with this request.",
    ],
  };

  return pickRandom(responses[topic] || responses.general);
};

export const generateAdminReply = async (req, res) => {
  try {
    const isAdmin = await checkAdmin(req.userId);

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admins can generate replies",
      });
    }

    const { name, email, subject, message, type, status } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        message: "Subject and message are required",
      });
    }

    const cleanName = cleanText(name, "there");
    const cleanSubject = cleanText(subject, "your request");
    const cleanMessage = cleanText(message, "");
    const cleanType = cleanText(type, "MESSAGE").toUpperCase();
    const cleanStatus = cleanText(status, "OPEN").toUpperCase();

    const topic = detectMessageTopic(cleanSubject, cleanMessage);

    const greetings = [
      `Hello ${cleanName},`,
      `Hi ${cleanName},`,
      `Dear ${cleanName},`,
    ];

    const thankYouLines = cleanType === "REPORT"
      ? [
          "Thank you for sending this report to SmartEstate.",
          "Thank you for helping us keep SmartEstate safe and reliable.",
          "We appreciate you taking the time to report this issue.",
        ]
      : [
          "Thank you for contacting SmartEstate support.",
          "Thank you for reaching out to the SmartEstate team.",
          "We appreciate your message and are happy to assist you.",
        ];

    const statusLines = {
      OPEN: [
        "Your request is currently open and will be reviewed by our admin team.",
        "The current status is open, and our team will check it shortly.",
        "We have marked this request as open while we review the details.",
      ],
      READ: [
        "Your request has been reviewed, and we are checking the details.",
        "We have read your message and are now reviewing the best next step.",
        "This request has been read and is being handled by our team.",
      ],
      RESOLVED: [
        "This request has been marked as resolved after review.",
        "The issue has been reviewed and marked as resolved.",
        "We have completed the review and updated the request as resolved.",
      ],
    };

    const closingLines = [
      "Best regards,\nSmartEstate Admin Team",
      "Kind regards,\nSmartEstate Support Team",
      "Thank you,\nSmartEstate Admin Team",
    ];

    const messagePreview =
      cleanMessage.length > 160
        ? `${cleanMessage.slice(0, 160)}...`
        : cleanMessage;

    const includePreview = Math.random() > 0.45;

    const replyParts = [
      pickRandom(greetings),
      "",
      pickRandom(thankYouLines),
      "",
      `We received your ${cleanType === "REPORT" ? "report" : "message"} regarding "${cleanSubject}".`,
      "",
      buildTopicResponse(topic, cleanType),
    ];

    if (includePreview && messagePreview) {
      replyParts.push("");
      replyParts.push(`We also reviewed the details you provided: "${messagePreview}"`);
    }

    replyParts.push("");
    replyParts.push(pickRandom(statusLines[cleanStatus] || statusLines.OPEN));
    replyParts.push("");

    if (cleanType === "REPORT") {
      replyParts.push(
        "If the issue requires action, we may update the listing, contact the related user, or remove content that does not follow our platform rules."
      );
    } else {
      replyParts.push(
        "If we need more information, we will contact you using the email connected to your message."
      );
    }

    replyParts.push("");
    replyParts.push(pickRandom(closingLines));

    const reply = replyParts.join("\n");

    res.status(200).json({
      message: "Reply generated successfully",
      reply,
      email: email || null,
      topic,
    });
  } catch (error) {
    console.log("GENERATE ADMIN REPLY ERROR:", error);
    res.status(500).json({
      message: "Failed to generate admin reply",
    });
  }
};