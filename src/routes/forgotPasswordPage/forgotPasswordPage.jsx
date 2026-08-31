import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import apiRequest from "../../lib/apiRequest";
import AuthVisual from "../../components/authVisual/AuthVisual";
import "../login/login.scss";

const emptyCode = ["", "", "", "", "", ""];
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);
  const { t } = useTranslation();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState([...emptyCode]);
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const resetCode = () => setCodeDigits([...emptyCode]);

  const focusCodeInput = (index = 0) => {
    setTimeout(() => inputRefs.current[index]?.focus(), 100);
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const emailValue = email.trim().toLowerCase();
    if (!emailValue) {
      setError(t("forgotPassword.validation.emailRequired"));
      return;
    }
    if (!emailValue.includes("@") || !emailValue.includes(".")) {
      setError(t("forgotPassword.validation.emailInvalid"));
      return;
    }

    try {
      setIsLoading(true);
      clearMessages();
      const res = await apiRequest.post("/auth/forgot-password", {
        email: emailValue,
      });
      setEmail(emailValue);
      setStep("verify");
      setCooldown(30);
      resetCode();
      setSuccess(res.data?.message || t("forgotPassword.success.codeSent"));
      focusCodeInput(0);
    } catch (err) {
      setStep("email");
      setError(
        err.response?.status === 404
          ? t("forgotPassword.errors.emailNotFound")
          : err.response?.data?.message ||
              t("forgotPassword.errors.requestFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 1);
    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = cleanValue;
      return next;
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
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...emptyCode];
    pasted.split("").forEach((digit, i) => {
      next[i] = digit;
    });
    setCodeDigits(next);
    clearMessages();
    focusCodeInput(Math.min(pasted.length, 5));
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const code = codeDigits.join("");
    if (code.length !== 6) {
      setError(t("forgotPassword.validation.codeRequired"));
      return;
    }

    try {
      setIsLoading(true);
      clearMessages();
      const res = await apiRequest.post("/auth/verify-reset-code", {
        email,
        code,
      });
      setResetToken(res.data?.resetToken || "");
      setStep("reset");
      setSuccess(res.data?.message || t("forgotPassword.success.codeVerified"));
    } catch (err) {
      setError(
        err.response?.data?.message || t("forgotPassword.errors.invalidCode")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (isResending || cooldown > 0 || !email) return;

    try {
      setIsResending(true);
      clearMessages();
      const res = await apiRequest.post("/auth/resend-reset-code", { email });
      setCooldown(30);
      resetCode();
      setSuccess(res.data?.message || t("forgotPassword.success.newCodeSent"));
      focusCodeInput(0);
    } catch (err) {
      setError(
        err.response?.data?.message || t("forgotPassword.errors.resendFailed")
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!passwordRegex.test(password)) {
      setError(t("forgotPassword.validation.passwordWeak"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("forgotPassword.validation.passwordMismatch"));
      return;
    }
    if (!resetToken) {
      setError(t("forgotPassword.errors.sessionExpired"));
      setStep("email");
      return;
    }

    try {
      setIsLoading(true);
      clearMessages();
      const res = await apiRequest.post("/auth/reset-password", {
        resetToken,
        password,
      });
      setSuccess(res.data?.message || t("forgotPassword.success.resetDone"));
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(
        err.response?.data?.message || t("forgotPassword.errors.resetFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="loginPage pageFade">
      <section
        className={
          step === "verify" ? "loginCard verifyMode" : "loginCard"
        }
      >
        <div className="loginFormSide">
          {step === "email" && (
            <form onSubmit={handleRequestCode} className="loginForm">
              <span className="loginBadge">
                {t("forgotPassword.email.badge")}
              </span>
              <div className="loginHeader">
                <h1>{t("forgotPassword.email.title")}</h1>
                <p>{t("forgotPassword.email.description")}</p>
              </div>

              <div className="loginFormGroup">
                <label htmlFor="reset-email">
                  {t("forgotPassword.form.email")}
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearMessages();
                  }}
                  placeholder={t("forgotPassword.form.emailPlaceholder")}
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              {error && <div className="loginError">{error}</div>}
              {success && <div className="loginSuccess">{success}</div>}

              <button
                type="submit"
                className="loginMainBtn"
                disabled={isLoading}
              >
                {isLoading
                  ? t("forgotPassword.buttons.sending")
                  : t("forgotPassword.buttons.sendCode")}
              </button>

              <div className="loginFooter">
                <span>{t("forgotPassword.email.remember")}</span>
                <Link to="/login">{t("forgotPassword.email.backToLogin")}</Link>
              </div>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyCode} className="loginForm verifyForm">
              <span className="loginBadge">
                {t("forgotPassword.verify.badge")}
              </span>
              <div className="verifyIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div className="loginHeader center">
                <h1>{t("forgotPassword.verify.title")}</h1>
                <p>
                  {t("forgotPassword.verify.description")}
                  <br />
                  <b>{email}</b>
                </p>
                <p className="loginSpamHint">
                  {t("forgotPassword.verify.spamHint")}
                </p>
              </div>

              <div className="codeInputs" onPaste={handleCodePaste}>
                {codeDigits.map((digit, index) => (
                  <input
                    key={`reset-code-${index}`}
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
                    aria-label={t("forgotPassword.verify.digitLabel", {
                      digit: index + 1,
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
                {isLoading
                  ? t("forgotPassword.buttons.verifying")
                  : t("forgotPassword.buttons.verifyCode")}
              </button>

              <div className="verifyActions">
                <button
                  type="button"
                  className="resendCodeBtn"
                  onClick={handleResend}
                  disabled={isResending || cooldown > 0 || isLoading}
                >
                  {isResending
                    ? t("forgotPassword.buttons.sending")
                    : cooldown > 0
                      ? t("forgotPassword.buttons.resendIn", {
                          seconds: cooldown,
                        })
                      : t("forgotPassword.buttons.resendCode")}
                </button>
                <button
                  type="button"
                  className="backLoginBtn"
                  onClick={() => {
                    setStep("email");
                    resetCode();
                    clearMessages();
                  }}
                  disabled={isLoading || isResending}
                >
                  {t("forgotPassword.buttons.changeEmail")}
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="loginForm">
              <span className="loginBadge">
                {t("forgotPassword.reset.badge")}
              </span>
              <div className="loginHeader">
                <h1>{t("forgotPassword.reset.title")}</h1>
                <p>{t("forgotPassword.reset.description")}</p>
              </div>

              <div className="loginFormGroup">
                <label htmlFor="new-password">
                  {t("forgotPassword.form.newPassword")}
                </label>
                <div className="loginPasswordBox">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearMessages();
                    }}
                    placeholder={t("forgotPassword.form.passwordPlaceholder")}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                  >
                    {showPassword
                      ? t("forgotPassword.form.hide")
                      : t("forgotPassword.form.show")}
                  </button>
                </div>
              </div>

              <div className="loginFormGroup">
                <label htmlFor="confirm-password">
                  {t("forgotPassword.form.confirmPassword")}
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearMessages();
                  }}
                  placeholder={t("forgotPassword.form.confirmPlaceholder")}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>

              {error && <div className="loginError">{error}</div>}
              {success && <div className="loginSuccess">{success}</div>}

              <button
                type="submit"
                className="loginMainBtn"
                disabled={isLoading}
              >
                {isLoading
                  ? t("forgotPassword.buttons.saving")
                  : t("forgotPassword.buttons.resetPassword")}
              </button>

              <div className="loginFooter">
                <Link to="/login">{t("forgotPassword.email.backToLogin")}</Link>
              </div>
            </form>
          )}
        </div>

        <AuthVisual
          title={t("forgotPassword.visual.title")}
          description={t("forgotPassword.visual.description")}
          journey={[
            t("forgotPassword.visual.journeyEmail"),
            t("forgotPassword.visual.journeyCode"),
            t("forgotPassword.visual.journeyPassword"),
          ]}
          showcase={[
            {
              icon: "shield",
              title: t("forgotPassword.visual.showcaseSafeTitle"),
              text: t("forgotPassword.visual.showcaseSafeText"),
            },
            {
              icon: "key",
              title: t("forgotPassword.visual.showcaseKeyTitle"),
              text: t("forgotPassword.visual.showcaseKeyText"),
            },
          ]}
          noteTitle={t("forgotPassword.visual.secureTitle")}
          noteText={t("forgotPassword.visual.secureText")}
        />
      </section>
    </main>
  );
}

export default ForgotPasswordPage;
