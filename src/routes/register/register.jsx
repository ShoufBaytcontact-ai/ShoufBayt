import { useContext, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./register.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { afterAuthPath } from "../../lib/phoneGate";
import AuthVisual from "../../components/authVisual/AuthVisual";
import GoogleAuthButton from "../../components/googleAuthButton/GoogleAuthButton";

function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { updateUser } = useContext(AuthContext);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordChecks = useMemo(() => {
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    return {
      length: password.length >= 6,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: password !== "" && password === confirmPassword,
    };
  }, [form.password, form.confirmPassword]);

  const passwordScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length;
  }, [passwordChecks]);

  const strengthText =
    passwordScore <= 2
      ? t("register.strength.weak")
      : passwordScore <= 4
      ? t("register.strength.medium")
      : t("register.strength.strong");

  const strengthClass =
    passwordScore <= 2 ? "weak" : passwordScore <= 4 ? "medium" : "strong";

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearError();
  };

  const validateForm = () => {
    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();

    if (!username) {
      return t("register.validation.usernameRequired");
    }

    if (username.length < 3) {
      return t("register.validation.usernameLength");
    }

    if (!email) {
      return t("register.validation.emailRequired");
    }

    if (!email.includes("@") || !email.includes(".")) {
      return t("register.validation.emailInvalid");
    }

    if (!form.password || !form.confirmPassword) {
      return t("register.validation.passwordFieldsRequired");
    }

    if (!isPasswordValid) {
      return t("register.validation.passwordRequirements");
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const res = await apiRequest.post("/auth/register", {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (res.data?.requiresVerification) {
        navigate("/login", {
          replace: true,
          state: {
            pendingEmail: form.email.trim().toLowerCase(),
            verifyAfterRegister: true,
          },
        });
        return;
      }

      updateUser(res.data);
      navigate(afterAuthPath(res.data, "/verify-phone"));
    } catch (err) {
      console.log("REGISTER ERROR:", err);
      setError(err.response?.data?.message || t("register.errors.failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="register pageFade">
      <section className="registerWrapper">
        <div className="registerCard">
          <div className="registerFormSide">
            <form onSubmit={handleSubmit} className="registerForm">
              <span className="registerBadge">
                {t("register.header.badge")}
              </span>

              <div className="registerHeader">
                <h1>{t("register.header.title")}</h1>

                <p>{t("register.header.description")}</p>
              </div>

              <GoogleAuthButton
                disabled={isLoading}
                onSuccess={(user) => {
                  updateUser(user);
                  navigate(afterAuthPath(user));
                }}
                onError={(message) => setError(message)}
              />

              <div className="authDivider">{t("auth.google.orEmail")}</div>

              <div className="formGroup">
                <label htmlFor="username">{t("register.form.username")}</label>

                <input
                  id="username"
                  type="text"
                  name="username"
                  placeholder={t("register.form.usernamePlaceholder")}
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="email">{t("register.form.email")}</label>

                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder={t("register.form.emailPlaceholder")}
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="password">{t("register.form.password")}</label>

                <div className="passwordBox">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={t("register.form.passwordPlaceholder")}
                    required
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                  >
                    {showPassword
                      ? t("register.form.hide")
                      : t("register.form.show")}
                  </button>
                </div>
              </div>

              <div className="formGroup">
                <label htmlFor="confirmPassword">
                  {t("register.form.confirmPassword")}
                </label>

                <div className="passwordBox">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder={t("register.form.confirmPasswordPlaceholder")}
                    required
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword
                      ? t("register.form.hide")
                      : t("register.form.show")}
                  </button>
                </div>
              </div>

              <div className="passwordStrength">
                <div className="strengthTop">
                  <span>{t("register.passwordStrength.title")}</span>
                  <b className={strengthClass}>{strengthText}</b>
                </div>

                <div className="strengthBar">
                  <div
                    className={`strengthFill ${strengthClass}`}
                    style={{
                      width: `${(passwordScore / 6) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="passwordRequirements">
                <p className="requirementsTitle">
                  {t("register.requirements.title")}
                </p>

                <p className={passwordChecks.length ? "valid" : "invalid"}>
                  {passwordChecks.length ? "✓" : "•"}{" "}
                  {t("register.requirements.length")}
                </p>

                <p className={passwordChecks.uppercase ? "valid" : "invalid"}>
                  {passwordChecks.uppercase ? "✓" : "•"}{" "}
                  {t("register.requirements.uppercase")}
                </p>

                <p className={passwordChecks.lowercase ? "valid" : "invalid"}>
                  {passwordChecks.lowercase ? "✓" : "•"}{" "}
                  {t("register.requirements.lowercase")}
                </p>

                <p className={passwordChecks.number ? "valid" : "invalid"}>
                  {passwordChecks.number ? "✓" : "•"}{" "}
                  {t("register.requirements.number")}
                </p>

                <p className={passwordChecks.special ? "valid" : "invalid"}>
                  {passwordChecks.special ? "✓" : "•"}{" "}
                  {t("register.requirements.special")}
                </p>

                <p className={passwordChecks.match ? "valid" : "invalid"}>
                  {passwordChecks.match ? "✓" : "•"}{" "}
                  {t("register.requirements.match")}
                </p>
              </div>

              {error && <div className="registerError">{error}</div>}

              <button
                type="submit"
                className="registerBtn"
                disabled={isLoading || !isPasswordValid}
              >
                {isLoading
                  ? t("register.buttons.creating")
                  : t("register.buttons.createAccount")}
              </button>

              <div className="registerFooter">
                <span>{t("register.footer.alreadyHaveAccount")}</span>
                <Link to="/login">{t("register.footer.signIn")}</Link>
              </div>
            </form>
          </div>

          <AuthVisual
            title={t("register.visual.title")}
            description={t("register.visual.description")}
            journey={[
              t("register.visual.journeyCreate"),
              t("register.visual.journeyList"),
              t("register.visual.journeyGrow"),
            ]}
            showcase={[
              {
                icon: "home",
                title: t("register.visual.showcasePostTitle"),
                text: t("register.visual.showcasePostText"),
              },
              {
                icon: "heart",
                title: t("register.visual.showcaseSaveTitle"),
                text: t("register.visual.showcaseSaveText"),
              },
              {
                icon: "chat",
                title: t("register.visual.showcaseMessageTitle"),
                text: t("register.visual.showcaseMessageText"),
              },
            ]}
            chips={[
              t("register.visual.chipOwners"),
              t("register.visual.chipBuyers"),
              t("register.visual.chipRenters"),
              t("register.visual.chipAgents"),
            ]}
          />
        </div>
      </section>
    </main>
  );
}

export default Register;