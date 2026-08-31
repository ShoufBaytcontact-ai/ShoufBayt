import { trySendMail } from "./sendEmail.js";
import {
  escapeHtml,
  getPublicClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

const formatPrice = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `$${number.toLocaleString("en-US")}`;
};

const formatListingType = (value) => {
  const raw = String(value || "").toUpperCase();
  if (raw === "RENT") return "For rent";
  if (raw === "SALE") return "For sale";
  return raw || "";
};

const formatPropertyType = (value) => {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const safeSend = (payload, label) => trySendMail(payload, label);

export const sendListingRequestReceivedEmail = async ({
  to,
  username,
  title,
  city,
  listingType,
  propertyType,
  price,
}) => {
  if (!to) return null;

  const name = username || "valued client";
  const propertyTitle = title || "your property";
  const siteUrl = getPublicClientUrl();
  const subject = "Your ShoufBayt listing request has been received";

  const payload = {
    preheader:
      "Your listing request is with verified agents. Please wait while they submit proposals.",
    eyebrow: "Listing request",
    title: "We have received your request",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Thank you for submitting <strong>${escapeHtml(propertyTitle)}</strong> to ShoufBayt.`,
      "Verified agents on the platform can now review your details and send proposals. There is nothing further you need to do at this stage — please wait while agents respond.",
      "You will receive another email as soon as an agent submits a proposal, and you can compare offers from your owner dashboard.",
    ],
    details: [
      { label: "Property", value: propertyTitle },
      { label: "City", value: city },
      { label: "Type", value: formatPropertyType(propertyType) },
      { label: "Listing", value: formatListingType(listingType) },
      { label: "Guide price", value: formatPrice(price) },
    ],
    ctaLabel: "View your request",
    ctaUrl: siteUrl ? `${siteUrl}/owner` : undefined,
    note: "Only verified Premium agents are invited to propose. You choose which proposal to accept.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing request received email"
  );
};

export const sendListingLeadEmail = async ({
  to,
  username,
  title,
  city,
  listingType,
  propertyType,
  price,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const propertyTitle = title || "a new property";
  const location = city || "Lebanon";
  const siteUrl = getPublicClientUrl();
  const subject = `New listing request in ${location}`;

  const payload = {
    preheader: `A homeowner in ${location} is looking for an agent for ${propertyTitle}.`,
    eyebrow: "Agent lead",
    title: "A new listing request is waiting",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `A homeowner has submitted a listing request for <strong>${escapeHtml(propertyTitle)}</strong> in ${escapeHtml(location)}.`,
      "This alert is sent only to verified Premium agents. If the brief suits you, please submit a proposal from your agent dashboard. The homeowner will then review competing offers and choose an agent.",
    ],
    details: [
      { label: "Property", value: propertyTitle },
      { label: "City", value: city },
      { label: "Type", value: formatPropertyType(propertyType) },
      { label: "Listing", value: formatListingType(listingType) },
      { label: "Guide price", value: formatPrice(price) },
    ],
    ctaLabel: "Review this lead",
    ctaUrl: siteUrl ? `${siteUrl}/agent` : undefined,
    note: "Please respond only if you can represent this listing professionally. The homeowner is waiting for proposals.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing lead email"
  );
};

const formatBedsBaths = (bedrooms, bathrooms) => {
  const beds = Number(bedrooms);
  const baths = Number(bathrooms);
  const parts = [];
  if (Number.isFinite(beds)) parts.push(`${beds} bedroom${beds === 1 ? "" : "s"}`);
  if (Number.isFinite(baths)) parts.push(`${baths} bathroom${baths === 1 ? "" : "s"}`);
  return parts.join(" · ");
};

const formatExperience = (years) => {
  const value = Number(years);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${value} year${value === 1 ? "" : "s"}`;
};

const formatRating = (rating, totalReviews) => {
  const score = Number(rating);
  const count = Number(totalReviews);
  if (!Number.isFinite(score) || score <= 0) return "";
  if (Number.isFinite(count) && count > 0) {
    return `${score.toFixed(1)} / 5 (${count} review${count === 1 ? "" : "s"})`;
  }
  return `${score.toFixed(1)} / 5`;
};

const formatArea = (area) => {
  const value = Number(area);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${value.toLocaleString("en-US")} m²`;
};

const quoteHtml = (label, body) => {
  const text = String(body || "").trim();
  if (!text) return "";
  return `
    <div style="margin:8px 0 24px 0;padding:18px 20px;background:#faf8f4;border-left:4px solid #e2b84a;">
      <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#b8891f;font-weight:700;">
        ${escapeHtml(label)}
      </p>
      <p style="margin:0;font-size:15px;line-height:1.75;color:#17150f;">
        ${escapeHtml(text).replace(/\r?\n/g, "<br />")}
      </p>
    </div>`;
};

export const sendListingProposalReceivedEmail = async ({
  to,
  username,
  title,
  city,
  address,
  listingType,
  propertyType,
  price,
  bedrooms,
  bathrooms,
  area,
  agentName,
  agencyName,
  agentTitle,
  agentPhone,
  agentLocation,
  yearsExperience,
  rating,
  totalReviews,
  message,
  commissionPercent,
  estimatedDays,
}) => {
  if (!to) return null;

  const name = username || "valued client";
  const propertyTitle = title || "your property";
  const agent = agentName || "A ShoufBayt agent";
  const siteUrl = getPublicClientUrl();
  const commission =
    commissionPercent === undefined || commissionPercent === null
      ? ""
      : `${commissionPercent}%`;
  const timeline = estimatedDays
    ? `About ${estimatedDays} day${Number(estimatedDays) === 1 ? "" : "s"}`
    : "";
  const subject = `${agent} submitted a proposal for ${propertyTitle}`;

  const payload = {
    preheader: `${agent} proposed ${commission || "a commission"} and ${timeline || "a timeline"} for ${propertyTitle}.`,
    eyebrow: "Agent proposal",
    title: "You have received a full listing proposal",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `<strong>${escapeHtml(agent)}</strong> has submitted a proposal to represent <strong>${escapeHtml(propertyTitle)}</strong>. The complete offer is below so you can review it without opening the app first.`,
      "Other verified agents may still send proposals until you accept one. Accepting assigns that agent to publish and represent the listing.",
    ],
    highlightHtml: quoteHtml("Agent message", message),
    details: [
      { label: "Agent", value: agent },
      { label: "Title", value: agentTitle },
      { label: "Agency", value: agencyName },
      { label: "Phone", value: agentPhone },
      { label: "Based in", value: agentLocation },
      { label: "Experience", value: formatExperience(yearsExperience) },
      { label: "Rating", value: formatRating(rating, totalReviews) },
      { label: "Commission", value: commission },
      { label: "Estimated timeline", value: timeline },
      { label: "Property", value: propertyTitle },
      { label: "Address", value: address },
      { label: "City", value: city },
      { label: "Type", value: formatPropertyType(propertyType) },
      { label: "Listing", value: formatListingType(listingType) },
      { label: "Guide price", value: formatPrice(price) },
      { label: "Layout", value: formatBedsBaths(bedrooms, bathrooms) },
      { label: "Area", value: formatArea(area) },
    ],
    messageLabel: "Agent message",
    messageBody: String(message || "").trim(),
    ctaLabel: "Review and accept",
    ctaUrl: siteUrl ? `${siteUrl}/profile` : undefined,
    note: "Open your ShoufBayt profile to accept this proposal, compare other offers, or wait for more agents to respond.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing proposal email"
  );
};

export const sendListingProposalAcceptedEmail = async ({
  to,
  username,
  title,
  city,
  address,
  listingType,
  propertyType,
  price,
  bedrooms,
  bathrooms,
  area,
  commissionPercent,
  estimatedDays,
  ownerName,
  ownerPhone,
  ownerEmail,
  propertyId,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const propertyTitle = title || "this property";
  const siteUrl = getPublicClientUrl();
  const commission =
    commissionPercent === undefined || commissionPercent === null
      ? ""
      : `${commissionPercent}%`;
  const timeline = estimatedDays
    ? `About ${estimatedDays} day${Number(estimatedDays) === 1 ? "" : "s"}`
    : "";
  const listingPath = propertyId ? `/properties/${propertyId}` : "/agent";
  const subject = `The owner accepted your proposal for ${propertyTitle}`;

  const payload = {
    preheader: `You were chosen to list ${propertyTitle}. The listing is pending admin publish.`,
    eyebrow: "Proposal accepted",
    title: "The owner chose you",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `The homeowner accepted your proposal to represent <strong>${escapeHtml(propertyTitle)}</strong>.`,
      "The listing has been created under your account and is pending admin review before it goes live. You can open it from your agent dashboard to prepare photos, details, and visits.",
    ],
    details: [
      { label: "Property", value: propertyTitle },
      { label: "Address", value: address },
      { label: "City", value: city },
      { label: "Type", value: formatPropertyType(propertyType) },
      { label: "Listing", value: formatListingType(listingType) },
      { label: "Guide price", value: formatPrice(price) },
      { label: "Layout", value: formatBedsBaths(bedrooms, bathrooms) },
      { label: "Area", value: formatArea(area) },
      { label: "Your commission", value: commission },
      { label: "Your timeline", value: timeline },
      { label: "Owner", value: ownerName },
      { label: "Owner phone", value: ownerPhone },
      { label: "Owner email", value: ownerEmail },
    ],
    ctaLabel: "Open the listing",
    ctaUrl: siteUrl ? `${siteUrl}${listingPath}` : undefined,
    note: "Please contact the owner promptly and keep the listing details accurate. The home is not public until an admin publishes it.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing proposal accepted email"
  );
};

export const sendListingRequestAwardedEmail = async ({
  to,
  username,
  title,
  city,
  address,
  listingType,
  propertyType,
  price,
  agentName,
  agencyName,
  agentPhone,
  commissionPercent,
  estimatedDays,
  propertyId,
}) => {
  if (!to) return null;

  const name = username || "valued client";
  const propertyTitle = title || "your property";
  const agent = agentName || "your chosen agent";
  const siteUrl = getPublicClientUrl();
  const commission =
    commissionPercent === undefined || commissionPercent === null
      ? ""
      : `${commissionPercent}%`;
  const timeline = estimatedDays
    ? `About ${estimatedDays} day${Number(estimatedDays) === 1 ? "" : "s"}`
    : "";
  const listingPath = propertyId ? `/properties/${propertyId}` : "/owner";
  const subject = `You accepted an agent for ${propertyTitle}`;

  const payload = {
    preheader: `${agent} will represent ${propertyTitle} on ShoufBayt.`,
    eyebrow: "Listing request",
    title: "Your listing request was accepted",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `You accepted <strong>${escapeHtml(agent)}</strong> to represent <strong>${escapeHtml(propertyTitle)}</strong>.`,
      "The listing has been created from your request. You can open it from your dashboard, and you will receive another email if an administrator changes its review status.",
    ],
    details: [
      { label: "Property", value: propertyTitle },
      { label: "Address", value: address },
      { label: "City", value: city },
      { label: "Type", value: formatPropertyType(propertyType) },
      { label: "Listing", value: formatListingType(listingType) },
      { label: "Guide price", value: formatPrice(price) },
      { label: "Agent", value: agent },
      { label: "Agency", value: agencyName },
      { label: "Agent phone", value: agentPhone },
      { label: "Commission", value: commission },
      { label: "Estimated timeline", value: timeline },
    ],
    ctaLabel: "View the listing",
    ctaUrl: siteUrl ? `${siteUrl}${listingPath}` : undefined,
    note: "This is a confirmation of the agent you chose for this listing request.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing request awarded email"
  );
};

export const sendListingProposalRejectedEmail = async ({
  to,
  username,
  title,
  city,
  ownerName,
  commissionPercent,
  estimatedDays,
  anotherChosen = false,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const propertyTitle = title || "this property";
  const siteUrl = getPublicClientUrl();
  const commission =
    commissionPercent === undefined || commissionPercent === null
      ? ""
      : `${commissionPercent}%`;
  const timeline = estimatedDays
    ? `About ${estimatedDays} day${Number(estimatedDays) === 1 ? "" : "s"}`
    : "";
  const subject = anotherChosen
    ? `Another agent was chosen for ${propertyTitle}`
    : `Your proposal for ${propertyTitle} was declined`;

  const payload = anotherChosen
    ? {
        preheader: `The owner accepted another agent for ${propertyTitle}.`,
        eyebrow: "Proposal update",
        title: "This listing request is closed",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          `The homeowner chose another agent to represent <strong>${escapeHtml(propertyTitle)}</strong>.`,
          "Your proposal was not selected, and this request is no longer open.",
        ],
        details: [
          { label: "Property", value: propertyTitle },
          { label: "City", value: city },
          { label: "Owner", value: ownerName },
          { label: "Your commission", value: commission },
          { label: "Your timeline", value: timeline },
          { label: "Status", value: "Not selected" },
        ],
        ctaLabel: "Open agent leads",
        ctaUrl: siteUrl ? `${siteUrl}/agent` : undefined,
        note: "Other open listing requests remain available in your agent dashboard.",
      }
    : {
        preheader: `The owner did not accept your proposal for ${propertyTitle}.`,
        eyebrow: "Proposal update",
        title: "Your listing proposal was declined",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          `The homeowner declined your proposal to represent <strong>${escapeHtml(propertyTitle)}</strong>.`,
          "This listing request is still open. You can send a new proposal from your agent dashboard until the owner accepts someone else.",
        ],
        details: [
          { label: "Property", value: propertyTitle },
          { label: "City", value: city },
          { label: "Owner", value: ownerName },
          { label: "Your commission", value: commission },
          { label: "Your timeline", value: timeline },
          { label: "Status", value: "Declined — you can propose again" },
        ],
        ctaLabel: "Send another proposal",
        ctaUrl: siteUrl ? `${siteUrl}/agent` : undefined,
        note: "You may submit another proposal for this same listing until the owner accepts an agent.",
      };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing proposal rejected email"
  );
};

export const sendListingRequestRejectedEmail = async ({
  to,
  username,
  title,
  city,
  agentName,
}) => {
  if (!to) return null;

  const name = username || "valued client";
  const propertyTitle = title || "your property";
  const agent = agentName || "an agent";
  const siteUrl = getPublicClientUrl();
  const subject = `Update on your listing request for ${propertyTitle}`;

  const payload = {
    preheader: `You declined ${agent}'s proposal for ${propertyTitle}. Your request is still open.`,
    eyebrow: "Listing request",
    title: "You declined a listing proposal",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `You declined the proposal from <strong>${escapeHtml(agent)}</strong> for <strong>${escapeHtml(propertyTitle)}</strong>.`,
      "Your listing request is still open. That agent can send a new proposal, and other verified agents can still offer until you accept one.",
    ],
    details: [
      { label: "Property", value: propertyTitle },
      { label: "City", value: city },
      { label: "Declined agent", value: agent },
      { label: "Status", value: "Still open for proposals" },
    ],
    ctaLabel: "View your request",
    ctaUrl: siteUrl ? `${siteUrl}/owner` : undefined,
    note: "You can accept another proposal at any time from your owner dashboard.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing request proposal declined email"
  );
};
