import "./dnsIPv4.js";
import "./loadEnv.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import {
  escapeHtml,
  getClientUrl,
  getLogoAttachment,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

/**
 * Provider priority (best inbox → worst for OTP):
 * 1) RESEND_API_KEY
 * 2) SMTP_HOST (Brevo / SendGrid / Mailgun)
 * 3) Gmail EMAIL_USER + EMAIL_PASS
 */

const clean = (value) => String(value || "").trim().replace(/^["']|["']$/g, "");

const parseEmailAddress = (value) => {
  const raw = clean(value);
  if (!raw) return "";
  const angled = raw.match(/<([^>]+)>/);
  if (angled) return clean(angled[1]);
  return raw;
};

const getFromAddress = () => {
  const user = parseEmailAddress(process.env.EMAIL_USER);
  const from = parseEmailAddress(
    process.env.EMAIL_FROM || process.env.EMAIL_USER
  );
  if (!from || !/@/.test(from)) {
    throw new Error(
      "Set EMAIL_FROM (or EMAIL_USER) to the sender email address"
    );
  }

  // Gmail only accepts the authenticated mailbox as From.
  if (
    user &&
    from.toLowerCase() !== user.toLowerCase() &&
    !clean(process.env.RESEND_API_KEY) &&
    !clean(process.env.SMTP_HOST)
  ) {
    console.warn(
      `EMAIL WARNING: EMAIL_FROM (${from}) does not match EMAIL_USER. Sending as ${user} so Gmail accepts the message.`
    );
    return user;
  }

  return from;
};

const getFromName = () => {
  const custom = clean(process.env.EMAIL_FROM_NAME);
  if (custom) {
    return custom.replace(/\s*\(no-reply\)\s*/i, "").trim() || "ShoufBayt";
  }
  return "ShoufBayt";
};

const usesGmailSmtp = () =>
  !clean(process.env.RESEND_API_KEY) && !clean(process.env.SMTP_HOST);

const emailDomainFromAddress = (address) => {
  const match = String(address || "").match(/@([^>\s]+)/);
  return match?.[1]?.replace(/[>]$/, "") || "";
};

const getNoReplyAddress = () => {
  const explicit = parseEmailAddress(
    process.env.EMAIL_NOREPLY || process.env.EMAIL_REPLY_TO
  );
  if (explicit && /@/.test(explicit) && /noreply|no-reply/i.test(explicit)) {
    return explicit;
  }

  const fromDomain = emailDomainFromAddress(
    parseEmailAddress(process.env.EMAIL_FROM || process.env.EMAIL_USER)
  );
  if (fromDomain && !/gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|yahoo\.com/i.test(fromDomain)) {
    return `noreply@${fromDomain}`;
  }

  try {
    const host = new URL(getClientUrl()).hostname.replace(/^www\./, "");
    if (host && host !== "localhost" && !/^\d/.test(host)) {
      return `noreply@${host}`;
    }
  } catch {
    /* ignore */
  }

  return "noreply@shoufbayt.com";
};

const getReplyToAddress = (fromAddress) => {
  const fromDomain = emailDomainFromAddress(fromAddress);
  const isConsumerMailbox =
    /gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|yahoo\.com/i.test(
      fromDomain
    );

  // Gmail SMTP + a foreign Reply-To (noreply@shoufbayt.com) makes other
  // inboxes treat the message as spoofed. Keep Reply-To on the same mailbox.
  if (isConsumerMailbox) {
    return fromAddress;
  }

  return getNoReplyAddress();
};

const codeHighlight = (code) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
    <tr>
      <td align="center" style="background:#faf8f4;border:1px solid #e8e2d6;border-radius:14px;padding:22px 16px;">
        <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8478;">Verification code</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:8px;font-weight:700;color:#17150f;">
          ${escapeHtml(code)}
        </p>
      </td>
    </tr>
  </table>
`;

const buildLoginEmail = (code) => {
  const title = "Your sign-in code";
  const siteUrl = getClientUrl();
  const payload = {
    preheader: `Your ShoufBayt sign-in code is ${code}. It expires in 10 minutes.`,
    eyebrow: "Secure access",
    title,
    greeting: "Hello,",
    paragraphs: [
      "Use this code to finish signing in to your ShoufBayt account.",
    ],
    highlightHtml: codeHighlight(code),
    details: [{ label: "Expires", value: "In 10 minutes" }],
    ctaLabel: siteUrl ? "Open ShoufBayt" : undefined,
    ctaUrl: siteUrl || undefined,
    note: "If you did not try to sign in, you can ignore this email. Do not share this code with anyone.",
  };

  return {
    text: wrapEmailText({
      ...payload,
      paragraphs: [
        ...payload.paragraphs,
        `Your verification code is ${code}.`,
      ],
    }),
    html: wrapEmailHtml(payload),
  };
};

const buildPasswordResetEmail = (code) => {
  const title = "Reset your password";
  const siteUrl = getClientUrl();
  const payload = {
    preheader: `Your ShoufBayt password reset code is ${code}. It expires in 10 minutes.`,
    eyebrow: "Account security",
    title,
    greeting: "Hello,",
    paragraphs: [
      "Use this code to choose a new password for your ShoufBayt account.",
    ],
    highlightHtml: codeHighlight(code),
    details: [{ label: "Expires", value: "In 10 minutes" }],
    ctaLabel: siteUrl ? "Open ShoufBayt" : undefined,
    ctaUrl: siteUrl || undefined,
    note: "If you did not request a password reset, you can ignore this email. Your current password will remain unchanged.",
  };

  return {
    text: wrapEmailText({
      ...payload,
      paragraphs: [
        ...payload.paragraphs,
        `Your password reset code is ${code}.`,
      ],
    }),
    html: wrapEmailHtml(payload),
  };
};

const sendWithResend = async ({
  to,
  subject,
  text,
  html,
  fromAddress,
  fromName,
  attachments,
}) => {
  const apiKey = clean(process.env.RESEND_API_KEY);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject,
      text,
      html,
      reply_to: getReplyToAddress(fromAddress),
      attachments: attachments?.length
        ? attachments.map((item) => ({
            filename: item.filename,
            content: Buffer.isBuffer(item.content)
              ? item.content.toString("base64")
              : item.content,
            content_id: item.cid,
            content_type: item.contentType || "image/png",
          }))
        : undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message || `Resend failed with status ${response.status}`
    );
  }

  return {
    messageId: data.id || "resend",
    accepted: [to],
    provider: "resend",
  };
};

const smtpTimeouts = {
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 30000,
};

const createGmailTransporter = (port, secure) => {
  const user = clean(process.env.EMAIL_USER);
  const pass = clean(process.env.EMAIL_PASS).replace(/\s+/g, "");

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port,
    secure,
    auth: { user, pass },
    ...smtpTimeouts,
    family: 4,
    tls: {
      servername: "smtp.gmail.com",
    },
  });
};

const createSmtpTransporter = () => {
  if (clean(process.env.SMTP_HOST)) {
    return {
      provider: "smtp",
      transporter: nodemailer.createTransport({
        host: clean(process.env.SMTP_HOST),
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "false") === "true",
        auth: {
          user: clean(process.env.SMTP_USER || process.env.EMAIL_USER),
          pass: clean(process.env.SMTP_PASS || process.env.EMAIL_PASS).replace(
            /\s+/g,
            ""
          ),
        },
        ...smtpTimeouts,
      }),
    };
  }

  const user = clean(process.env.EMAIL_USER);
  const pass = clean(process.env.EMAIL_PASS).replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error(
      "No email provider configured. Set RESEND_API_KEY, or SMTP_HOST, or EMAIL_USER/EMAIL_PASS."
    );
  }

  console.warn(
    "EMAIL WARNING: Using Gmail SMTP. Messages may land in Spam. Prefer Resend or Brevo for inbox delivery."
  );

  return {
    provider: "gmail",
    transporter: createGmailTransporter(465, true),
    fallback: createGmailTransporter(587, false),
  };
};

let cachedSmtp = null;

const getSmtp = () => {
  if (!cachedSmtp) {
    cachedSmtp = createSmtpTransporter();
  }
  return cachedSmtp;
};

const deliverWithTransporter = async (transporter, mail) =>
  transporter.sendMail(mail);

const sendWithSmtp = async ({
  to,
  subject,
  text,
  html,
  fromAddress,
  fromName,
  attachments,
}) => {
  const { provider, transporter, fallback } = getSmtp();
  const replyTo = getReplyToAddress(fromAddress);
  const domain = fromAddress.split("@")[1] || "shoufbayt.local";
  const messageId = `<mail.${Date.now()}.${crypto
    .randomBytes(8)
    .toString("hex")}@${domain}>`;

  const mail = {
    from: `"${fromName}" <${fromAddress}>`,
    to,
    replyTo,
    subject,
    text,
    html,
    attachments:
      provider === "gmail" || !attachments?.length
        ? undefined
        : attachments.map((item) => ({
            filename: item.filename,
            content: item.content,
            contentType: item.contentType,
            cid: item.cid,
            contentDisposition: "inline",
            contentTransferEncoding: "base64",
          })),
  };

  if (provider !== "gmail") {
    mail.messageId = messageId;
    mail.headers = {
      "X-Entity-Ref-ID": crypto.randomBytes(12).toString("hex"),
      "X-Mailer": "ShoufBayt",
    };
    mail.envelope = {
      from: fromAddress,
      to,
    };
  }

  try {
    const info = await deliverWithTransporter(transporter, mail);
    if (info.rejected?.length) {
      throw new Error(
        `Provider rejected recipient: ${info.rejected.join(", ")}`
      );
    }
    return {
      messageId: info.messageId,
      accepted: info.accepted,
      provider,
    };
  } catch (error) {
    if (!fallback) {
      throw error;
    }

    console.warn(
      `EMAIL: ${provider} primary SMTP failed (${error.message}). Retrying on port 587.`
    );

    const info = await deliverWithTransporter(fallback, mail);
    if (info.rejected?.length) {
      throw new Error(
        `Provider rejected recipient: ${info.rejected.join(", ")}`
      );
    }
    return {
      messageId: info.messageId,
      accepted: info.accepted,
      provider: `${provider}-587`,
    };
  }
};

export const sendMail = async ({ to, subject, text, html }) => {
  const recipient = clean(to);
  const emailSubject = clean(subject);

  if (!recipient) {
    throw new Error("Recipient email is required");
  }

  if (!emailSubject) {
    throw new Error("Email subject is required");
  }

  const fromAddress = getFromAddress();
  const fromName = getFromName();
  const useResend = Boolean(clean(process.env.RESEND_API_KEY));
  const logo = getLogoAttachment();
  const attachments =
    logo && !usesGmailSmtp() ? [logo] : [];

  try {
    const result = useResend
      ? await sendWithResend({
          to: recipient,
          subject: emailSubject,
          text,
          html,
          fromAddress,
          fromName,
          attachments,
        })
      : await sendWithSmtp({
          to: recipient,
          subject: emailSubject,
          text,
          html,
          fromAddress,
          fromName,
          attachments,
        });

    console.log(
      `EMAIL sent via ${result.provider} to ${recipient} | ${emailSubject} | messageId=${result.messageId || "n/a"}`
    );

    return result;
  } catch (error) {
    const details = [
      error.message,
      error.response,
      error.responseCode,
      error.code,
      error.command,
    ]
      .filter(Boolean)
      .join(" | ");

    console.error(`EMAIL FAILED to ${recipient} | ${emailSubject} | ${details}`);
    throw new Error(`Failed to send email to ${recipient}: ${error.message}`);
  }
};

export const trySendMail = async (payload, label = "email") => {
  if (!payload?.to) {
    console.error(`EMAIL skipped (${label}): missing recipient`);
    return null;
  }

  try {
    return await sendMail(payload);
  } catch (error) {
    console.error(
      `EMAIL FAILED (${label}) to=${payload.to}:`,
      error?.message || error
    );
    return null;
  }
};

export const sendLoginCodeEmail = async (email, code) => {
  if (!email) {
    throw new Error("Recipient email is required");
  }

  const { text, html } = buildLoginEmail(code);

  return sendMail({
    to: email,
    subject: "ShoufBayt sign-in code",
    text,
    html,
  });
};

export const sendPasswordResetCodeEmail = async (email, code) => {
  if (!email) {
    throw new Error("Recipient email is required");
  }

  const { text, html } = buildPasswordResetEmail(code);

  return sendMail({
    to: email,
    subject: "ShoufBayt password reset code",
    text,
    html,
  });
};

export const sendWelcomeEmail = async (email, username) => {
  if (!email) return null;

  const name = String(username || "").trim() || "there";
  const siteUrl = getClientUrl();
  const payload = {
    preheader:
      "Welcome to ShoufBayt. Browse homes in Lebanon, save listings, and talk to verified agents.",
    eyebrow: "Welcome",
    title: "Welcome to ShoufBayt",
    greeting: `Hello ${escapeHtml(name)},`,
    paragraphs: [
      "Your account is ready. You can now browse homes for sale and rent across Lebanon, save properties you like, and message verified agents.",
      "If you own a home, you can ask an agent to list it for you, or publish a listing yourself from your account.",
    ],
    details: [
      { label: "Account", value: name },
      { label: "Next step", value: "Explore homes and save your favourites" },
    ],
    ctaLabel: "Explore homes",
    ctaUrl: siteUrl ? `${siteUrl}/list` : undefined,
    note: "This is an automated welcome message from ShoufBayt. You will also receive a sign-in code whenever you log in.",
  };

  return trySendMail(
    {
      to: email,
      subject: "Welcome to ShoufBayt",
      text: wrapEmailText(payload),
      html: wrapEmailHtml(payload),
    },
    "welcome email"
  );
};
