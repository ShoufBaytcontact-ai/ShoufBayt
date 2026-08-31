import { isLaunchPremiumFree } from "./subscription.js";
import { processLaunchPeriodEmails } from "./launchPeriodEmail.js";

const INTERVAL_MS = 60 * 60 * 1000;

let started = false;

export const startLaunchPeriodEmailJob = () => {
  if (started) return;
  started = true;

  const run = () => {
    if (isLaunchPremiumFree()) return;

    processLaunchPeriodEmails().catch((error) => {
      console.error("Launch-period email job failed", error);
    });
  };

  setTimeout(run, 40_000);
  setInterval(run, INTERVAL_MS);
  console.log(
    "Launch-period email job started (hourly after complimentary Premium ends)"
  );
};
