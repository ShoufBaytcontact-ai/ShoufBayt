import { trySendMail } from "./sendEmail.js";
import { GRACE_DAYS, PLAN_PRICES } from "./subscription.js";
import {
  payeeEmailDetails,
  payeeInstructionParagraph,
} from "./paymentInstructions.js";
import {
  escapeHtml,
  getPublicClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

const formatWhen = (value) => {
  if (!value) return "soon";
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

const deliver = async (payload, subject, label) => {
  return safeSend(
    {
      to: payload.to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    label
  );
};

export const sendSubscriptionExpiringEmail = async ({
  to,
  username,
  endDate,
  isTrial,
  autoRenew,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const when = formatWhen(endDate);
  const price = PLAN_PRICES.PREMIUM;
  const billingUrl = `${getPublicClientUrl()}/billing`;
  const periodLabel = isTrial ? "complimentary Premium trial" : "Premium agent subscription";
  const subject = isTrial
    ? "Your ShoufBayt Premium trial is ending soon"
    : "Action required: renew your ShoufBayt Premium plan";

  const payload = {
    to,
    preheader: `Your ${periodLabel} ends on ${when}. Renew for $${price} to keep your agent account.`,
    eyebrow: "Premium membership",
    title: isTrial
      ? "Your trial period is coming to a close"
      : "Your Premium plan is due for renewal",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `We hope you have been enjoying ShoufBayt. Your ${periodLabel} is scheduled to end on <strong>${escapeHtml(when)}</strong>.`,
      autoRenew
        ? `To keep your verified agent profile, listings, and professional tools active, the Premium fee of <strong>$${price}</strong> is due. We will attempt to charge your saved card automatically. You may also renew from Billing at any time.`
        : `To remain a ShoufBayt agent, please renew your Premium membership for <strong>$${price}</strong> before the end date.`,
      `If payment is not received, you will have a ${GRACE_DAYS}-day courtesy period. After that, your account will return to a standard user profile and your listings will be paused. Paying $${price} restores your agent account, listings, and tools in full.`,
    ],
    details: [
      { label: "Plan", value: "ShoufBayt Premium" },
      { label: "Amount due", value: `$${price} USD` },
      { label: "Ends on", value: when },
      { label: "Courtesy period", value: `${GRACE_DAYS} days after expiry` },
      ...payeeEmailDetails(price),
    ],
    ctaLabel: `Renew Premium · $${price}`,
    ctaUrl: billingUrl,
    note: "This is an automated account notice from ShoufBayt. Existing listing data is kept so you can restore access as soon as payment is completed.",
  };

  return deliver(payload, subject, "subscription expiry email");
};

export const sendAgentDowngradedEmail = async ({ to, username }) => {
  if (!to) return null;

  const name = username || "valued partner";
  const price = PLAN_PRICES.PREMIUM;
  const billingUrl = `${getPublicClientUrl()}/billing`;
  const subject = "Your ShoufBayt agent access has been paused";

  const payload = {
    to,
    preheader: `Your Premium plan was not renewed. Pay $${price} to restore your agent account and listings.`,
    eyebrow: "Account update",
    title: "Your agent profile is currently paused",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Your ShoufBayt Premium membership ended ${GRACE_DAYS} days ago and was not renewed.`,
      "Your account has therefore been returned to a standard user profile. Your listings are paused and no longer appear publicly. Your agent profile, reviews, and property records have been saved.",
      `You may restore everything at any time by paying the Premium fee of <strong>$${price}</strong>. Once payment is confirmed, your agent role, listings, and professional tools will be reinstated.`,
    ],
    details: [
      { label: "Current status", value: "Standard user" },
      { label: "Listings", value: "Paused and saved" },
      { label: "Restore fee", value: `$${price} USD` },
    ],
    ctaLabel: `Restore agent access · $${price}`,
    ctaUrl: billingUrl,
    note: "We would be pleased to welcome you back to the ShoufBayt agent network.",
  };

  return deliver(payload, subject, "agent downgrade email");
};

export const sendAgentRestoredEmail = async ({ to, username, endDate }) => {
  if (!to) return null;

  const name = username || "valued partner";
  const when = formatWhen(endDate);
  const billingUrl = `${getPublicClientUrl()}/billing`;
  const subject = "Welcome back: your ShoufBayt agent account is active";

  const payload = {
    to,
    preheader: `Your Premium payment was received. Agent access and listings are restored until ${when}.`,
    eyebrow: "Payment confirmed",
    title: "Your agent account has been restored",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Thank you. We have received your ShoufBayt Premium payment of <strong>$${PLAN_PRICES.PREMIUM}</strong>.`,
      "Your verified agent profile is active again. Paused listings have been republished, and your professional tools are available once more.",
      `Your current Premium period remains active until <strong>${escapeHtml(when)}</strong>.`,
    ],
    details: [
      { label: "Status", value: "Verified agent" },
      { label: "Plan", value: "ShoufBayt Premium" },
      { label: "Active until", value: when },
    ],
    ctaLabel: "Open your dashboard",
    ctaUrl: `${getPublicClientUrl()}/agent`,
    note: getPublicClientUrl()
      ? `You can review invoices and renewal settings at any time from Billing: ${getPublicClientUrl()}/billing`
      : "You can review invoices and renewal settings from Billing in your ShoufBayt account.",
  };

  return deliver(payload, subject, "agent restored email");
};

export const sendPremiumActivatedEmail = async ({
  to,
  username,
  endDate,
  pendingReview = false,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const when = formatWhen(endDate);
  const price = PLAN_PRICES.PREMIUM;
  const siteUrl = getPublicClientUrl();
  const subject = pendingReview
    ? "Payment received — your agent request is with our team"
    : "Your ShoufBayt Premium plan is active";

  const payload = {
    to,
    preheader: pendingReview
      ? `We received your $${price} payment. An administrator will review your agent application next.`
      : `Your Premium payment of $${price} was confirmed. Access remains until ${when}.`,
    eyebrow: "Payment confirmed",
    title: pendingReview
      ? "Thank you — payment received"
      : "Premium has been activated",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: pendingReview
      ? [
          `We have received your ShoufBayt Premium payment of <strong>$${price}</strong>.`,
          "Your agent application is now with our team. Once an administrator approves it, your verified agent profile and professional tools will be switched on.",
        ]
      : [
          `Thank you. We have confirmed your ShoufBayt Premium payment of <strong>$${price}</strong>.`,
          `Your agent tools and listings remain available until <strong>${escapeHtml(when)}</strong>. You can renew from Billing before that date to keep your account active.`,
        ],
    details: [
      { label: "Amount paid", value: `$${price} USD` },
      { label: "Plan", value: "ShoufBayt Premium" },
      {
        label: pendingReview ? "Next step" : "Active until",
        value: pendingReview ? "Admin review of your agent request" : when,
      },
    ],
    ctaLabel: pendingReview ? "View billing" : "Open your dashboard",
    ctaUrl: pendingReview ? `${siteUrl}/billing` : `${siteUrl}/agent`,
    note: "This is an automated receipt from ShoufBayt. Keep this email for your records.",
  };

  return deliver(payload, subject, "premium activated email");
};

export const sendPaymentSubmittedEmail = async ({
  to,
  username,
  amount,
  method,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const price = Number(amount) || PLAN_PRICES.PREMIUM;
  const subject = "We received your ShoufBayt payment proof";

  const payload = {
    to,
    preheader: `Your $${price} payment proof is with our team for confirmation.`,
    eyebrow: "Payment received",
    title: "Your payment is under review",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Thank you. We have received your Premium payment submission of <strong>$${price}</strong>${method ? ` via ${escapeHtml(method)}` : ""}.`,
      "An administrator will confirm the transfer. Once it is approved, Premium will be activated on your account and you will receive another email.",
    ],
    details: [
      { label: "Amount", value: `$${price} USD` },
      { label: "Method", value: method || "Local transfer" },
      { label: "Status", value: "Awaiting confirmation" },
    ],
    ctaLabel: "View billing",
    ctaUrl: `${getPublicClientUrl()}/billing`,
    note: "If you sent the wrong receipt, submit a new one after this payment is reviewed, or contact ShoufBayt.",
  };

  return deliver(payload, subject, "payment submitted email");
};

export const sendPaymentRejectedEmail = async ({
  to,
  username,
  reason,
  refunded = false,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const subject = refunded
    ? "Your ShoufBayt payment was refunded"
    : "Your ShoufBayt payment could not be confirmed";

  const payload = {
    to,
    preheader: refunded
      ? "Your Premium payment was refunded. You can submit a new payment from Billing."
      : "We could not verify your Premium payment. Please check the details and try again.",
    eyebrow: "Payment update",
    title: refunded ? "Payment refunded" : "Payment not confirmed",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      refunded
        ? "Your ShoufBayt Premium payment has been marked as refunded."
        : "We were unable to confirm the Premium payment you submitted.",
      reason
        ? `Note from our team: <strong>${escapeHtml(reason)}</strong>`
        : "Please check the amount, transfer details, and receipt, then submit a new payment from Billing.",
    ],
    details: [
      { label: "Status", value: refunded ? "Refunded" : "Not confirmed" },
      { label: "Amount due", value: `$${PLAN_PRICES.PREMIUM} USD` },
    ],
    ctaLabel: "Return to billing",
    ctaUrl: `${getPublicClientUrl()}/billing`,
    note: "If you believe this is a mistake, reply to this email or use the contact page.",
  };

  return deliver(payload, subject, "payment rejected email");
};

export const sendGraceStartedEmail = async ({ to, username, graceEndsAt }) => {
  if (!to) return null;

  const name = username || "valued partner";
  const when = formatWhen(graceEndsAt);
  const price = PLAN_PRICES.PREMIUM;
  const subject = "Your Premium plan has ended — 7 days to renew";

  const payload = {
    to,
    preheader: `Your Premium period ended. Existing listings stay online until ${when}. Pay $${price} to remain an agent.`,
    eyebrow: "Renewal reminder",
    title: "You are in a courtesy period",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      "Your ShoufBayt Premium period has ended, and payment has not yet been received.",
      `Your existing listings will remain online until <strong>${escapeHtml(when)}</strong>. After that date, your account becomes a standard user and listings are paused.`,
      payeeInstructionParagraph(price),
    ],
    details: [
      { label: "Status", value: "Courtesy period" },
      { label: "Courtesy ends", value: when },
      ...payeeEmailDetails(price),
    ],
    ctaLabel: `Renew Premium · $${price}`,
    ctaUrl: `${getPublicClientUrl()}/billing`,
    note: "This is an automated account notice from ShoufBayt.",
  };

  return deliver(payload, subject, "grace started email");
};

export const sendSubscriptionCancelledEmail = async ({
  to,
  username,
  endDate,
  isTrial,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const when = formatWhen(endDate);
  const price = PLAN_PRICES.PREMIUM;
  const periodLabel = isTrial ? "trial" : "Premium period";
  const subject = "Your ShoufBayt subscription will not renew";

  const payload = {
    to,
    preheader: `Cancellation confirmed. You keep access until ${when}. Pay $${price} before then if you wish to stay an agent.`,
    eyebrow: "Subscription",
    title: "Your cancellation is confirmed",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `We have cancelled your ShoufBayt ${periodLabel}. You will not be asked to renew automatically.`,
      `You keep your current agent access until <strong>${escapeHtml(when)}</strong>. After that, a ${GRACE_DAYS}-day courtesy period applies, then your account returns to a standard user profile and listings are paused.`,
      "If you change your mind before this period ends, open Billing and choose Resume plan. You will keep the remaining days without paying again.",
      payeeInstructionParagraph(price),
    ],
    details: [
      { label: "Status", value: "Cancels at period end" },
      { label: "Access until", value: when },
      ...payeeEmailDetails(price),
    ],
    ctaLabel: "Open billing",
    ctaUrl: `${getPublicClientUrl()}/billing`,
    note: "You can resume this period from Billing, or send a new payment and upload the receipt to start a fresh Premium month.",
  };

  return deliver(payload, subject, "subscription cancelled email");
};

export const sendSubscriptionResumedEmail = async ({
  to,
  username,
  endDate,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const when = formatWhen(endDate);
  const subject = "Your ShoufBayt Premium plan has been resumed";

  const payload = {
    to,
    preheader: `Your cancellation was withdrawn. Premium stays active until ${when}.`,
    eyebrow: "Subscription",
    title: "Your plan is active again",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      "You resumed your ShoufBayt Premium plan. The cancellation for this period has been withdrawn.",
      `Your agent access remains active until <strong>${escapeHtml(when)}</strong>.`,
    ],
    details: [
      { label: "Status", value: "Premium active" },
      { label: "Active until", value: when },
    ],
    ctaLabel: "Open billing",
    ctaUrl: `${getPublicClientUrl()}/billing`,
    note: "You can cancel again at any time from Billing. Access then continues until the period end date.",
  };

  return deliver(payload, subject, "subscription resumed email");
};

export const sendAutoRenewFailedEmail = async ({ to, username }) => {
  if (!to) return null;

  const name = username || "valued partner";
  const price = PLAN_PRICES.PREMIUM;
  const subject = "We could not renew your ShoufBayt Premium plan";

  const payload = {
    to,
    preheader: `Your saved card could not be charged. Pay $${price} from Billing to keep your agent account.`,
    eyebrow: "Payment failed",
    title: "Automatic renewal was unsuccessful",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `We attempted to charge your saved card for the ShoufBayt Premium fee of <strong>$${price}</strong>, but the payment did not go through.`,
      "Auto-renew has been turned off so we will not keep retrying this card. Please update your payment method or pay another way from Billing.",
      `If payment is not completed, you will enter a ${GRACE_DAYS}-day courtesy period, then your agent account will be paused.`,
    ],
    details: [
      { label: "Amount due", value: `$${price} USD` },
      { label: "Auto-renew", value: "Turned off" },
    ],
    ctaLabel: "Update billing",
    ctaUrl: `${getPublicClientUrl()}/billing`,
    note: "Your listings stay online until the current period and courtesy window end.",
  };

  return deliver(payload, subject, "auto-renew failed email");
};
