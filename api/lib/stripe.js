import Stripe from "stripe";

let stripeClient = null;

const looksLikeStripeKey = (value, prefixes) => {
  const key = String(value || "").trim();
  return prefixes.some(
    (prefix) => key.startsWith(prefix) && key.length > 20 && !key.includes("...")
  );
};

export const isStripeConfigured = () =>
  looksLikeStripeKey(process.env.STRIPE_SECRET_KEY, ["sk_test_", "sk_live_"]) &&
  looksLikeStripeKey(process.env.STRIPE_PUBLISHABLE_KEY, [
    "pk_test_",
    "pk_live_",
  ]);

export const getStripe = () => {
  if (!isStripeConfigured()) {
    const error = new Error(
      "Card payments are not configured. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to the API .env."
    );
    error.status = 503;
    throw error;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};

export const getStripePublishableKey = () =>
  process.env.STRIPE_PUBLISHABLE_KEY || "";

export const dollarsToCents = (amount) => Math.round(Number(amount) * 100);
