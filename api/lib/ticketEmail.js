import { trySendMail } from "./sendEmail.js";
import {
  escapeHtml,
  getPublicClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

const STATUS_COPY = {
  OPEN: "Open — waiting for a lawyer",
  IN_REVIEW: "In review",
  WAITING_USER: "Waiting on you",
  WAITING_OTHER: "Waiting on the other party",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const deliver = (to, subject, payload, label) => {
  if (!to) return null;
  return trySendMail(
    {
      to,
      subject,
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    label
  );
};

const ticketUrl = (number) => `${getPublicClientUrl()}/tickets/${number}`;

const baseDetails = ({ number, title, status, lawyerName }) =>
  [
    { label: "Ticket", value: number },
    { label: "Subject", value: title },
    status
      ? { label: "Status", value: STATUS_COPY[status] || status }
      : null,
    lawyerName ? { label: "Lawyer", value: lawyerName } : null,
  ].filter(Boolean);

export const sendTicketOpenedEmail = async ({
  to,
  username,
  number,
  title,
  category,
}) => {
  const name = username || "there";
  const payload = {
    to,
    preheader: `${number} is open. An admin will assign a lawyer.`,
    eyebrow: "Legal ticket",
    title: "We received your ticket",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Your request <strong>${escapeHtml(number)}</strong> is now in our legal desk.`,
      "An administrator will assign a lawyer. You will get another email when that happens, and again whenever there is a reply or a status change.",
    ],
    details: [
      ...baseDetails({ number, title, status: "OPEN" }),
      category ? { label: "Category", value: category } : null,
    ].filter(Boolean),
    ctaLabel: "Open your ticket",
    ctaUrl: ticketUrl(number),
    note: "This is an automated message from ShoufBayt.",
  };

  return deliver(to, `${number}: we received your ticket`, payload, "ticket opened email");
};

export const sendTicketAssignedEmail = async ({
  to,
  username,
  number,
  title,
  lawyerName,
}) => {
  const name = username || "there";
  const lawyer = lawyerName || "a ShoufBayt lawyer";
  const payload = {
    to,
    preheader: `${lawyer} is now handling ${number}.`,
    eyebrow: "Legal ticket",
    title: "A lawyer has been assigned",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `<strong>${escapeHtml(lawyer)}</strong> is now handling ticket <strong>${escapeHtml(number)}</strong>.`,
      "You can follow the case and reply from your ticket page.",
    ],
    details: baseDetails({
      number,
      title,
      status: "IN_REVIEW",
      lawyerName: lawyer,
    }),
    ctaLabel: "View assigned lawyer",
    ctaUrl: ticketUrl(number),
    note: "This is an automated message from ShoufBayt.",
  };

  return deliver(
    to,
    `${number}: assigned to ${lawyer}`,
    payload,
    "ticket assigned email"
  );
};

export const sendTicketAssignedLawyerEmail = async ({
  to,
  username,
  number,
  title,
  clientName,
  phone,
}) => {
  const name = username || "counsel";
  const payload = {
    to,
    preheader: `${number} has been assigned to you.`,
    eyebrow: "Lawyer desk",
    title: "A ticket was assigned to you",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Ticket <strong>${escapeHtml(number)}</strong> from ${escapeHtml(clientName || "a client")} is now on your desk.`,
      "Open your lawyer dashboard to review and reply.",
    ],
    details: [
      ...baseDetails({ number, title, status: "IN_REVIEW" }),
      phone ? { label: "Client phone", value: phone } : null,
    ].filter(Boolean),
    ctaLabel: "Open lawyer desk",
    ctaUrl: `${getPublicClientUrl()}/lawyer`,
    note: "This is an automated message from ShoufBayt.",
  };

  return deliver(to, `${number}: assigned to you`, payload, "ticket assigned lawyer email");
};

export const sendTicketStatusEmail = async ({
  to,
  username,
  number,
  title,
  status,
  lawyerName,
}) => {
  const name = username || "there";
  const label = STATUS_COPY[status] || status;
  const payload = {
    to,
    preheader: `${number} is now ${label}.`,
    eyebrow: "Legal ticket",
    title: "Your ticket status changed",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `Ticket <strong>${escapeHtml(number)}</strong> is now <strong>${escapeHtml(label)}</strong>.`,
    ],
    details: baseDetails({ number, title, status, lawyerName }),
    ctaLabel: "Open your ticket",
    ctaUrl: ticketUrl(number),
    note: "This is an automated message from ShoufBayt.",
  };

  return deliver(to, `${number}: ${label}`, payload, "ticket status email");
};

export const sendTicketReplyEmail = async ({
  to,
  username,
  number,
  title,
  preview,
  fromName,
}) => {
  const name = username || "there";
  const payload = {
    to,
    preheader: `${fromName || "Your lawyer"} replied on ${number}.`,
    eyebrow: "Legal ticket",
    title: "New reply on your ticket",
    greeting: `Dear ${escapeHtml(name)},`,
    paragraphs: [
      `${escapeHtml(fromName || "Your lawyer")} replied on <strong>${escapeHtml(number)}</strong>.`,
      preview ? `<em>${escapeHtml(preview)}</em>` : "",
    ].filter(Boolean),
    details: baseDetails({ number, title }),
    ctaLabel: "Read the reply",
    ctaUrl: ticketUrl(number),
    note: "This is an automated message from ShoufBayt.",
  };

  return deliver(to, `${number}: new reply`, payload, "ticket reply email");
};
