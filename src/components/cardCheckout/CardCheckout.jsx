import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { paymentApi } from "../../lib/services";

function CardPayForm({ amount, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const payable = Number(amount) || 30;

  const handlePay = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setMessage("");

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/billing`,
        },
      });

      if (error) {
        const text = error.message || "Card payment failed";
        setMessage(text);
        onError?.(text);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        const res = await paymentApi.completeCard({
          paymentIntentId: paymentIntent.id,
        });
        onSuccess?.(res.data?.message || "Premium activated automatically.");
        return;
      }

      const text = `Payment status: ${paymentIntent?.status || "unknown"}`;
      setMessage(text);
      onError?.(text);
    } catch (err) {
      const text =
        err.response?.data?.message || err.message || "Card payment failed";
      setMessage(text);
      onError?.(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cardCheckoutForm" onSubmit={handlePay}>
      <div className="cardElementWrap">
        <PaymentElement
          options={{
            layout: "tabs",
            fields: {
              billingDetails: {
                address: "never",
              },
            },
          }}
        />
      </div>

      {message ? <p className="cardPayMessage">{message}</p> : null}

      <button type="submit" className="primaryBtn" disabled={!stripe || busy}>
        {busy ? "Processing…" : `Pay $${payable} now`}
      </button>

      <p className="fileHint">
        Card details stay with Stripe. We never store your full card number.
        Auto-renew stays on after a successful charge.
      </p>
    </form>
  );
}

function CardCheckout({ amount, onSuccess, onError }) {
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [setupError, setSetupError] = useState("");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      try {
        setLoading(true);
        setSetupError("");

        const configRes = await paymentApi.cardConfig();
        const ready = Boolean(
          configRes.data?.configured && configRes.data?.publishableKey
        );

        if (!ready) {
          if (!active) return;
          setConfigured(false);
          return;
        }

        const intentRes = await paymentApi.createCardIntent({
          plan: "PREMIUM",
        });
        if (!active) return;

        setConfigured(true);
        setPublishableKey(
          intentRes.data.publishableKey || configRes.data.publishableKey
        );
        setClientSecret(intentRes.data.clientSecret);
      } catch (err) {
        if (!active) return;
        setSetupError(
          err.response?.data?.message ||
            err.message ||
            "Could not start card checkout"
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    boot();
    return () => {
      active = false;
    };
  }, []);

  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  if (loading) {
    return <div className="cardComingSoon">Preparing secure card form…</div>;
  }

  if (!configured) {
    return (
      <div className="cardComingSoon">
        Card checkout is not connected yet. Use OMT, Whish, or BOB and upload
        payment proof — Premium activates after admin review. Add Stripe keys
        to enable instant card payments.
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="billingAlert error">
        {setupError}
      </div>
    );
  }

  if (!stripePromise || !clientSecret) {
    return (
      <div className="billingAlert error">
        Unable to initialize card checkout.
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#c4a35a",
            borderRadius: "14px",
            fontFamily: "Figtree, sans-serif",
          },
        },
      }}
    >
      <CardPayForm amount={amount} onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}

export default CardCheckout;
