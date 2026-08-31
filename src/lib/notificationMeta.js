const MESSAGE_TYPES = new Set(["NEW_MESSAGE", "CONTACT_REPLY"]);

const TYPE_TONE = {
  NEW_MESSAGE: "message",
  CONTACT_REPLY: "message",
  PROPERTY_APPROVED: "success",
  PROPERTY_REJECTED: "danger",
  AGENT_APPLICATION_APPROVED: "success",
  AGENT_APPLICATION_REJECTED: "danger",
  PAYMENT_CONFIRMED: "success",
  PAYMENT_FAILED: "danger",
  SUBSCRIPTION_EXPIRING: "warning",
  SUBSCRIPTION_EXPIRED: "danger",
  LISTING_REQUEST: "listing",
  LISTING_REQUEST_ACCEPTED: "success",
  LISTING_REQUEST_REJECTED: "danger",
  LISTING_LEAD: "listing",
  LISTING_PROPOSAL: "listing",
  LISTING_PROPOSAL_ACCEPTED: "success",
  LISTING_PROPOSAL_REJECTED: "danger",
  APPOINTMENT_SCHEDULED: "calendar",
  APPOINTMENT_UPDATED: "calendar",
  APPOINTMENT_REQUESTED: "calendar",
  APPOINTMENT_REMINDER: "calendar",
  GENERAL: "neutral",
};

export function notificationTypeKey(type) {
  return String(type || "GENERAL").toUpperCase();
}

export function isUnread(item) {
  if (!item) return false;
  return item.isRead !== true;
}

export function parseNotificationList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notifications)) return data.notifications;
  if (Array.isArray(data?.data?.notifications)) return data.data.notifications;
  return [];
}

export function countUnreadAlerts(items = []) {
  return items.filter((item) => isUnread(item) && !isMessageType(item?.type))
    .length;
}

export function isMessageType(type) {
  return MESSAGE_TYPES.has(notificationTypeKey(type));
}

export function getTypeTone(type) {
  return TYPE_TONE[notificationTypeKey(type)] || "neutral";
}

export function resolveNotificationLink(link = "") {
  if (!link || typeof link !== "string") {
    return "";
  }

  if (link.startsWith("/property/")) {
    return `/properties/${link.slice("/property/".length)}`;
  }

  if (link === "/") {
    return "/?support=1";
  }

  return link;
}

export function formatRelativeTime(value, language = "en") {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const locale = String(language || "en").startsWith("ar") ? "ar" : "en";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(minutes) < 1) {
    return locale === "ar" ? "الآن" : "Just now";
  }

  if (Math.abs(minutes) < 60) {
    return rtf.format(-minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return rtf.format(-hours, "hour");
  }

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) {
    return rtf.format(-days, "day");
  }

  return date.toLocaleDateString(locale === "ar" ? "ar-LB" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function groupByDay(value) {
  if (!value) {
    return "earlier";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "earlier";
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - day.getTime()) / 86400000);

  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return "earlier";
}
