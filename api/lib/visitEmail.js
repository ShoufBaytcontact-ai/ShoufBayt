import { trySendMail } from "./sendEmail.js";
import {
  escapeHtml,
  getPublicClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

const formatWhen = (value) => {
  if (!value) return "the scheduled time";
  try {
    return new Date(value).toLocaleString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

const buildVisitEmail = ({
  username,
  propertyTitle,
  scheduledAt,
  status,
  kind,
}) => {
  const when = formatWhen(scheduledAt);
  const name = username || "valued client";
  const title = propertyTitle || "the selected property";
  const listingsUrl = getPublicClientUrl()
    ? `${getPublicClientUrl()}/list`
    : "";

  const copy = {
    confirmed: {
      subject: "Your ShoufBayt property visit is confirmed",
      eyebrow: "Viewing appointment",
      title: "Your visit has been confirmed",
      preheader: `Your viewing for ${title} is confirmed for ${when}.`,
      intro: `We are pleased to confirm your private viewing of <strong>${escapeHtml(title)}</strong>.`,
    },
    rescheduled: {
      subject: "Your ShoufBayt property visit has been rescheduled",
      eyebrow: "Viewing appointment",
      title: "Your visit has been rescheduled",
      preheader: `Your viewing for ${title} has been moved to ${when}.`,
      intro: `Your viewing of <strong>${escapeHtml(title)}</strong> has been arranged for a new time.`,
    },
    reminder: {
      subject: "Reminder: your ShoufBayt property visit is coming up",
      eyebrow: "Viewing reminder",
      title: "Your viewing is approaching",
      preheader: `Reminder: your visit for ${title} is scheduled for ${when}.`,
      intro: `This is a courtesy reminder of your upcoming viewing of <strong>${escapeHtml(title)}</strong>.`,
    },
    cancelled: {
      subject: "Your ShoufBayt property visit has been cancelled",
      eyebrow: "Viewing appointment",
      title: "Your visit has been cancelled",
      preheader: `Your viewing for ${title} has been cancelled.`,
      intro: `Your viewing of <strong>${escapeHtml(title)}</strong> has been cancelled.`,
    },
    default: {
      subject: "An update on your ShoufBayt property visit",
      eyebrow: "Viewing appointment",
      title: "Your visit details have been updated",
      preheader: `Your viewing for ${title} has been updated.`,
      intro: `There has been an update to your viewing of <strong>${escapeHtml(title)}</strong>.`,
    },
  };

  const selected = copy[kind] || copy.default;

  const payload = {
    preheader: selected.preheader,
    eyebrow: selected.eyebrow,
    title: selected.title,
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      selected.intro,
      kind === "cancelled"
        ? "You may browse other available properties on ShoufBayt or request a new viewing at a time that suits you."
        : "Please arrive a few minutes early and bring a valid form of identification. If you need to change the time, use your ShoufBayt account as soon as possible.",
    ],
    details: [
      { label: "Property", value: title },
      { label: "Scheduled for", value: when },
      status ? { label: "Status", value: String(status).replace(/_/g, " ") } : null,
    ].filter(Boolean),
    ctaLabel: "View properties",
    ctaUrl: listingsUrl,
    note: "This appointment notice was sent by ShoufBayt on behalf of the listing agent or property owner.",
  };

  return {
    subject: selected.subject,
    text: wrapEmailText(payload),
    html: wrapEmailHtml(payload),
  };
};

export const sendVisitStatusEmail = async ({
  to,
  username,
  propertyTitle,
  scheduledAt,
  status,
  kind,
}) => {
  if (!to) return null;

  const { subject, text, html } = buildVisitEmail({
    username,
    propertyTitle,
    scheduledAt,
    status,
    kind,
  });

  return trySendMail({ to, subject, text, html }, "visit status email");
};

export const sendVisitRequestedEmail = async ({
  to,
  username,
  propertyTitle,
  scheduledAt,
  visitorName,
  visitorPhone,
  notes,
}) => {
  if (!to) return null;

  const name = username || "valued partner";
  const title = propertyTitle || "your listing";
  const when = formatWhen(scheduledAt);
  const visitor = visitorName || "A buyer";
  const siteUrl = getPublicClientUrl();
  const subject = `New visit request for ${title}`;

  const payload = {
    preheader: `${visitor} requested a viewing of ${title} on ${when}.`,
    eyebrow: "Visit request",
    title: "A buyer requested a visit",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `<strong>${escapeHtml(visitor)}</strong> asked to view <strong>${escapeHtml(title)}</strong>. Please confirm or reschedule the visit from your agent dashboard.`,
      "The buyer is waiting for your confirmation. Call or message them if you need to change the time.",
    ],
    details: [
      { label: "Property", value: title },
      { label: "Requested time", value: when },
      { label: "Visitor", value: visitor },
      { label: "Phone", value: visitorPhone },
      { label: "Notes", value: notes },
    ],
    ctaLabel: "Review this visit",
    ctaUrl: siteUrl ? `${siteUrl}/agent` : undefined,
    note: "This request was sent by ShoufBayt. Confirming the visit notifies the buyer by email.",
  };

  return trySendMail(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "visit request email"
  );
};
