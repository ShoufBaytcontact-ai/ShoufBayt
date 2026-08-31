import prisma from "../lib/prisma.js";
import {
  PLAN_DURATION_DAYS,
  PLAN_PRICES,
  GRACE_DAYS,
  TRIAL_DAYS,
  DATA_RETENTION_MONTHS,
  FREE_SELF_LISTINGS,
  cleanText,
  expireIfNeeded,
  getCurrentSubscription,
  getGraceEnd,
  getPeriodEnd,
  getPremiumFreeUntil,
  getSelfListingQuota,
  getSubscriptionPhase,
  hasActiveSubscriptionAccess,
  hasGraceAccess,
  hasPremiumAccess,
  isLaunchPremiumFree,
  isValidObjectId,
} from "../lib/subscription.js";
import { sendSubscriptionCancelledEmail, sendSubscriptionResumedEmail } from "../lib/subscriptionEmail.js";
import { PREMIUM_PAYEE } from "../lib/paymentInstructions.js";

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (error?.status) {
    return res.status(error.status).json({
      message: error.message,
      code: error.code || null,
    });
  }

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

/* =========================================================
   GET MY SUBSCRIPTION
========================================================= */

export const getMySubscription = async (req, res) => {
  const userId = req.userId;

  try {
    let subscription = await getCurrentSubscription(userId);
    subscription = await expireIfNeeded(subscription);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        premiumTrialClaimed: true,
        agentProfile: {
          select: { id: true },
        },
      },
    });

    const phase = getSubscriptionPhase(subscription);
    const periodEnd = getPeriodEnd(subscription);
    const graceEnd = getGraceEnd(subscription);
    const hasAgentProfile = Boolean(user?.agentProfile);
    const cancelsAtPeriodEnd = subscription?.status === "CANCELLED";
    const launchPremiumFree = isLaunchPremiumFree();
    const launchFreeUntil = getPremiumFreeUntil();
    const listingQuota =
      user?.role === "USER"
        ? await getSelfListingQuota(userId)
        : null;

    return res.status(200).json({
      subscription,
      hasAccess: hasPremiumAccess(subscription),
      hasPaidAccess: hasActiveSubscriptionAccess(subscription),
      inGrace: hasGraceAccess(subscription),
      cancelsAtPeriodEnd,
      phase,
      role: user?.role || null,
      hasAgentProfile,
      canReactivateAgent:
        user?.role === "USER" && hasAgentProfile,
      premiumTrialClaimed: Boolean(user?.premiumTrialClaimed),
      isTrial: Boolean(subscription?.isTrial && phase === "trial"),
      periodEndsAt: periodEnd,
      graceEndsAt: graceEnd,
      listingQuota,
      launchPremiumFree,
      launchFreeUntil,
      launchDaysLeft: launchPremiumFree
        ? Math.max(
            0,
            Math.ceil((launchFreeUntil.getTime() - Date.now()) / 86_400_000)
          )
        : 0,
      policy: {
        trialDays: TRIAL_DAYS,
        graceDays: GRACE_DAYS,
        retentionMonths: DATA_RETENTION_MONTHS,
        priceMonthly: PLAN_PRICES.PREMIUM,
        freeSelfListings: FREE_SELF_LISTINGS,
        payee: PREMIUM_PAYEE,
        launchPremiumFree,
        launchFreeUntil,
      },
      plans: {
        PREMIUM: {
          price: PLAN_PRICES.PREMIUM,
          durationDays: PLAN_DURATION_DAYS.PREMIUM,
          label: "Premium",
          description: launchPremiumFree
            ? `Launch month: Premium is free until ${launchFreeUntil.toDateString()}. After that, users get ${FREE_SELF_LISTINGS} free self-listing, then $${PLAN_PRICES.PREMIUM}/month. Agents get a ${TRIAL_DAYS}-day trial after verification, then $${PLAN_PRICES.PREMIUM}/month.`
            : `Users: ${FREE_SELF_LISTINGS} free self-listing, then $${PLAN_PRICES.PREMIUM}/month. Agents: ${TRIAL_DAYS}-day trial after verification, then $${PLAN_PRICES.PREMIUM}/month. Asking an agent to list stays free.`,
        },
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to get subscription");
  }
};

/* =========================================================
   GET MY SUBSCRIPTION HISTORY
========================================================= */

export const getMySubscriptionHistory = async (req, res) => {
  const userId = req.userId;

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
      },
      include: {
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(subscriptions);
  } catch (error) {
    return handleError(res, error, "Failed to get subscription history");
  }
};

