import prisma from "../lib/prisma.js";

/** One Premium plan. No subscription = none. */
export const PLAN_PRICES = {
  PREMIUM: 20,
};

export const PLAN_DURATION_DAYS = {
  PREMIUM: 30,
};

/** Self-listed homes a regular user can submit before Premium is required. */
export const FREE_SELF_LISTINGS = 1;

/** 30-day Premium trial — only after admin verification */
export const TRIAL_DAYS = 30;

/** After trial/paid endDate, listings stay online this long */
export const GRACE_DAYS = 7;

/** Soft retention window after inactive (months) — for ops / future cleanup */
export const DATA_RETENTION_MONTHS = 6;

export const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

export const cleanText = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getPeriodEnd = (subscription) => {
  if (!subscription) return null;
  return subscription.endDate || subscription.trialEnd || null;
};

/**
 * First month after launch: Premium is free for everyone.
 * Set PREMIUM_FREE_UNTIL (ISO date) or SITE_LAUNCH_AT (+ 30 days).
 */
export const getPremiumFreeUntil = () => {
  const untilRaw = String(process.env.PREMIUM_FREE_UNTIL || "").trim();
  if (untilRaw) {
    const until = new Date(untilRaw);
    if (!Number.isNaN(until.getTime())) {
      return until;
    }
  }

  const launchRaw = String(process.env.SITE_LAUNCH_AT || "").trim();
  if (launchRaw) {
    const launch = new Date(launchRaw);
    if (!Number.isNaN(launch.getTime())) {
      return addDays(launch, PLAN_DURATION_DAYS.PREMIUM);
    }
  }

  return new Date("2026-09-05T23:59:59.000+03:00");
};

export const isLaunchPremiumFree = () => new Date() < getPremiumFreeUntil();

export const getGraceEnd = (subscription) => {
  if (!subscription) return null;
  if (subscription.graceEndsAt) return subscription.graceEndsAt;
  const end = getPeriodEnd(subscription);
  return end ? addDays(end, GRACE_DAYS) : null;
};

