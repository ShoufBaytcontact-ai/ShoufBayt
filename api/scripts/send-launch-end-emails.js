import "../lib/dnsIPv4.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  getLaunchPeriodStatus,
  processLaunchPeriodEmails,
  sendLaunchPeriodEndedEmail,
} from "../lib/launchPeriodEmail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const prefix = `--${name}=`;
  const found = args.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const isTest = args.includes("--test");
const force = args.includes("--force");
const email = getArg("email");
const role = getArg("role", "USER").toUpperCase();
const username = getArg("username", "there");

const run = async () => {
  const status = await getLaunchPeriodStatus();
  console.log("LAUNCH PERIOD", {
    complimentaryActive: status.complimentaryActive,
    complimentaryUntil: status.complimentaryUntil,
    daysLeft: status.daysLeft,
    sentCount: status.sentCount,
    pendingCount: status.pendingCount,
  });

  if (isTest) {
    if (!email) {
      throw new Error("Pass --test --email=you@example.com [--role=USER|AGENT|ADMIN]");
    }

    const result = await sendLaunchPeriodEndedEmail({
      to: email,
      username,
      role,
      test: true,
    });
    console.log("TEST EMAIL", { to: email, role, ok: Boolean(result) });
    return;
  }

  const result = await processLaunchPeriodEmails({
    force,
    limit: Number(getArg("limit", "80")) || 80,
  });
  console.log("SEND RESULT", result);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
