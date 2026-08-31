import prisma from "./prisma.js";
import { chargeSavedCardForRenewal } from "./billingActivation.js";

const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;

let started = false;

/**
 * Charge saved cards for Premium subscriptions that end within 24h and have autoRenew on.
 */
export const runAutoRenewJob = async () => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + RENEWAL_WINDOW_MS);

  const due = await prisma.subscription.findMany({
    where: {
      isCurrent: true,
      autoRenew: true,
      isTrial: false,
      status: { in: ["ACTIVE", "GRACE"] },
      endDate: {
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      userId: true,
      endDate: true,
    },
  });

  for (const sub of due) {
    try {
      const result = await chargeSavedCardForRenewal(sub.userId);
      if (result.ok) {
        console.log(`[auto-renew] Renewed user ${sub.userId}`);
      } else if (result.reason !== "pending_payment") {
        console.warn(
          `[auto-renew] Skipped user ${sub.userId}: ${result.reason}`
        );
      }
    } catch (error) {
      console.error(`[auto-renew] Failed for user ${sub.userId}`, error);
    }
  }
};

export const startAutoRenewJob = () => {
  if (started) return;
  started = true;

  setTimeout(() => {
    runAutoRenewJob().catch((error) =>
      console.error("[auto-renew] Initial run failed", error)
    );
  }, 20_000);

  setInterval(() => {
    runAutoRenewJob().catch((error) =>
      console.error("[auto-renew] Run failed", error)
    );
  }, INTERVAL_MS);

  console.log("[auto-renew] Job scheduled (hourly)");
};
