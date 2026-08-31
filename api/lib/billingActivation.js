import prisma from "./prisma.js";
import {
  PLAN_DURATION_DAYS,
  PLAN_PRICES,
  GRACE_DAYS,
  restoreAgentListings,
  restoreAgentRoleIfEligible,
} from "./subscription.js";
import { sendAgentRestoredEmail, sendPremiumActivatedEmail, sendAutoRenewFailedEmail } from "./subscriptionEmail.js";
import { dollarsToCents, getStripe, isStripeConfigured } from "./stripe.js";

export const activatePaidSubscription = async ({
  userId,
  plan = "PREMIUM",
  paymentId,
  reviewedBy = null,
  autoRenew = false,
}) => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (PLAN_DURATION_DAYS[plan] || 30));
  const graceEndsAt = new Date(endDate);
  graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);

  await prisma.subscription.updateMany({
    where: {
      userId,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      plan,
      status: "ACTIVE",
      isTrial: false,
      trialStart: null,
      trialEnd: null,
      startDate: now,
      endDate,
      graceEndsAt,
      inactiveAt: null,
      isCurrent: true,
      autoRenew: Boolean(autoRenew),
    },
  });

  const { user: restoredUser, restored } = await restoreAgentRoleIfEligible(
    userId
  );
  await restoreAgentListings(userId);

  await prisma.payment.update({
    where: {
      id: paymentId,
    },
    data: {
      subscriptionId: subscription.id,
      status: "SUCCESS",
      reviewedBy,
      reviewedAt: now,
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "PAYMENT_CONFIRMED",
      title: restored ? "Agent account restored" : "Payment confirmed",
      message: restored
        ? `Your agent account and listings are back. Premium is active until ${endDate.toDateString()}.`
        : `Your Premium subscription is active until ${endDate.toDateString()}. You can list homes yourself without the free-listing limit.`,
      link: "/billing",
      metadata: {
        paymentId,
        subscriptionId: subscription.id,
        plan,
        agentRestored: restored,
      },
    },
  });

  if (restored && restoredUser?.email) {
    await sendAgentRestoredEmail({
      to: restoredUser.email,
      username: restoredUser.username,
      endDate,
    });
  } else if (restoredUser?.email) {
    await sendPremiumActivatedEmail({
      to: restoredUser.email,
      username: restoredUser.username,
      endDate,
      pendingReview:
        restoredUser.role !== "AGENT" && restoredUser.role !== "ADMIN",
    });
  }

  return subscription;
};

/**
 * Finalize a succeeded Stripe PaymentIntent into Premium access.
 * Safe to call more than once (idempotent on payment status).
 */
export const finalizeStripePaymentIntent = async (paymentIntent) => {
  if (!paymentIntent || paymentIntent.status !== "succeeded") {
    return null;
  }

  const paymentId =
    paymentIntent.metadata?.paymentId ||
    paymentIntent.metadata?.shoufbaytPaymentId ||
    paymentIntent.metadata?.smartestatePaymentId;

  if (!paymentId) {
    return null;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return null;
  }

  if (payment.status === "SUCCESS") {
    return { payment, alreadyActive: true };
  }

  const userId = payment.userId;
  const plan = paymentIntent.metadata?.plan || "PREMIUM";
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id || null;
  const paymentMethodId =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id || null;

  if (customerId || paymentMethodId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        ...(paymentMethodId
          ? { stripePaymentMethodId: paymentMethodId }
          : {}),
      },
    });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      transactionId: paymentIntent.id,
      adminNotes: "Paid automatically via card (Stripe)",
    },
  });

  const subscription = await activatePaidSubscription({
    userId,
    plan,
    paymentId,
    reviewedBy: null,
    autoRenew: true,
  });

  return { payment, subscription, alreadyActive: false };
};

export const chargeSavedCardForRenewal = async (userId) => {
  if (!isStripeConfigured()) {
    return { ok: false, reason: "stripe_not_configured" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      stripeCustomerId: true,
      stripePaymentMethodId: true,
    },
  });

  if (!user?.stripeCustomerId || !user?.stripePaymentMethodId) {
    return { ok: false, reason: "no_saved_card" };
  }

  const pendingPayment = await prisma.payment.findFirst({
    where: {
      userId,
      status: "PENDING",
      method: "CARD",
    },
  });

  if (pendingPayment) {
    return { ok: false, reason: "pending_payment" };
  }

  const plan = "PREMIUM";
  const amount = PLAN_PRICES[plan];
  const stripe = getStripe();

  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      currency: "USD",
      method: "CARD",
      status: "PENDING",
      adminNotes: "Auto-renew charge",
    },
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: dollarsToCents(amount),
      currency: "usd",
      customer: user.stripeCustomerId,
      payment_method: user.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        userId,
        paymentId: payment.id,
        plan,
        kind: "auto_renew",
      },
      description: "ShoufBayt Premium auto-renewal",
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { transactionId: paymentIntent.id },
    });

    if (paymentIntent.status === "succeeded") {
      const result = await finalizeStripePaymentIntent(paymentIntent);
      return { ok: true, paymentIntent, result };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        adminNotes: `Auto-renew incomplete: ${paymentIntent.status}`,
      },
    });

    return { ok: false, reason: paymentIntent.status };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        adminNotes: error.message || "Auto-renew charge failed",
      },
    });

    await prisma.subscription.updateMany({
      where: {
        userId,
        isCurrent: true,
      },
      data: {
        autoRenew: false,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: "PAYMENT_FAILED",
        title: "Auto-renew failed",
        message:
          "We could not charge your saved card. Auto-renew was turned off — update your card on Billing.",
        link: "/billing",
        metadata: { paymentId: payment.id },
      },
    });

    await sendAutoRenewFailedEmail({
      to: user.email,
      username: user.username,
    });

    return { ok: false, reason: error.message || "charge_failed" };
  }
};