/* =========================================================
   CANCEL AUTO-RENEW
========================================================= */

export const cancelAutoRenew = async (req, res) => {
  const userId = req.userId;

  try {
    const subscription = await getCurrentSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        message: "No current subscription found",
      });
    }

    const updated = await prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        autoRenew: false,
      },
    });

    return res.status(200).json({
      message: "Auto-renew cancelled",
      subscription: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to cancel auto-renew");
  }
};

/* =========================================================
   CANCEL SUBSCRIPTION (keeps access until period end)
========================================================= */

export const cancelMySubscription = async (req, res) => {
  const userId = req.userId;

  try {
    let subscription = await getCurrentSubscription(userId);
    subscription = await expireIfNeeded(subscription);

    if (!subscription) {
      return res.status(404).json({
        message: "No current subscription found",
      });
    }

    const phase = getSubscriptionPhase(subscription);
    const alreadyCancelled = subscription.status === "CANCELLED";
    const canCancel =
      alreadyCancelled || ["trial", "premium"].includes(phase);

    if (!canCancel) {
      return res.status(400).json({
        message: "There is no active plan to cancel",
      });
    }

    if (alreadyCancelled) {
      return res.status(200).json({
        message: "Subscription is already set to cancel at the end of this period",
        subscription,
      });
    }

    const updated = await prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        autoRenew: false,
        status: "CANCELLED",
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });

    const accessUntil = getPeriodEnd(updated) || getGraceEnd(updated);

    await prisma.notification.create({
      data: {
        userId,
        type: "SUBSCRIPTION_EXPIRED",
        title: "Subscription cancelled",
        message: accessUntil
          ? `Your plan will not renew. You keep access until ${accessUntil.toDateString()}.`
          : "Your plan will not renew. You keep access until this period ends.",
        link: "/billing",
        metadata: {
          subscriptionId: updated.id,
          cancelled: true,
          endDate: accessUntil,
        },
      },
    });

    try {
      await sendSubscriptionCancelledEmail({
        to: user?.email,
        username: user?.username,
        endDate: accessUntil,
        isTrial: Boolean(updated.isTrial),
      });
    } catch (emailError) {
      console.error("Failed to send subscription cancelled email", emailError);
    }

    return res.status(200).json({
      message: "Subscription will end at the close of this period",
      subscription: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to cancel subscription");
  }
};

/* =========================================================
   RESUME SUBSCRIPTION AFTER CANCEL (same period, no new payment)
========================================================= */

export const resumeMySubscription = async (req, res) => {
  const userId = req.userId;

  try {
    let subscription = await getCurrentSubscription(userId);
    subscription = await expireIfNeeded(subscription);

    if (!subscription || subscription.status !== "CANCELLED") {
      return res.status(400).json({
        message: "There is no cancelled plan to resume",
      });
    }

    if (!hasActiveSubscriptionAccess(subscription)) {
      return res.status(400).json({
        message:
          `This period has ended. Send $${PLAN_PRICES.PREMIUM} and upload the receipt on Billing to renew.`,
      });
    }

    const updated = await prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        status: "ACTIVE",
        autoRenew: false,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });

    const accessUntil = getPeriodEnd(updated);

    await prisma.notification.create({
      data: {
        userId,
        type: "PAYMENT_CONFIRMED",
        title: "Subscription resumed",
        message: accessUntil
          ? `Your plan is active again until ${accessUntil.toDateString()}.`
          : "Your Premium plan is active again.",
        link: "/billing",
        metadata: {
          subscriptionId: updated.id,
          resumed: true,
        },
      },
    });

    try {
      await sendSubscriptionResumedEmail({
        to: user?.email,
        username: user?.username,
        endDate: accessUntil,
      });
    } catch (emailError) {
      console.error("Failed to send subscription resumed email", emailError);
    }

    return res.status(200).json({
      message: "Subscription resumed",
      subscription: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to resume subscription");
  }
};

