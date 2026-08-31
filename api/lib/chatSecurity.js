import { isCloudAssetUrl } from "./cloudStorage.js";

const DANGEROUS_PROTOCOLS =
  /^(javascript|data|vbscript|file|blob):/i;

const URL_IN_TEXT =
  /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

export function cleanOriginalName(name = "") {
  return String(name || "file")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

export function isAllowedHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;

  try {
    const withProtocol = raw.startsWith("www.") ? `https://${raw}` : raw;
    const url = new URL(withProtocol);

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (DANGEROUS_PROTOCOLS.test(url.protocol)) {
      return false;
    }

    // Block credentials-in-URL and obvious IP abuse is left soft;
    // host must exist and not be empty.
    if (!url.hostname) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Strip dangerous URL schemes from free text; keep plain text.
 * Does not auto-embed remote content — only sanitizes what users type.
 */
export function sanitizeMessageText(value) {
  let text = String(value || "").trim();
  if (!text) return "";

  // Neutralize dangerous schemes even when not full URLs
  text = text.replace(
    /\b(?:javascript|data|vbscript|file)\s*:/gi,
    "[blocked]:"
  );

  text = text.replace(URL_IN_TEXT, (match) => {
    if (isAllowedHttpUrl(match)) {
      return match;
    }
    return "[blocked-link]";
  });

  if (text.length > 5000) {
    text = text.slice(0, 5000);
  }

  return text;
}

/**
 * Only allow media that was uploaded to this API's /uploads/chat/ path.
 * Rejects external hotlinks and javascript/data URLs.
 */
export function isSafeChatMediaUrl(value, req) {
  const raw = String(value || "").trim();
  if (!raw) return false;

  if (DANGEROUS_PROTOCOLS.test(raw)) {
    return false;
  }

  if (raw.startsWith("/uploads/chat/")) {
    return !raw.includes("..");
  }

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (url.protocol === "https:" && isCloudAssetUrl(raw)) {
      return true;
    }

    const host = req?.get?.("host");
    if (host && url.host !== host) {
      return false;
    }

    return (
      url.pathname.startsWith("/uploads/chat/") && !url.pathname.includes("..")
    );
  } catch {
    return false;
  }
}

export function buildChatUploadUrl(req, filename) {
  const safeName = String(filename || "").replace(/[/\\]/g, "");
  return `${req.protocol}://${req.get("host")}/uploads/chat/${safeName}`;
}

export function previewForLastMessage({ text, mediaKind, mediaName }) {
  if (text) return text.slice(0, 200);
  if (mediaKind === "deleted") return "";
  if (mediaKind === "voice") return "Voice note";
  if (mediaKind === "file") return mediaName ? `File: ${mediaName}` : "File";
  if (mediaKind === "image") return "Image";
  return "";
}
