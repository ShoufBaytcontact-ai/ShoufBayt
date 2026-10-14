import { trySendMail } from "./sendEmail.js";
import {
  escapeHtml,
  getClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

const safeSend = (payload, label) => trySendMail(payload, label);

export const sendAgentApplicationReceivedEmail = async ({
  to,
  username,
}) => {
  if (!to) return null;

  const name = username || "applicant";
  const siteUrl = getClientUrl();
  const subject = "We received your ShoufBayt agent application";

  const payload = {
    preheader:
      "An administrator will review your request. You will hear back when it is approved or declined.",
    eyebrow: "Agent application",
    title: "Your request is in for review",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      "Thank you for applying to join ShoufBayt as a verified real estate agent.",
      "An administrator will review your application. You will receive another email when it is approved or declined.",
    ],
    details: [{ label: "Status", value: "Pending review" }],
    ctaLabel: "View your profile",
    ctaUrl: `${siteUrl}/profile`,
    note: "This is an automated confirmation from ShoufBayt.",
  };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "agent application received email"
  );
};

export const sendAgentStatusEmail = async ({
  to,
  username,
  status,
  reason,
}) => {
  if (!to) return null;

  const accepted = status === "APPROVED";
  const name = username || "applicant";
  const siteUrl = getClientUrl();

  const subject = accepted
    ? "Welcome to ShoufBayt — your agent account is active"
    : "Update on your ShoufBayt agent application";

  const approvedPayload = {
    preheader:
      "You are now a verified agent. You can publish listings and use the agent dashboard.",
    eyebrow: "Agent verification",
    title: "Your application has been approved",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      "We are pleased to confirm that your request to join ShoufBayt as a verified real estate agent has been approved.",
      "Your professional profile is now active. You may publish listings, receive enquiries, and use the agent dashboard.",
    ],
    details: [{ label: "Status", value: "Verified agent" }],
    ctaLabel: "Open agent dashboard",
    ctaUrl: `${siteUrl}/agent`,
    note: "Please keep your profile details accurate so clients can reach you with confidence.",
  };

  const payload = accepted
    ? approvedPayload
    : {
        preheader:
          "Your ShoufBayt agent application was not approved at this time.",
        eyebrow: "Agent verification",
        title: "An update on your application",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          "Thank you for your interest in joining the ShoufBayt agent network. After careful review, we are unable to approve your application at this time.",
          reason
            ? `Reason provided: <strong>${escapeHtml(reason)}</strong>`
            : "You are welcome to update your details and submit a new request, or contact our team if you believe this decision was made in error.",
        ],
        details: [{ label: "Status", value: "Not approved" }],
        ctaLabel: "Contact ShoufBayt",
        ctaUrl: `${siteUrl}/contact`,
        note: "We appreciate the time you took to apply and hope to work with you in the future.",
      };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "agent status email"
  );
};

export const sendListingModerationEmail = async ({
  to,
  username,
  title,
  city,
  status,
  reason,
  propertyId,
}) => {
  if (!to) return null;

  const name = username || "valued client";
  const propertyTitle = title || "your listing";
  const siteUrl = getClientUrl();
  const approved = String(status || "").toUpperCase() === "PUBLISHED";
  const listingPath = propertyId ? `/properties/${propertyId}` : "/my-homes";
  const subject = approved
    ? `Your listing is live: ${propertyTitle}`
    : `Update on your listing: ${propertyTitle}`;

  const payload = approved
    ? {
        preheader: `${propertyTitle} is now published on ShoufBayt.`,
        eyebrow: "Listing review",
        title: "Your listing has been approved",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          `An administrator approved <strong>${escapeHtml(propertyTitle)}</strong>. It is now live on ShoufBayt.`,
        ],
        details: [
          { label: "Property", value: propertyTitle },
          { label: "City", value: city },
          { label: "Status", value: "Approved / live" },
        ],
        ctaLabel: "View listing",
        ctaUrl: `${siteUrl}${listingPath}`,
        note: "If this listing is taken down later, you will receive another email.",
      }
    : {
        preheader: `${propertyTitle} was not approved for public listing.`,
        eyebrow: "Listing review",
        title: "Your listing was not approved",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          `An administrator did not approve <strong>${escapeHtml(propertyTitle)}</strong> for public listing.`,
          reason
            ? `Reason provided: <strong>${escapeHtml(reason)}</strong>`
            : "You can update the listing details and wait for another review.",
        ],
        details: [
          { label: "Property", value: propertyTitle },
          { label: "City", value: city },
          { label: "Status", value: "Rejected" },
        ],
        ctaLabel: "Open my listings",
        ctaUrl: `${siteUrl}/my-homes`,
        note: "An administrator can approve this listing again after changes are made.",
      };

  return safeSend(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "listing moderation email"
  );
};
