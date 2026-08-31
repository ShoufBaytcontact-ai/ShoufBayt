/**
 * Normalize subscriptions for Premium-only + trial/grace model.
 * Run with: set NODE_OPTIONS=--dns-result-order=ipv4first&& node scripts/migrate-subscriptions-premium.js
 */
import dns from "dns";
import "dotenv/config";
import prisma from "../lib/prisma.js";

dns.setDefaultResultOrder("ipv4first");

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing in api/.env");
  }

  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    select: {
      id: true,
      userId: true,
      plan: true,
      status: true,
      endDate: true,
      trialEnd: true,
      isTrial: true,
      inactiveAt: true,
    },
  });

  const claimedUserIds = new Set();
  let updated = 0;

  for (const sub of subscriptions) {
    claimedUserIds.add(sub.userId);

    const end = sub.endDate || sub.trialEnd;
    const stillValid = end ? new Date(end) > now : false;
    const status = String(sub.status || "").toUpperCase();
    const wasTrial = status === "TRIAL" || sub.isTrial === true;
    const wasActive = status === "ACTIVE";
    const wasGrace = status === "GRACE";
    const wasCancelled = status === "CANCELLED";
    const wasInactive = status === "INACTIVE";

    let nextStatus = "EXPIRED";
    if (wasCancelled) nextStatus = "CANCELLED";
    else if (wasInactive) nextStatus = "INACTIVE";
    else if (wasGrace && stillValid) nextStatus = "GRACE";
    else if ((wasTrial || wasActive) && stillValid) nextStatus = "ACTIVE";
    else if ((wasTrial || wasActive) && end && now <= addDays(end, 7))
      nextStatus = "GRACE";
    else if ((wasTrial || wasActive) && end && now > addDays(end, 7))
      nextStatus = "INACTIVE";

    const periodEnd = end ? new Date(end) : null;
    const graceEndsAt = periodEnd ? addDays(periodEnd, 7) : null;

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        plan: "PREMIUM",
        status: nextStatus,
        isTrial: Boolean(wasTrial && nextStatus === "ACTIVE"),
        graceEndsAt,
        ...(nextStatus === "INACTIVE" && !sub.inactiveAt
          ? { inactiveAt: now }
          : {}),
      },
    });

    updated += 1;
  }

  for (const userId of claimedUserIds) {
    await prisma.user.update({
      where: { id: userId },
      data: { premiumTrialClaimed: true },
    });
  }

  console.log(
    `Updated ${updated} subscriptions; marked ${claimedUserIds.size} users premiumTrialClaimed.`
  );
}

main()
  .catch((err) => {
    const msg = String(err?.message || err);
    console.error(msg);

    if (msg.includes("querySrv") || msg.includes("ECONNREFUSED")) {
      console.error(`
MongoDB Atlas DNS lookup failed on this machine (querySrv ECONNREFUSED).
Prisma generate does not need the database — that part already succeeded.

Fix the network/DNS, then re-run this script:
  1. Confirm the API can connect (npm run dev in api/)
  2. Try another DNS (e.g. 1.1.1.1 or 8.8.8.8) or disable VPN
  3. Re-run:
     set NODE_OPTIONS=--dns-result-order=ipv4first
     node scripts/migrate-subscriptions-premium.js

Until then the app still works for new Premium/trial logic; old TRIAL/BASIC rows
may need this cleanup when Atlas is reachable.
`);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
