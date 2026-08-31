import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LOGO_CID = "shoufbayt-logo@shoufbayt";
export const LOGO_PATH = path.join(__dirname, "../assets/email-logo.png");

export const getClientUrl = () =>
  String(process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

export const getPublicClientUrl = () => getClientUrl();

export const getLogoUrl = () => {
  const custom = String(process.env.EMAIL_LOGO_URL || "").trim();
  if (/^https:\/\//i.test(custom)) return custom;
  const publicUrl = getPublicClientUrl();
  return publicUrl ? `${publicUrl}/email-logo.png` : "";
};

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const getLogoAttachment = () => {
  try {
    if (!fs.existsSync(LOGO_PATH)) return null;
    const content = fs.readFileSync(LOGO_PATH);
    return {
      filename: "shoufbayt-logo.png",
      content,
      contentType: "image/png",
      cid: LOGO_CID,
    };
  } catch (error) {
    console.error("Failed to load ShoufBayt email logo", error);
    return null;
  }
};

const detailRows = (details = []) =>
  details
    .filter((item) => item && item.value)
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #ece7dc;width:38%;font-size:13px;color:#8a8478;letter-spacing:0.04em;text-transform:uppercase;">
            ${escapeHtml(item.label)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #ece7dc;font-size:15px;color:#17150f;font-weight:600;">
            ${escapeHtml(item.value)}
          </td>
        </tr>`
    )
    .join("");

/**
 * Professional ShoufBayt HTML wrapper used by every transactional email.
 * Logo is embedded via cid so it shows even when the site is not publicly hosted.
 */
export const wrapEmailHtml = ({
  preheader = "",
  eyebrow = "ShoufBayt",
  title,
  greeting,
  paragraphs = [],
  details = [],
  highlightHtml = "",
  ctaLabel,
  ctaUrl,
  note,
}) => {
  const logoUrl = getLogoUrl();
  const siteUrl = getPublicClientUrl();
  const year = new Date().getFullYear();
  const logo = getLogoAttachment();
  const logoHtml = logo
    ? `<img src="cid:${LOGO_CID}" alt="ShoufBayt" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;border-radius:12px;" />`
    : logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="ShoufBayt" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;border-radius:12px;" />`
      : `<div style="width:48px;height:48px;border-radius:12px;background:#16120a;border:1px solid rgba(226,184,74,0.45);color:#e2b84a;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:48px;text-align:center;font-weight:700;">SE</div>`;
  const bodyCopy = paragraphs
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#3f3b34;">${paragraph}</p>`
    )
    .join("");

  const detailsHtml = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;border-collapse:collapse;">${detailRows(details)}</table>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl && /^https?:\/\//i.test(ctaUrl)
      ? `<p style="margin:28px 0 8px 0;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#e2b84a;color:#14110b;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;padding:14px 26px;border-radius:999px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </p>`
      : "";

  const noteHtml = note
    ? `<p style="margin:22px 0 0 0;font-size:13px;line-height:1.6;color:#8a8478;">${note}</p>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;color:#17150f;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader || title)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ea;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e8e2d6;">
          <tr>
            <td style="background:#0c0e12;padding:28px 36px 24px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    ${logoHtml}
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.1;color:#f4f1ea;font-weight:700;">ShoufBayt</p>
                    <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#e2b84a;">Real Estate Platform</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:#e2b84a;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 36px 16px 36px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#b8891f;font-weight:700;">
                ${escapeHtml(eyebrow)}
              </p>
              <h1 style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#17150f;font-weight:700;">
                ${escapeHtml(title)}
              </h1>
              ${
                greeting
                  ? `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#17150f;">${greeting}</p>`
                  : ""
              }
              ${bodyCopy}
              ${highlightHtml || ""}
              ${detailsHtml}
              ${ctaHtml}
              ${noteHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 32px 36px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:14px;line-height:1.7;color:#5c574c;">
                Kind regards,<br />
                <strong style="color:#17150f;">The ShoufBayt Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#faf8f4;padding:22px 36px;border-top:1px solid #ece7dc;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#8a8478;">
                ShoufBayt · Lebanon real estate, professionally managed.
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;color:#a8a59c;">
                This is an automated message from a no-reply address. Please do not reply; replies are not read.
              </p>
              <p style="margin:0;font-size:12px;color:#a8a59c;">
                ${
                  siteUrl
                    ? `<a href="${escapeHtml(siteUrl)}" style="color:#b8891f;text-decoration:none;">Visit ShoufBayt</a>&nbsp;·&nbsp;`
                    : ""
                }
                © ${year} ShoufBayt. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

export const wrapEmailText = ({
  title,
  greeting,
  paragraphs = [],
  details = [],
  messageLabel,
  messageBody,
  ctaLabel,
  ctaUrl,
  note,
}) => {
  const lines = [
    "ShoufBayt · Real Estate Platform",
    "",
    title,
    "",
    greeting,
    ...paragraphs.filter(Boolean).map((item) => String(item).replace(/<[^>]+>/g, "")),
    "",
    messageBody
      ? `${messageLabel || "Message"}:\n${String(messageBody).trim()}`
      : "",
    "",
    ...details
      .filter((item) => item?.value)
      .map((item) => `${item.label}: ${item.value}`),
    ctaLabel && ctaUrl && /^https?:\/\//i.test(ctaUrl)
      ? `${ctaLabel}: ${ctaUrl}`
      : "",
    note ? String(note).replace(/<[^>]+>/g, "") : "",
    "",
    "Kind regards,",
    "The ShoufBayt Team",
    "This is an automated no-reply message. Please do not reply.",
    getClientUrl(),
  ];

  return lines.filter((line) => line !== "").join("\n");
};
