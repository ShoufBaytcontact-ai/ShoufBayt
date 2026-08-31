import prisma from "../lib/prisma.js";
import {
  PLAN_PRICES,
  cleanText,
  getCurrentSubscription,
  isValidObjectId,
} from "../lib/subscription.js";
import {
  activatePaidSubscription,
  finalizeStripePaymentIntent,
} from "../lib/billingActivation.js";
import { sendUniqueConflict, assertTransactionAvailable } from "../lib/uniqueFields.js";
import {
  dollarsToCents,
  getStripe,
  getStripePublishableKey,
  isStripeConfigured,
} from "../lib/stripe.js";
import {
  sendPaymentRejectedEmail,
  sendPaymentSubmittedEmail,
} from "../lib/subscriptionEmail.js";

const PAYMENT_METHODS = [
  "CARD",
  "OMT",
  "BOB",
  "WHISH",
];

const PAYMENT_STATUSES = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
];

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (sendUniqueConflict(res, error)) {
    return;
  }

  if (error?.status) {
    return res.status(error.status).json({
      message: error.message,
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

const getProofUrl = (req, file) => {
  if (!file) {
    return null;
  }

  if (file.secure_url) {
    return file.secure_url;
  }

  if (file.url) {
    return file.url;
  }

  if (file.path && /^https?:\/\//i.test(file.path)) {
    return file.path;
  }

  if (file.filename) {
    return file.secure_url || file.url || null;
  }

  return null;
};

const assertBillableUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      stripeCustomerId: true,
      stripePaymentMethodId: true,
      agentProfile: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (user.status !== "ACTIVE") {
    const error = new Error("Your account must be active before paying");
    error.status = 403;
    throw error;
  }

  return user;
};

export const getCardConfig = async (req, res) => {
  try {
    return res.status(200).json({
      configured: isStripeConfigured(),
      publishableKey: isStripeConfigured() ? getStripePublishableKey() : null,
      currency: "usd",
      amount: PLAN_PRICES.PREMIUM,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load card payment config");
  }
};

export const createCardPaymentIntent = async (req, res) => {
  const userId = req.userId;
  const plan = cleanText(req.body.plan || "PREMIUM").toUpperCase() || "PREMIUM";

  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        message:
          "Card payments are not configured yet. Add Stripe keys to the API .env.",
      });
    }

    const user = await assertBillableUser(userId);

    if (plan !== "PREMIUM") {
      return res.status(400).json({
        message: "Plan must be PREMIUM",
      });
    }

    await prisma.payment.updateMany({
      where: {
        userId,
        status: "PENDING",
        method: "CARD",
      },
      data: {
        status: "FAILED",
        adminNotes: "Replaced by a new card checkout attempt",
      },
    });

    const manualPending = await prisma.payment.findFirst({
      where: {
        userId,
        status: "PENDING",
        method: { not: "CARD" },
      },
      select: { id: true },
    });

    if (manualPending) {
      return res.status(400).json({
        message: "You already have a pending payment under review",
      });
    }

    const amount = PLAN_PRICES[plan];
    const stripe = getStripe();

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        currency: "USD",
        method: "CARD",
        status: "PENDING",
        adminNotes: "Awaiting card confirmation",
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: dollarsToCents(amount),
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      metadata: {
        userId,
        paymentId: payment.id,
        plan,
        kind: "premium_subscribe",
      },
      description: "ShoufBayt Premium subscription",
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { transactionId: paymentIntent.id },
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment.id,
      amount,
      currency: "usd",
      publishableKey: getStripePublishableKey(),
    });
  } catch (error) {
    return handleError(res, error, "Failed to start card payment");
  }
};

export const completeCardPayment = async (req, res) => {
  const userId = req.userId;
  const paymentIntentId = cleanText(req.body.paymentIntentId);

  try {
    if (!paymentIntentId) {
      return res.status(400).json({
        message: "paymentIntentId is required",
      });
    }

    await assertBillableUser(userId);

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["payment_method"] }
    );

    if (paymentIntent.metadata?.userId !== userId) {
      return res.status(403).json({
        message: "This payment does not belong to your account",
      });
    }

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        message: `Payment not completed yet (status: ${paymentIntent.status})`,
      });
    }

    const result = await finalizeStripePaymentIntent(paymentIntent);

    if (!result) {
      return res.status(404).json({
        message: "Payment record not found for this charge",
      });
    }

    return res.status(200).json({
      message: result.alreadyActive
        ? "Premium already active"
        : "Payment successful. Premium is now active with auto-renew on.",
      subscription: result.subscription || null,
      alreadyActive: result.alreadyActive,
    });
  } catch (error) {
    return handleError(res, error, "Failed to complete card payment");
  }
};

