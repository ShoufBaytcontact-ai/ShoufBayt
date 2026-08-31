import { trySendMail } from "./sendEmail.js";
import { PLAN_PRICES, TRIAL_DAYS } from "./subscription.js";
import {
  payeeEmailDetails,
  payeeInstructionParagraph,
} from "./paymentInstructions.js";
import {
  escapeHtml,
  getClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

const formatWhen = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(value);
  }
};

const safeSend = (payload, label) => trySendMail(payload, label);

export const sendAgentApplicationReceivedEmail = async ({
  to,
  username,
}) => {
  if (!to) return null;

  const name = username || "applicant";
  const price = PLAN_PRICES.PREMIUM;
  const siteUrl = getClientUrl();
  const subject = "We received your ShoufBayt agent application";

  const payload = {
    preheader: `Pay $${price} to complete your request. An administrator will review it after payment is confirmed.`,
    eyebrow: "Agent application",
    title: "Your request is in — payment is next",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      "Thank you for applying to join ShoufBayt as a verified real estate agent.",
      `To send your request to our team, please pay the Premium fee of <strong>$${price}</strong>.`,
      payeeInstructionParagraph(price),
      "After payment is confirmed, an administrator will review your application. You will receive another email when it is approved or declined.",
    ],
    details: [
      { label: "Status", value: "Pending payment" },
      ...payeeEmailDetails(price),
      { label: "After payment", value: "Admin review" },
    ],
    ctaLabel: `Pay $${price} now`,
    ctaUrl: `${siteUrl}/billing?apply=1`,
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
  trialGranted = false,
  trialEndsAt = null,
  paidUntil = null,
  reason,
}) => {
  if (!to) return null;

  const accepted = status === "APPROVED";
  const name = username || "applicant";
  const siteUrl = getClientUrl();
  const price = PLAN_PRICES.PREMIUM;
  const trialWhen = formatWhen(trialEndsAt);
  const paidWhen = formatWhen(paidUntil);

  const subject = accepted
    ? trialGranted
      ? "Welcome to ShoufBayt — your 30-day Premium trial has started"
      : paidWhen
        ? "Welcome to ShoufBayt — your Premium plan is active"
        : "Welcome to ShoufBayt — Premium payment is required"
    : "Update on your ShoufBayt agent application";

  const approvedPayload = trialGranted
    ? {
        preheader: `You are now a verified agent. Your complimentary Premium trial runs for ${TRIAL_DAYS} days${trialWhen ? ` until ${trialWhen}` : ""}.`,
        eyebrow: "Agent verification",
        title: "Your application has been approved",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          "We are pleased to confirm that your request to join ShoufBayt as a verified real estate agent has been approved.",
          `Your professional profile is now active, and your complimentary ${TRIAL_DAYS}-day Premium trial has started. You may publish listings, receive enquiries, and use the agent dashboard.`,
          trialWhen
            ? `Your trial remains active until <strong>${escapeHtml(trialWhen)}</strong>. After that, Premium is <strong>$${price} per month</strong>. You will receive a reminder before it ends.`
            : `After your ${TRIAL_DAYS}-day trial, Premium is <strong>$${price} per month</strong>. Pay from Billing to keep your agent account.`,
        ],
        details: [
          { label: "Status", value: "Verified agent" },
          { label: "Plan", value: `${TRIAL_DAYS}-day Premium trial` },
          ...(trialWhen ? [{ label: "Trial ends", value: trialWhen }] : []),
          { label: "Then", value: `$${price} USD / month` },
        ],
        ctaLabel: "Open agent dashboard",
        ctaUrl: `${siteUrl}/agent`,
        note: "Please keep your profile details accurate so clients can reach you with confidence.",
      }
    : paidWhen
      ? {
          preheader: `You are now a verified agent. Your Premium plan is active${paidWhen ? ` until ${paidWhen}` : ""}.`,
          eyebrow: "Agent verification",
          title: "Your application has been approved",
          greeting: `Dear ${escapeHtml(name)},`,
          paragraphs: [
            "We are pleased to confirm that your request to join ShoufBayt as a verified real estate agent has been approved.",
            "Your Premium payment was already received, so your professional profile and agent tools are active now.",
            paidWhen
              ? `Your current Premium period remains active until <strong>${escapeHtml(paidWhen)}</strong>.`
              : `Renew from Billing before your period ends to keep your agent account.`,
          ],
          details: [
            { label: "Status", value: "Verified agent" },
            { label: "Plan", value: "ShoufBayt Premium" },
            ...(paidWhen ? [{ label: "Active until", value: paidWhen }] : []),
          ],
          ctaLabel: "Open agent dashboard",
          ctaUrl: `${siteUrl}/agent`,
          note: "Please keep your profile details accurate so clients can reach you with confidence.",
        }
      : {
          preheader: `You are verified. Subscribe to Premium for $${price}/month in Billing to publish listings.`,
          eyebrow: "Agent verification",
          title: "Your application has been approved",
          greeting: `Dear ${escapeHtml(name)},`,
          paragraphs: [
            "We are pleased to confirm that your request to join ShoufBayt as a verified real estate agent has been approved.",
            `A complimentary trial is no longer available on this account. Subscribe to Premium for <strong>$${price} per month</strong> in Billing to publish listings and use professional agent tools.`,
          ],
          details: [
            { label: "Status", value: "Verified agent" },
            { label: "Next step", value: `Pay $${price} USD` },
          ],
          ctaLabel: `Subscribe · $${price}`,
          ctaUrl: `${siteUrl}/billing`,
          note: "Your profile is saved. Paying Premium restores full publishing access.",
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
