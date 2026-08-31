import prisma from "./prisma.js";
import { sendSubscriptionExpiringEmail } from "./subscriptionEmail.js";
import {
  PLAN_PRICES,
  getPeriodEnd,
  processDueSubscriptionExpiries,
} from "./subscription.js";

/** Email agents 3 days before their Premium period ends. */
const WARNING_DAYS = 3;
const INTERVAL_MS = 60 * 60 * 1000;

let started = false;

const alreadyReminded = (notifications, subscriptionId) => {
  return notifications.some((item) => {
    const metadata = item.metadata || {};
    return metadata.subscriptionId === subscriptionId;
  });
};

const notifyAgent = async ({ userId, title, message, metadata }) => {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: "SUBSCRIPTION_EXPIRING",
        title,
        message,
        link: "/billing",
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create subscription expiry notification", error);
  }
};

export const processSubscriptionExpiryReminders = async () => {
  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + WARNING_DAYS * 24 * 60 * 60 * 1000
  );

  const subscriptions = await prisma.subscription.findMany({
    where: {
      isCurrent: true,
      status: "ACTIVE",
      OR: [
        { endDate: { gte: now, lte: windowEnd } },
        {
          AND: [
            { endDate: null },
            { trialEnd: { gte: now, lte: windowEnd } },
          ],
        },
      ],
    },
    take: 50,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  });

  if (!subscriptions.length) {
    return 0;
  }

  const userIds = [...new Set(subscriptions.map((item) => item.userId))];
  const existingReminders = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: "SUBSCRIPTION_EXPIRING",
    },
    select: {
      userId: true,
      metadata: true,
    },
  });

  const remindersByUser = new Map();
  for (const reminder of existingReminders) {
    const list = remindersByUser.get(reminder.userId) || [];
    list.push(reminder);
    remindersByUser.set(reminder.userId, list);
  }

  let sent = 0;

  for (const subscription of subscriptions) {
    const endDate = getPeriodEnd(subscription);
    if (!endDate || endDate < now || endDate > windowEnd) {
      continue;
    }

    if (subscription.status === "CANCELLED") {
      continue;
    }

    if (alreadyReminded(remindersByUser.get(subscription.userId) || [], subscription.id)) {
      continue;
    }

    const user = subscription.user;
    if (!user?.email) {
      continue;
    }

    const sentMail = await sendSubscriptionExpiringEmail({
      to: user.email,
      username: user.username,
      endDate,
      isTrial: Boolean(subscription.isTrial),
      autoRenew: Boolean(subscription.autoRenew),
    });

    if (!sentMail) {
      continue;
    }

    const whenLabel = endDate.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const periodLabel = subscription.isTrial
      ? "Premium trial"
      : "Premium subscription";

    await notifyAgent({
      userId: subscription.userId,
      title: "Subscription ending soon",
      message: `Your ${periodLabel} ends on ${whenLabel}. Pay $${PLAN_PRICES.PREMIUM} again to keep your agent account. After 7 days without payment, your account becomes a regular user.`,
      metadata: {
        subscriptionId: subscription.id,
        endDate: endDate.toISOString(),
        isTrial: Boolean(subscription.isTrial),
      },
    });

    sent += 1;
  }

  if (sent) {
    console.log(`Subscription expiry reminders sent: ${sent}`);
  }

  return sent;
};

export const startSubscriptionExpiryReminderJob = () => {
  if (started) return;
  started = true;

  const run = () => {
    processDueSubscriptionExpiries().catch((error) => {
      console.error("Subscription expiry processing failed", error);
    });
    processSubscriptionExpiryReminders().catch((error) => {
      console.error("Subscription expiry reminder job failed", error);
    });
  };

  setTimeout(run, 25_000);
  setInterval(run, INTERVAL_MS);
  console.log(
    "Subscription expiry job started (hourly: 3-day reminder, then AGENT→USER after 7-day grace)"
  );
};
