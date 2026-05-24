import { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";

const emptyCode = ["", "", "", "", "", ""];

function Login() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  const { updateUser } = useContext(AuthContext);

  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(emptyCode);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
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

  const resetCode = () => {
    setCodeDigits(emptyCode);
  };

  const focusCodeInput = (index = 0) => {
    setTimeout(() => {
      inputRefs.current[index]?.focus();
    }, 100);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const emailValue = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (!emailValue) {
      setError("Email address is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setIsLoading(true);
      clearMessages();

      const res = await apiRequest.post("/auth/login", {
        email: emailValue,
        password,
      });

      setEmail(emailValue);
      setStep("verify");
      setCooldown(30);
      resetCode();
      setSuccess(res.data?.message || "Verification code sent to your email.");
      focusCodeInput(0);
    } catch (err) {
      console.log("LOGIN ERROR:", err);
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 1);

    if (!/^\d?$/.test(cleanValue)) {
      return;
    }

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

    const code = codeDigits.join("");

    if (!email) {
      setError("Email is missing. Please login again.");
      setStep("login");
      return;
    }

    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code.");
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
      navigate("/");
    } catch (err) {
      console.log("VERIFY LOGIN CODE ERROR:", err);
      setError(err.response?.data?.message || "Invalid verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email || cooldown > 0 || isResending) {
      return;
    }

    try {
      setIsResending(true);
      clearMessages();

      const res = await apiRequest.post("/auth/resend-login-code", {
        email,
      });

      resetCode();
      setSuccess(res.data?.message || "A new code was sent.");
      setCooldown(30);
      focusCodeInput(0);
    } catch (err) {
      console.log("RESEND LOGIN CODE ERROR:", err);
      setError(err.response?.data?.message || "Failed to resend code.");
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
    <div className="login pageFade">
      <div className={step === "verify" ? "authCard verifyMode" : "authCard"}>
        <div className="formContainer">
          {step === "login" ? (
            <form onSubmit={handleLoginSubmit} className="authForm">
              <span className="authBadge">Welcome Back</span>

              <div className="authHeader">
                <h1>Sign in to SmartEstate</h1>

                <p>
                  Login securely to manage your properties, saved homes,
                  messages, and profile.
                </p>
              </div>

              <div className="formGroup">
                <label htmlFor="email">Email Address</label>

                <input
                  id="email"
                  name="email"
                  required
                  type="email"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="password">Password</label>

                <div className="passwordBox">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && <span className="errorMessage">{error}</span>}
              {success && <span className="successMessage">{success}</span>}

              <button
                type="submit"
                className="mainAuthBtn"
                disabled={isLoading}
              >
                {isLoading ? "Checking..." : "Continue"}
              </button>

              <div className="authFooter">
                <span>Don&apos;t have an account?</span>
                <Link to="/register">Create Account</Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifySubmit} className="authForm verifyForm">
              <span className="authBadge">Security Check</span>

              <div className="verifyIcon">🔐</div>

              <div className="authHeader center">
                <h1>Verify Your Login</h1>

                <p>
                  We sent a 6-digit verification code to:
                  <br />
                  <b>{email}</b>
                </p>
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
                    aria-label={`Verification digit ${index + 1}`}
                  />
                ))}
              </div>

              {error && <span className="errorMessage">{error}</span>}
              {success && <span className="successMessage">{success}</span>}

              <button
                type="submit"
                className="mainAuthBtn"
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>

              <div className="verifyActions">
                <button
                  type="button"
                  className="resendCodeBtn"
                  onClick={handleResendCode}
                  disabled={isResending || cooldown > 0 || isLoading}
                >
                  {isResending
                    ? "Sending..."
                    : cooldown > 0
                    ? `Resend Code in ${cooldown}s`
                    : "Resend Code"}
                </button>

                <button
                  type="button"
                  className="backLoginBtn"
                  onClick={handleBackToLogin}
                  disabled={isLoading || isResending}
                >
                  Change Email or Password
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="imgContainer">
          <div className="imageContent">
            <span>SmartEstate</span>

            <h2>Find, save, and manage properties with confidence.</h2>

            <p>
              A modern real estate platform built for buyers, renters, agents,
              and property owners.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;