/* =========================================================
   ADMIN: LIST SUBSCRIPTIONS
========================================================= */

export const getAdminSubscriptions = async (req, res) => {
  try {
    const status = cleanText(req.query.status).toUpperCase();

    const where = {};

    if (["ACTIVE", "GRACE", "INACTIVE", "EXPIRED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    if (req.query.isCurrent === "true") {
      where.isCurrent = true;
    }

    if (req.query.isCurrent === "false") {
      where.isCurrent = false;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(subscriptions);
  } catch (error) {
    return handleError(res, error, "Failed to get subscriptions");
  }
};

/* =========================================================
   ADMIN: EXPIRE SUBSCRIPTION MANUALLY
========================================================= */

export const expireSubscription = async (req, res) => {
  const id = cleanText(req.params.id);

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid subscription ID",
      });
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        id,
      },
    });

    if (!subscription) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    const updated = await prisma.subscription.update({
      where: {
        id,
      },
      data: {
        status: "EXPIRED",
        autoRenew: false,
      },
    });

    await prisma.notification.create({
      data: {
        userId: subscription.userId,
        type: "SUBSCRIPTION_EXPIRED",
        title: "Subscription expired",
        message: "Your ShoufBayt subscription has expired.",
        link: "/agent/subscription",
        metadata: {
          subscriptionId: id,
        },
      },
    });

    return res.status(200).json({
      message: "Subscription expired",
      subscription: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to expire subscription");
  }
};

/* =========================================================
   ADMIN: LAUNCH PERIOD EMAILS
========================================================= */

export const getLaunchPeriodStatus = async (req, res) => {
  try {
    const {
      getLaunchPeriodStatus: loadStatus,
    } = await import("../lib/launchPeriodEmail.js");
    const status = await loadStatus();
    return res.status(200).json(status);
  } catch (error) {
    return handleError(res, error, "Failed to get launch period status");
  }
};

export const sendLaunchPeriodTest = async (req, res) => {
  try {
    const email = cleanText(req.body?.email).toLowerCase();
    const role = cleanText(req.body?.role).toUpperCase() || "USER";
    const username = cleanText(req.body?.username) || "there";

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        message: "Enter a valid email address to send a test.",
      });
    }

    const { sendLaunchPeriodEndedEmail } = await import(
      "../lib/launchPeriodEmail.js"
    );
    const mailed = await sendLaunchPeriodEndedEmail({
      to: email,
      username,
      role,
      test: true,
    });

    if (!mailed) {
      return res.status(500).json({
        message: "Could not send the test email. Check the API email settings.",
      });
    }

    return res.status(200).json({
      message: `Test ${role} email sent to ${email}`,
      email,
      role,
    });
  } catch (error) {
    return handleError(res, error, "Failed to send launch period test email");
  }
};

export const sendLaunchPeriodEmails = async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const confirm = cleanText(req.body?.confirm);

    if (confirm !== "SEND_LAUNCH_EMAILS") {
      return res.status(400).json({
        message: 'Pass confirm: "SEND_LAUNCH_EMAILS" to send this campaign.',
      });
    }

    const { processLaunchPeriodEmails } = await import(
      "../lib/launchPeriodEmail.js"
    );
    const result = await processLaunchPeriodEmails({ force, limit: 200 });
    return res.status(200).json({
      message: result.skipped
        ? "Complimentary month is still active. Send a test email, or pass force: true to send now."
        : `Sent ${result.sent} email(s).`,
      result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to send launch period emails");
  }
};
