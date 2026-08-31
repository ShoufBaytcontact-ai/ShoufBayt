import { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./login.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { afterAuthPath } from "../../lib/phoneGate";
import AuthVisual from "../../components/authVisual/AuthVisual";
import GoogleAuthButton from "../../components/googleAuthButton/GoogleAuthButton";

const emptyCode = ["", "", "", "", "", ""];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inputRefs = useRef([]);
  const { t } = useTranslation();

  const { updateUser } = useContext(AuthContext);

  const [step, setStep] = useState("login");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(emptyCode);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("reason");

    if (reason === "idle") {
      setError(t("login.errors.idle"));
    } else if (reason === "expired") {
      setError(t("login.errors.sessionExpired"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    const pendingEmail = String(location.state?.pendingEmail || "")
      .trim()
      .toLowerCase();

    if (!pendingEmail) {
      return;
    }

    setEmail(pendingEmail);
    setForm((prev) => ({ ...prev, email: pendingEmail }));
    setStep("verify");
    setCooldown(30);
    setCodeDigits([...emptyCode]);
    setSuccess(t("login.success.codeSent"));
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, t]);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  // Spread into a new array so state never reuses the shared emptyCode reference
  const resetCode = () => {
    setCodeDigits([...emptyCode]);
  };

  const focusCodeInput = (index = 0) => {
    setTimeout(() => {
      inputRefs.current[index]?.focus();
    }, 100);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const validateLogin = () => {
    const emailValue = form.email.trim().toLowerCase();

    if (!emailValue) {
      return t("login.validation.emailRequired");
    }

    if (!emailValue.includes("@") || !emailValue.includes(".")) {
      return t("login.validation.emailInvalid");
    }

    if (!form.password) {
      return t("login.validation.passwordRequired");
    }

    return "";
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    const validationError = validateLogin();

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    const emailValue = form.email.trim().toLowerCase();

    try {
      setIsLoading(true);
      clearMessages();

      const res = await apiRequest.post("/auth/login", {
        email: emailValue,
        password: form.password,
      });

      // Always require email verification — never skip to home after password alone
      setEmail(emailValue);
      setStep("verify");
      setCooldown(30);
      resetCode();
      setSuccess(res.data?.message || t("login.success.codeSent"));
      focusCodeInput(0);
    } catch (err) {
      console.log("LOGIN ERROR:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          t("login.errors.loginFailed")
      );
      setSuccess("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    // FIX: value is already stripped to a single digit (or empty) by
    // replace(/\D/g, "").slice(0, 1), so the follow-up /^\d?$/ test could
    // never fail — removed as dead code.
    const cleanValue = value.replace(/\D/g, "").slice(0, 1);

    setCodeDigits((prev) => {
      const updatedCode = [...prev];
      updatedCode[index] = cleanValue;
      return updatedCode;
    });

    clearMessages();

    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();

    const pastedValue = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedValue) {
      return;
    }

    const updatedCode = [...emptyCode];

    for (let i = 0; i < pastedValue.length; i += 1) {
      updatedCode[i] = pastedValue[i];
    }

    setCodeDigits(updatedCode);
    clearMessages();

    const nextIndex = pastedValue.length >= 6 ? 5 : pastedValue.length;
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    const code = codeDigits.join("");

    if (!email) {
      setError(t("login.validation.emailMissing"));
      setSuccess("");
      setStep("login");
      return;
    }

    if (code.length !== 6) {
      setError(t("login.validation.codeRequired"));
      setSuccess("");
      return;
    }

    try {
      setIsLoading(true);
      clearMessages();

      const res = await apiRequest.post("/auth/verify-login-code", {
        email,
        code,
      });

      const userData = res.data?.user || res.data;

      updateUser(userData);
      navigate(afterAuthPath(userData));
    } catch (err) {
      console.log("VERIFY LOGIN CODE ERROR:", err);
      setError(err.response?.data?.message || t("login.errors.invalidCode"));
      setSuccess("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email || cooldown > 0 || isResending || isLoading) {
      return;
    }

    try {
      setIsResending(true);
      clearMessages();

      const res = await apiRequest.post("/auth/resend-login-code", {
        email,
      });

      resetCode();
      setSuccess(res.data?.message || t("login.success.newCodeSent"));
      setCooldown(30);
      focusCodeInput(0);
    } catch (err) {
      console.log("RESEND LOGIN CODE ERROR:", err);
      setError(err.response?.data?.message || t("login.errors.resendFailed"));
      setSuccess("");
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = () => {
    setStep("login");
    setEmail("");
    setCooldown(0);
    resetCode();
    clearMessages();
  };

  return (
    <main className="loginPage pageFade">
      <section className={step === "verify" ? "loginCard verifyMode" : "loginCard"}>
        <div className="loginFormSide">
          {step === "login" ? (
            <form onSubmit={handleLoginSubmit} className="loginForm">
              <span className="loginBadge">{t("login.login.badge")}</span>

              <div className="loginHeader">
                <h1>{t("login.login.title")}</h1>

                <p>{t("login.login.description")}</p>
              </div>

              <GoogleAuthButton
                disabled={isLoading}
                onSuccess={(user) => {
                  updateUser(user);
                  navigate(afterAuthPath(user));
                }}
                onError={(message) => {
                  setSuccess("");
                  setError(message);
                }}
              />

              <div className="authDivider">{t("auth.google.orEmail")}</div>

              <div className="loginFormGroup">
                <label htmlFor="email">{t("login.form.email")}</label>

                <input
                  id="email"
                  name="email"
                  required
                  type="email"
                  placeholder={t("login.form.emailPlaceholder")}
                  value={form.email}
                  onChange={handleFormChange}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              <div className="loginFormGroup">
                <label htmlFor="password">{t("login.form.password")}</label>

                <div className="loginPasswordBox">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder={t("login.form.passwordPlaceholder")}
                    value={form.password}
                    onChange={handleFormChange}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                  >
                    {showPassword ? t("login.form.hide") : t("login.form.show")}
                  </button>
                </div>
              </div>

              {error && <div className="loginError">{error}</div>}
              {success && <div className="loginSuccess">{success}</div>}

              <button
                type="submit"
                className="loginMainBtn"
                disabled={isLoading}
              >
                {isLoading ? t("login.buttons.checking") : t("login.buttons.continue")}
              </button>

              <div className="loginForgotRow">
                <Link to="/forgot-password">{t("login.login.forgotPassword")}</Link>
              </div>

              <div className="loginFooter">
                <span>{t("login.login.noAccount")}</span>
                <Link to="/register">{t("login.login.createAccount")}</Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifySubmit} className="loginForm verifyForm">
              <span className="loginBadge">{t("login.verify.badge")}</span>

              <div className="verifyIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </div>

              <div className="loginHeader center">
                <h1>{t("login.verify.title")}</h1>

                <p>
                  {t("login.verify.description")}
                  <br />
                  <b>{email}</b>
                </p>

                <p className="loginSpamHint">{t("login.verify.spamHint")}</p>
              </div>

              <div className="codeInputs" onPaste={handleCodePaste}>
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    disabled={isLoading}
                    aria-label={t("login.verify.digitLabel", {
                      number: index + 1,
                    })}
                  />
                ))}
              </div>

              {error && <div className="loginError">{error}</div>}
              {success && <div className="loginSuccess">{success}</div>}

              <button
                type="submit"
                className="loginMainBtn"
                disabled={isLoading}
              >
                {isLoading ? t("login.buttons.verifying") : t("login.buttons.verifyCode")}
              </button>

              <div className="verifyActions">
                <button
                  type="button"
                  className="resendCodeBtn"
                  onClick={handleResendCode}
                  disabled={isResending || cooldown > 0 || isLoading}
                >
                  {isResending
                    ? t("login.buttons.sending")
                    : cooldown > 0
                    ? t("login.buttons.resendIn", { seconds: cooldown })
                    : t("login.buttons.resendCode")}
                </button>

                <button
                  type="button"
                  className="backLoginBtn"
                  onClick={handleBackToLogin}
                  disabled={isLoading || isResending}
                >
                  {t("login.buttons.changeCredentials")}
                </button>
              </div>
            </form>
          )}
        </div>

        <AuthVisual
          title={t("login.visual.title")}
          description={t("login.visual.description")}
          journey={[
            t("login.visual.journeyDiscover"),
            t("login.visual.journeyShortlist"),
            t("login.visual.journeyMove"),
          ]}
          showcase={[
            {
              icon: "search",
              title: t("login.visual.showcaseDiscoverTitle"),
              text: t("login.visual.showcaseDiscoverText"),
            },
            {
              icon: "chat",
              title: t("login.visual.showcaseConnectTitle"),
              text: t("login.visual.showcaseConnectText"),
            },
            {
              icon: "heart",
              title: t("login.visual.showcaseSaveTitle"),
              text: t("login.visual.showcaseSaveText"),
            },
          ]}
          chips={[
            t("login.visual.chipBuy"),
            t("login.visual.chipRent"),
            t("login.visual.chipBeirut"),
            t("login.visual.chipApartments"),
            t("login.visual.chipVillas"),
          ]}
          noteTitle={t("login.visual.secureLogin")}
          noteText={t("login.visual.securityText")}
        />
      </section>
    </main>
  );
}

export default Login;