export const getCurrentSubscription = async (userId, db = prisma) => {
  return db.subscription.findFirst({
    where: {
      userId,
      isCurrent: true,
    },
    include: {
      payments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

const pauseAgentListings = async (userId, db = prisma) => {
  await db.property.updateMany({
    where: {
      userId,
      status: "PUBLISHED",
      pausedBySubscription: false,
    },
    data: {
      status: "ARCHIVED",
      pausedBySubscription: true,
    },
  });
};

/** Hide live listings when someone is no longer an agent. */
export const archiveListingsForFormerAgent = async (userId, db = prisma) => {
  if (!isValidObjectId(userId)) {
    return;
  }

  await db.property.updateMany({
    where: {
      userId,
      status: "PUBLISHED",
    },
    data: {
      status: "ARCHIVED",
      pausedBySubscription: true,
    },
  });
};

export const restoreAgentListings = async (userId, db = prisma) => {
  if (!isValidObjectId(userId)) {
    return;
  }

  await db.property.updateMany({
    where: {
      userId,
      status: "ARCHIVED",
    },
    data: {
      status: "PUBLISHED",
      pausedBySubscription: false,
      publishedAt: new Date(),
    },
  });

  await db.property.updateMany({
    where: {
      userId,
      status: "PENDING",
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      rejectionReason: null,
    },
  });
};

let restoredUnflaggedAgentArchives = false;

export const restoreListingsForActiveAgents = async (db = prisma) => {
  const agents = await db.user.findMany({
    where: {
      role: {
        in: ["AGENT", "ADMIN"],
      },
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  const agentIds = agents.map((agent) => agent.id);
  if (!agentIds.length) {
    return;
  }

  await db.property.updateMany({
    where: {
      userId: {
        in: agentIds,
      },
      status: "ARCHIVED",
      ...(restoredUnflaggedAgentArchives
        ? {
            pausedBySubscription: true,
          }
        : {}),
    },
    data: {
      status: "PUBLISHED",
      pausedBySubscription: false,
      publishedAt: new Date(),
    },
  });

  await db.property.updateMany({
    where: {
      userId: {
        in: agentIds,
      },
      status: "PENDING",
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      rejectionReason: null,
    },
  });

  restoredUnflaggedAgentArchives = true;
};

const notifyUser = async ({ userId, type, title, message, metadata }) => {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: "/billing",
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create subscription notification", error);
  }
};

/** After grace, keep the agent profile but drop AGENT privileges until they pay again. */
export const downgradeExpiredAgentToUser = async (userId, db = prisma) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      username: true,
    },
  });

  if (!user || user.role !== "AGENT") {
    return user;
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { role: "USER" },
    select: {
      id: true,
      role: true,
      email: true,
      username: true,
    },
  });

  await notifyUser({
    userId,
    type: "SUBSCRIPTION_EXPIRED",
    title: "Agent access paused",
    message:
      `Your 7-day grace period ended. Your account is now a regular user. Pay $${PLAN_PRICES.PREMIUM} on Billing to restore your agent account and listings.`,
    metadata: { reason: "grace_ended" },
  });

  try {
    const { sendAgentDowngradedEmail } = await import("./subscriptionEmail.js");
    await sendAgentDowngradedEmail({
      to: updated.email,
      username: updated.username,
    });
  } catch (error) {
    console.error("Failed to send agent downgrade email", error);
  }

  return updated;
};

/** Restore AGENT if this account was previously verified (agent profile still exists). */
export const restoreAgentRoleIfEligible = async (userId, db = prisma) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      username: true,
      agentProfile: {
        select: { id: true },
      },
    },
  });

  if (!user || user.role === "ADMIN") {
    return { user, restored: false };
  }

  if (user.role === "AGENT") {
    await restoreAgentListings(userId, db);
    return { user, restored: false };
  }

  if (!user.agentProfile) {
    return { user, restored: false };
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { role: "AGENT" },
    select: {
      id: true,
      role: true,
      email: true,
      username: true,
    },
  });

  await restoreAgentListings(userId, db);

  return { user: updated, restored: true };
};

/**
 * Advance ACTIVE → GRACE → INACTIVE based on dates.
 * GRACE: profile + listings stay; no new Premium actions.
 * INACTIVE: pause listings, change AGENT → USER; data kept for restore on repay.
 */
export const expireIfNeeded = async (subscription, db = prisma) => {
  if (!subscription) {
    return null;
  }

  const now = new Date();
  const periodEnd = getPeriodEnd(subscription);
  if (!periodEnd) {
    return subscription;
  }

  const graceEnd = getGraceEnd(subscription) || addDays(periodEnd, GRACE_DAYS);

  if (
    (subscription.status === "ACTIVE" ||
      subscription.status === "GRACE" ||
      subscription.status === "CANCELLED") &&
    now > graceEnd
  ) {
    const updated = await db.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "INACTIVE",
        plan: "PREMIUM",
        graceEndsAt: graceEnd,
        inactiveAt: now,
        autoRenew: false,
      },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    await pauseAgentListings(subscription.userId, db);
    await downgradeExpiredAgentToUser(subscription.userId, db);
    return updated;
  }

  if (
    (subscription.status === "ACTIVE" || subscription.status === "CANCELLED") &&
    now > periodEnd
  ) {
    const updated = await db.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "GRACE",
        plan: "PREMIUM",
        graceEndsAt: graceEnd,
      },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    await notifyUser({
      userId: subscription.userId,
      type: "SUBSCRIPTION_EXPIRED",
      title: "Premium ended — 7 days to renew",
      message: `Your Premium period ended. Existing listings stay online until ${graceEnd.toDateString()}. Pay $${PLAN_PRICES.PREMIUM} to keep your agent account.`,
      metadata: {
        subscriptionId: subscription.id,
        graceEndsAt: graceEnd.toISOString(),
      },
    });

    try {
      const contact = await db.user.findUnique({
        where: { id: subscription.userId },
        select: { email: true, username: true },
      });
      const { sendGraceStartedEmail } = await import("./subscriptionEmail.js");
      await sendGraceStartedEmail({
        to: contact?.email,
        username: contact?.username,
        graceEndsAt: graceEnd,
      });
    } catch (error) {
      console.error("Failed to send grace period email", error);
    }

    return updated;
  }

  return subscription;
};

