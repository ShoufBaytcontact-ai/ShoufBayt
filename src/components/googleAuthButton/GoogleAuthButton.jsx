import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import apiRequest from "../../lib/apiRequest";
import "./googleAuthButton.scss";

let googleScriptPromise = null;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-identity]");

    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () => reject(new Error("GOOGLE_SCRIPT")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("GOOGLE_SCRIPT"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const isDarkTheme = () => {
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme) return theme === "dark";
  return document.body.classList.contains("dark");
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.8c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.4v3.1C3.4 21.4 7.4 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.4C.5 8.4 0 10.2 0 12s.5 3.6 1.4 5.4l3.9-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.6l3.9 3.1C6.2 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function GoogleAuthButton({ onSuccess, onError, disabled }) {
  const { t, i18n } = useTranslation();
  const hostRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [clientId, setClientId] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const envClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
        let nextClientId = envClientId;

        if (!nextClientId) {
          const res = await apiRequest.get("/auth/google-config");
          nextClientId = res.data?.clientId || "";
        }

        if (cancelled) {
          return;
        }

        setClientId(nextClientId);
      } catch {
        if (!cancelled) {
          setClientId("");
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !clientId || !hostRef.current || disabled) {
      return undefined;
    }

    let cancelled = false;

    const mountGoogleButton = async () => {
      try {
        const google = await loadGoogleIdentity();
        const identity = google?.accounts?.id;

        if (cancelled || !identity || !hostRef.current) {
          return;
        }

        identity.initialize({
          client_id: clientId,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          context: "signin",
          itp_support: true,
          callback: async (response) => {
            if (!response?.credential) {
              onErrorRef.current?.(
                t("auth.google.cancelled", {
                  defaultValue: "Google sign-in was cancelled.",
                })
              );
              setIsBusy(false);
              return;
            }

            setIsBusy(true);

            try {
              const res = await apiRequest.post("/auth/google", {
                credential: response.credential,
              });
              onSuccessRef.current?.(res.data);
            } catch (error) {
              onErrorRef.current?.(
                error.response?.data?.message ||
                  t("auth.google.failed", {
                    defaultValue: "Google sign-in failed. Please try again.",
                  })
                );
            } finally {
              setIsBusy(false);
            }
          },
        });

        const width = Math.min(
          400,
          Math.max(240, Math.floor(hostRef.current.getBoundingClientRect().width))
        );

        hostRef.current.innerHTML = "";
        identity.renderButton(hostRef.current, {
          type: "standard",
          theme: isDarkTheme() ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width,
          logo_alignment: "left",
          locale: i18n.language === "ar" ? "ar" : "en",
        });
      } catch {
        onErrorRef.current?.(
          t("auth.google.unavailable", {
            defaultValue: "Google sign-in is unavailable right now.",
          })
        );
      }
    };

    mountGoogleButton();

    return () => {
      cancelled = true;
    };
  }, [isReady, clientId, disabled, i18n.language, t]);

  const reportMissing = () => {
    onErrorRef.current?.(
      t("auth.google.notConfigured", {
        defaultValue: "Add GOOGLE_CLIENT_ID to api/.env, then restart the API.",
      })
    );
  };

  if (!isReady) {
    return (
      <button type="button" className="googleAuthBtn" disabled>
        <GoogleIcon />
        <span>{t("auth.google.connecting", { defaultValue: "Connecting..." })}</span>
      </button>
    );
  }

  if (!clientId) {
    return (
      <button type="button" className="googleAuthBtn" onClick={reportMissing} disabled={disabled}>
        <GoogleIcon />
        <span>{t("auth.google.continue", { defaultValue: "Continue with Google" })}</span>
      </button>
    );
  }

  return (
    <div className={`googleAuthSlot${isBusy || disabled ? " isBusy" : ""}`}>
      <div ref={hostRef} className="googleAuthGsi" />
      {isBusy ? (
        <p className="googleAuthStatus">
          {t("auth.google.connecting", { defaultValue: "Connecting..." })}
        </p>
      ) : null}
    </div>
  );
}

export default GoogleAuthButton;
