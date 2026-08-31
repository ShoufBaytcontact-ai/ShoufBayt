/**
 * Render message text safely: only http(s) links become clickable.
 * Dangerous schemes are shown as plain blocked text.
 */
import { API_ORIGIN } from "./apiConfig";

export function renderSafeMessageText(text) {
  const raw = String(text || "");
  if (!raw) return [];

  const parts = [];
  const pattern = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: raw.slice(lastIndex, match.index) });
    }

    const urlText = match[1];
    const href = urlText.startsWith("www.") ? `https://${urlText}` : urlText;

    try {
      const parsed = new URL(href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        parts.push({ type: "link", value: urlText, href: parsed.toString() });
      } else {
        parts.push({ type: "text", value: "[blocked-link]" });
      }
    } catch {
      parts.push({ type: "text", value: "[blocked-link]" });
    }

    lastIndex = match.index + urlText.length;
  }

  if (lastIndex < raw.length) {
    parts.push({ type: "text", value: raw.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value: raw }];
}

export function resolveMediaUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  if (raw.startsWith("blob:") || raw.startsWith("data:audio")) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API_ORIGIN}${raw}`;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
      }
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}