/** Hourly job: expire due subscriptions even if the agent never opens the app. */
export const processDueSubscriptionExpiries = async (db = prisma) => {
  const now = new Date();
  const due = await db.subscription.findMany({
    where: {
      isCurrent: true,
      status: { in: ["ACTIVE", "GRACE", "CANCELLED"] },
      OR: [
        { endDate: { lte: now } },
        {
          AND: [{ endDate: null }, { trialEnd: { lte: now } }],
        },
        { graceEndsAt: { lte: now } },
      ],
    },
    take: 50,
  });

  let processed = 0;
  for (const subscription of due) {
    await expireIfNeeded(subscription, db);
    processed += 1;
  }

  if (processed) {
    console.log(`Subscription expiries processed: ${processed}`);
  }

  return processed;
};

/** Full Premium: create listings, accept requests, featured tools */
export const hasActiveSubscriptionAccess = (subscription) => {
  if (!subscription || !subscription.isCurrent) {
    return false;
  }

  if (subscription.plan !== "PREMIUM") {
    return false;
  }

  if (subscription.status !== "ACTIVE" && subscription.status !== "CANCELLED") {
    return false;
  }

  const endDate = getPeriodEnd(subscription);
  if (endDate && endDate < new Date()) {
    return false;
  }

  return true;
};

/** Paid/trial Premium, or the complimentary launch month. */
export const hasPremiumAccess = (subscription) => {
  if (isLaunchPremiumFree()) {
    return true;
  }

  return hasActiveSubscriptionAccess(subscription);
};

export const countSelfListings = async (userId, db = prisma) => {
  return db.property.count({
    where: {
      userId,
      OR: [
        { requestedByUserId: null },
        { requestedByUserId: { isSet: false } },
      ],
    },
  });
};

export const getSelfListingQuota = async (userId, db = prisma) => {
  const used = await countSelfListings(userId, db);
  const launchFree = isLaunchPremiumFree();
  let subscription = await getCurrentSubscription(userId, db);
  subscription = await expireIfNeeded(subscription, db);
  const paidPremium = hasActiveSubscriptionAccess(subscription);
  const unlimited = launchFree || paidPremium;
  const remaining = unlimited
    ? null
    : Math.max(0, FREE_SELF_LISTINGS - used);

  return {
    freeLimit: FREE_SELF_LISTINGS,
    used,
    remaining,
    unlimited,
    allowed: unlimited || used < FREE_SELF_LISTINGS,
    launchPremiumFree: launchFree,
    launchFreeUntil: getPremiumFreeUntil(),
    hasPremium: paidPremium,
    priceMonthly: PLAN_PRICES.PREMIUM,
  };
};

/** Grace: keep existing listings online; block new Premium actions */
export const hasGraceAccess = (subscription) => {
  if (!subscription || !subscription.isCurrent) {
    return false;
  }

  if (subscription.status !== "GRACE") {
    return false;
  }

  const graceEnd = getGraceEnd(subscription);
  if (graceEnd && graceEnd < new Date()) {
    return false;
  }

  return true;
};

export const getSubscriptionPhase = (subscription) => {
  if (hasActiveSubscriptionAccess(subscription)) {
    return subscription.isTrial ? "trial" : "premium";
  }

  if (isLaunchPremiumFree()) {
    return "launch";
  }

  if (!subscription || !subscription.isCurrent) {
    return "none";
  }

  if (hasGraceAccess(subscription)) {
    return "grace";
  }

  if (subscription.status === "INACTIVE") {
    return "inactive";
  }

  return "expired";
};

