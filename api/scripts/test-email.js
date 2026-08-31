import "../lib/dnsIPv4.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendLoginCodeEmail, sendMail } from "../lib/sendEmail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const to = process.argv[2] || process.env.EMAIL_TEST_TO || process.env.EMAIL_USER;

const summarize = () => ({
  hasResend: Boolean(String(process.env.RESEND_API_KEY || "").trim()),
  hasSmtpHost: Boolean(String(process.env.SMTP_HOST || "").trim()),
  hasEmailUser: Boolean(String(process.env.EMAIL_USER || "").trim()),
  hasEmailPass: Boolean(String(process.env.EMAIL_PASS || "").trim()),
  emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER || null,
  to,
});

const run = async () => {
  console.log("EMAIL CONFIG", summarize());

  try {
    const result = await sendLoginCodeEmail(to, "123456");
    console.log("SEND OK", {
      provider: result.provider,
      messageId: result.messageId,
      accepted: result.accepted,
    });
  } catch (error) {
    console.error("SEND FAIL", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    process.exitCode = 1;
  }
};

run();