export const stripeWebhook = async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).send("Stripe not configured");
    }

    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else if (process.env.NODE_ENV !== "production") {
      event =
        typeof req.body === "string" || Buffer.isBuffer(req.body)
          ? JSON.parse(req.body.toString("utf8"))
          : req.body;
    } else {
      return res.status(400).send("Webhook secret missing");
    }

    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const paymentIntent = event.data.object;

      if (event.type === "payment_intent.succeeded") {
        await finalizeStripePaymentIntent(paymentIntent);
      } else if (paymentIntent.metadata?.paymentId) {
        await prisma.payment.updateMany({
          where: {
            id: paymentIntent.metadata.paymentId,
            status: "PENDING",
          },
          data: {
            status: "FAILED",
            adminNotes: "Card payment failed",
          },
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("STRIPE WEBHOOK ERROR", error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

export const submitPayment = async (req, res) => {
  const userId = req.userId;

  const plan = cleanText(req.body.plan).toUpperCase();
  const method = cleanText(req.body.method).toUpperCase();
  const transactionId = cleanText(req.body.transactionId) || null;

  try {
    const user = await assertBillableUser(userId);

    if (plan !== "PREMIUM") {
      return res.status(400).json({
        message: "Plan must be PREMIUM",
      });
    }

    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    if (method === "CARD") {
      return res.status(400).json({
        message: "Use the card checkout form for automatic card payments.",
      });
    }

    const pendingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
      select: {
        id: true,
      },
    });

    if (pendingPayment) {
      return res.status(400).json({
        message: "You already have a pending payment under review",
      });
    }

    const proofUrl =
      getProofUrl(req, req.file) || cleanText(req.body.proofUrl) || null;

    if (
      ["OMT", "BOB", "WHISH"].includes(method) &&
      !proofUrl
    ) {
      return res.status(400).json({
        message: "Please upload a clear payment receipt",
      });
    }

    const amount = PLAN_PRICES[plan];

    if (transactionId) {
      await assertTransactionAvailable(transactionId);
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        currency: "USD",
        method,
        status: "PENDING",
        transactionId,
        proofUrl,
      },
    });

    await sendPaymentSubmittedEmail({
      to: user.email,
      username: user.username,
      amount,
      method,
    });

    return res.status(201).json({
      message: "Payment submitted successfully. Waiting for admin review.",
      payment,
      plan,
      amount,
    });
  } catch (error) {
    return handleError(res, error, "Failed to submit payment");
  }
};

export const getMyPayments = async (req, res) => {
  const userId = req.userId;

  try {
    const payments = await prisma.payment.findMany({
      where: {
        userId,
      },
      include: {
        subscription: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(payments);
  } catch (error) {
    return handleError(res, error, "Failed to get payments");
  }
};

export const getAdminPayments = async (req, res) => {
  try {
    const status = cleanText(req.query.status).toUpperCase();

    const where = {};

    if (PAYMENT_STATUSES.includes(status)) {
      where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        subscription: true,
        reviewer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(payments);
  } catch (error) {
    return handleError(res, error, "Failed to get payments");
  }
};

export const reviewPayment = async (req, res) => {
  const paymentId = cleanText(req.params.id);
  const adminId = req.userId;

  const status = cleanText(req.body.status).toUpperCase();
  const adminNotes = cleanText(req.body.adminNotes) || null;

  try {
    if (!isValidObjectId(paymentId)) {
      return res.status(400).json({
        message: "Invalid payment ID",
      });
    }

    if (!["SUCCESS", "FAILED", "REFUNDED"].includes(status)) {
      return res.status(400).json({
        message: "Status must be SUCCESS, FAILED, or REFUNDED",
      });
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    if (payment.status !== "PENDING" && status === "SUCCESS") {
      return res.status(400).json({
        message: "Only pending payments can be approved",
      });
    }

    if (status === "SUCCESS") {
      const selectedPlan = "PREMIUM";

      await prisma.payment.update({
        where: {
          id: paymentId,
        },
        data: {
          adminNotes,
        },
      });

      const subscription = await activatePaidSubscription({
        userId: payment.userId,
        plan: selectedPlan,
        paymentId,
        reviewedBy: adminId,
        autoRenew: false,
      });

      const updatedPayment = await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
        include: {
          subscription: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      return res.status(200).json({
        message: "Payment approved and subscription activated",
        payment: updatedPayment,
        subscription,
      });
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        status,
        adminNotes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: payment.userId,
        type: "PAYMENT_FAILED",
        title: status === "REFUNDED" ? "Payment refunded" : "Payment rejected",
        message:
          adminNotes ||
          (status === "REFUNDED"
            ? "Your payment was refunded."
            : "Your payment could not be verified."),
        link: "/billing",
        metadata: {
          paymentId,
          status,
        },
      },
    });

    await sendPaymentRejectedEmail({
      to: updatedPayment.user?.email,
      username: updatedPayment.user?.username,
      reason: adminNotes,
      refunded: status === "REFUNDED",
    });

    return res.status(200).json({
      message: `Payment marked as ${status}`,
      payment: updatedPayment,
    });
  } catch (error) {
    return handleError(res, error, "Failed to review payment");
  }
};

export const getBillingOverview = async (req, res) => {
  const userId = req.userId;

  try {
    const [subscription, payments] = await Promise.all([
      getCurrentSubscription(userId),
      prisma.payment.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),
    ]);

    return res.status(200).json({
      subscription,
      payments,
      plans: PLAN_PRICES,
      cardPaymentsEnabled: isStripeConfigured(),
    });
  } catch (error) {
    return handleError(res, error, "Failed to get billing overview");
  }
};