/**
 * Grant 30-day Premium trial only after agent verification/approval.
 * One trial per account — blocks fake re-signup farming when tied to verified user.
 */
export const grantPremiumTrialAfterVerification = async (
  userId,
  db = prisma
) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      premiumTrialClaimed: true,
    },
  });

  if (!user) {
    return null;
  }

  let current = await getCurrentSubscription(userId, db);
  current = await expireIfNeeded(current, db);

  if (hasActiveSubscriptionAccess(current)) {
    return current;
  }

  if (user.premiumTrialClaimed) {
    return null;
  }

  await db.subscription.updateMany({
    where: {
      userId,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  const startDate = new Date();
  const endDate = addDays(startDate, TRIAL_DAYS);

  const subscription = await db.subscription.create({
    data: {
      userId,
      plan: "PREMIUM",
      status: "ACTIVE",
      isTrial: true,
      trialStart: startDate,
      trialEnd: endDate,
      startDate,
      endDate,
      graceEndsAt: addDays(endDate, GRACE_DAYS),
      isCurrent: true,
      autoRenew: false,
    },
  });

  await db.user.update({
    where: { id: userId },
    data: { premiumTrialClaimed: true },
  });

  return subscription;
};

/** @deprecated alias — use grantPremiumTrialAfterVerification */
export const grantFirstFreeMonthIfEligible = grantPremiumTrialAfterVerification;

export const assertAgentSubscriptionAccess = async (userId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (user.role === "ADMIN") {
    return { user, subscription: null, allowed: true };
  }

  if (user.role !== "AGENT" || user.status !== "ACTIVE") {
    const error = new Error("Only active agents can perform this action");
    error.status = 403;
    throw error;
  }

  if (isLaunchPremiumFree()) {
    return { user, subscription: null, allowed: true };
  }

  let subscription = await getCurrentSubscription(userId);
  subscription = await expireIfNeeded(subscription);

  if (hasGraceAccess(subscription)) {
    const error = new Error(
      `Your Premium period ended. You have 7 days to pay $${PLAN_PRICES.PREMIUM} again — existing listings stay online, then your account becomes a regular user.`
    );
    error.status = 403;
    error.code = "SUBSCRIPTION_GRACE";
    throw error;
  }

  if (!hasActiveSubscriptionAccess(subscription)) {
    const error = new Error(
      `Premium required. Verified agents get a ${TRIAL_DAYS}-day free trial, then $${PLAN_PRICES.PREMIUM}/month. Open Billing to subscribe.`
    );
    error.status = 403;
    error.code = "SUBSCRIPTION_REQUIRED";
    throw error;
  }

  return { user, subscription, allowed: true };
};

/**
 * Every AGENT needs an AgentProfile row. Role changes and older accounts
 * can miss it, which blocks the Agent Hub with "Agent profile required".
 */
export const ensureAgentProfile = async (userId, db = prisma) => {
  if (!userId) {
    return null;
  }

  const existing = await db.agentProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    if (existing.isVerified) {
      return existing;
    }

    return db.agentProfile.update({
      where: { id: existing.id },
      data: { isVerified: true },
    });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatar: true,
      role: true,
    },
  });

  if (!user || String(user.role).toUpperCase() !== "AGENT") {
    return null;
  }

  const application = await db.agentApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const name =
    application?.fullName || user.username || "ShoufBayt Agent";
  const location = application?.location || "";

  return db.agentProfile.upsert({
    where: { userId },
    update: {
      isVerified: true,
    },
    create: {
      userId,
      name,
      agencyName: application?.agencyName || null,
      title: application?.agencyName || "Real Estate Agent",
      phone: application?.phone || "",
      location,
      bio: application?.bio || "ShoufBayt agent",
      image: application?.image || user.avatar || null,
      isVerified: true,
      serviceAreas: location ? [location] : [],
    },
  });
};

