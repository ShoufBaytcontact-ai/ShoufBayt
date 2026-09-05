import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./profileupdatepage.scss";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import PhoneField from "../../components/phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";

function getImageUrl(image, fallback = "/no-avatar.png") {
  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  if (!image || typeof image !== "string") {
    return fallback;
  }

  if (image.startsWith("http") || image.startsWith("data:")) {
    return image;
  }

  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

function ProfileUpdatePage() {
  const { currentUser, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState("/no-avatar.png");
  const [previewUrl, setPreviewUrl] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form");
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);
  const codeRefs = useRef([]);

  const userId = currentUser?.id || currentUser?._id;
  const savedPhone =
    currentUser?.phone || currentUser?.agentProfile?.phone || "";
  const pendingEmail = String(currentUser?.pendingEmail || "").trim();

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

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const isChangingPassword = form.password.trim().length > 0;

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setForm({
      username: currentUser.username || "",
      email: currentUser.pendingEmail || currentUser.email || "",
      phone: currentUser.phone || currentUser.agentProfile?.phone || "",
      password: "",
      confirmPassword: "",
    });

    setPreview(getImageUrl(currentUser.avatar));

    if (currentUser.pendingEmail) {
      setStep("verify");
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const handleImageChange = (e) => {
    const selectedImage = e.target.files?.[0];

    if (!selectedImage) {
      return;
    }

    if (!selectedImage.type.startsWith("image/")) {
      setError(t("profileUpdate.validation.validImage"));
      e.target.value = "";
      return;
    }

    if (selectedImage.size > 5 * 1024 * 1024) {
      setError(t("profileUpdate.validation.imageSize"));
      e.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreviewUrl = URL.createObjectURL(selectedImage);

    setAvatar(selectedImage);
    setPreview(newPreviewUrl);
    setPreviewUrl(newPreviewUrl);
    clearMessages();

    e.target.value = "";
  };

  const handleResetImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setAvatar(null);
    setPreviewUrl("");
    setPreview(getImageUrl(currentUser?.avatar));
    clearMessages();
  };

  const validateForm = () => {
    if (!form.username.trim()) {
      return t("profileUpdate.validation.usernameRequired");
    }

    if (!form.email.trim()) {
      return t("profileUpdate.validation.emailRequired");
    }

    if (!form.email.includes("@") || !form.email.includes(".")) {
      return t("profileUpdate.validation.emailInvalid");
    }

    const phoneChanged = form.phone.trim() !== String(savedPhone).trim();
    if (phoneChanged && form.phone.trim() && !isValidPhone(form.phone)) {
      return t("profileUpdate.validation.phoneInvalid");
    }

    if (isChangingPassword && !isPasswordValid) {
      if (form.password !== form.confirmPassword) {
        return t("profileUpdate.validation.passwordMismatch");
      }

      return t("profileUpdate.validation.passwordRequirements");
    }

    if (!userId) {
      return t("profileUpdate.validation.userNotFound");
    }

    return "";
  };

  const profileErrorMessage = (err) => {
    const code = err.response?.data?.code;
    if (code === "PHONE_TAKEN") return t("profileUpdate.validation.phoneTaken");
    if (code === "USERNAME_TAKEN") {
      return t("profileUpdate.validation.usernameTaken");
    }
    if (code === "EMAIL_TAKEN") return t("profileUpdate.validation.emailTaken");
    return err.response?.data?.message || t("profileUpdate.errors.failed");
  };

  const resetCode = () => {
    setCodeDigits(["", "", "", "", "", ""]);
  };

  const focusCodeInput = (index = 0) => {
    setTimeout(() => {
      codeRefs.current[index]?.focus();
    }, 100);
  };

  const handleCodeChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 1);

    setCodeDigits((prev) => {
      const updatedCode = [...prev];
      updatedCode[index] = cleanValue;
      return updatedCode;
    });

    clearMessages();

    if (cleanValue && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
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

    const updatedCode = ["", "", "", "", "", ""];
    for (let i = 0; i < pastedValue.length; i += 1) {
      updatedCode[i] = pastedValue[i];
    }

    setCodeDigits(updatedCode);
    clearMessages();
    const nextIndex = pastedValue.length >= 6 ? 5 : pastedValue.length;
    codeRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("username", form.username.trim());
      formData.append("email", form.email.trim().toLowerCase());

      const phoneChanged = form.phone.trim() !== String(savedPhone).trim();
      if (phoneChanged && isValidPhone(form.phone)) {
        formData.append("phone", form.phone.trim());
      }

      if (form.password.trim()) {
        formData.append("password", form.password.trim());
      }

      if (avatar) {
        formData.append("avatar", avatar);
      }

      const res = await apiRequest.put(`/users/${userId}`, formData, {
        withCredentials: true,
      });

      updateUser(res.data);

      if (res.data?.requiresEmailVerification || res.data?.pendingEmail) {
        setStep("verify");
        setCooldown(30);
        resetCode();
        setSuccess(t("profileUpdate.verify.codeSent"));
        focusCodeInput(0);
        return;
      }

      setSuccess(t("profileUpdate.success.updated"));

      setTimeout(() => {
        navigate("/profile");
      }, 900);
    } catch (err) {
      console.log("UPDATE PROFILE ERROR:", err);
      setError(profileErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (loading) return;

    const code = codeDigits.join("");
    if (code.length !== 6) {
      setError(t("profileUpdate.verify.codeRequired"));
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      const res = await apiRequest.post("/users/email/verify", { code });
      updateUser(res.data);
      setSuccess(t("profileUpdate.verify.verified"));
      setStep("form");
      resetCode();
      setTimeout(() => {
        navigate("/profile");
      }, 900);
    } catch (err) {
      setError(
        err.response?.data?.message || t("profileUpdate.verify.verifyFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    if (loading || cooldown > 0) return;

    try {
      setLoading(true);
      clearMessages();
      await apiRequest.post("/users/email/resend");
      setCooldown(30);
      resetCode();
      setSuccess(t("profileUpdate.verify.codeSent"));
      focusCodeInput(0);
    } catch (err) {
      setError(
        err.response?.data?.message || t("profileUpdate.verify.resendFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmailChange = async () => {
    if (loading) return;

    try {
      setLoading(true);
      clearMessages();
      const res = await apiRequest.post("/users/email/cancel");
      updateUser(res.data);
      setForm((prev) => ({
        ...prev,
        email: res.data?.email || prev.email,
      }));
      setStep("form");
      resetCode();
      setSuccess(t("profileUpdate.verify.cancelled"));
    } catch (err) {
      setError(
        err.response?.data?.message || t("profileUpdate.verify.cancelFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <main className="profileUpdatePage pageFade">
        <div className="profileUpdateLoading">
          <span></span>
          <h2>{t("profileUpdate.loading.title")}</h2>
          <p>{t("profileUpdate.loading.message")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="profileUpdatePage pageFade">
      <div className="profileUpdateWrapper">
        <section className="profileUpdateHeader">
          <div>
            <p className="profileUpdateBadge">
              {t("profileUpdate.header.badge")}
            </p>

            <h1>{t("profileUpdate.header.title")}</h1>

            <p>{t("profileUpdate.header.description")}</p>
          </div>

          <Link to="/profile" className="backBtn">
            {t("profileUpdate.header.backToProfile")}
          </Link>
        </section>

        <section className="profileUpdateLayout">
            {step === "verify" ? (
              <form className="emailVerifyBox" onSubmit={handleVerifyEmail}>
                <span>{t("profileUpdate.verify.badge")}</span>
                <h2>{t("profileUpdate.verify.title")}</h2>
                <p>
                  {t("profileUpdate.verify.description")}
                  <br />
                  <b>{pendingEmail || form.email}</b>
                </p>
                <p className="emailVerifyHint">
                  {t("profileUpdate.verify.spamHint")}
                </p>

                <div className="codeInputs" onPaste={handleCodePaste}>
                  {codeDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        codeRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      disabled={loading}
                      aria-label={t("profileUpdate.verify.digitLabel", {
                        number: index + 1,
                      })}
                    />
                  ))}
                </div>

                {error && (
                  <div className="updateMessage errorMessage">{error}</div>
                )}
                {success && (
                  <div className="updateMessage successMessage">{success}</div>
                )}

                <div className="formActions">
                  <button type="submit" disabled={loading}>
                    {loading
                      ? t("profileUpdate.verify.verifying")
                      : t("profileUpdate.verify.verifyCode")}
                  </button>
                </div>

                <div className="emailVerifyActions">
                  <button
                    type="button"
                    onClick={handleResendEmailCode}
                    disabled={loading || cooldown > 0}
                  >
                    {cooldown > 0
                      ? t("profileUpdate.verify.resendIn", { seconds: cooldown })
                      : t("profileUpdate.verify.resend")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEmailChange}
                    disabled={loading}
                  >
                    {t("profileUpdate.verify.keepCurrent")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      clearMessages();
                    }}
                    disabled={loading}
                  >
                    {t("profileUpdate.verify.backToForm")}
                  </button>
                </div>
              </form>
            ) : null}

            <form
              className="profileUpdateForm"
              onSubmit={handleSubmit}
              hidden={step === "verify"}
            >
            <div className="profileFormHeader">
              <span>{t("profileUpdate.formHeader.badge")}</span>

              <h2>{t("profileUpdate.formHeader.title")}</h2>

              <p>{t("profileUpdate.formHeader.description")}</p>
            </div>

            <div className="inputGrid">
              <div className="inputGroup">
                <label htmlFor="username">
                  {t("profileUpdate.form.username")}
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  placeholder={t("profileUpdate.form.usernamePlaceholder")}
                  disabled={loading}
                />
              </div>

              <div className="inputGroup">
                <label htmlFor="email">{t("profileUpdate.form.email")}</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={t("profileUpdate.form.emailPlaceholder")}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="inputGroup">
              <label htmlFor="phone">{t("profileUpdate.form.phone")}</label>
              <PhoneField
                id="phone"
                value={form.phone}
                onChange={(phone) => {
                  setForm((prev) => ({
                    ...prev,
                    phone,
                  }));
                  clearMessages();
                }}
                disabled={loading}
                required={false}
                allowEmpty
              />
              <small>{t("profileUpdate.form.phoneHelp")}</small>
            </div>

            <div className="inputGroup">
              <label htmlFor="password">
                {t("profileUpdate.form.newPassword")}
              </label>

              <div className="passwordBox">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder={t("profileUpdate.form.passwordPlaceholder")}
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                >
                  {showPassword
                    ? t("profileUpdate.form.hide")
                    : t("profileUpdate.form.show")}
                </button>
              </div>

              <small>{t("profileUpdate.form.passwordHelp")}</small>
            </div>

            <div className="inputGroup">
              <label htmlFor="confirmPassword">
                {t("profileUpdate.form.confirmPassword")}
              </label>

              <div className="passwordBox">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder={t("profileUpdate.form.confirmPasswordPlaceholder")}
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={loading}
                >
                  {showConfirmPassword
                    ? t("profileUpdate.form.hide")
                    : t("profileUpdate.form.show")}
                </button>
              </div>
            </div>

            {isChangingPassword && (
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
            )}

            {error && <div className="updateMessage errorMessage">{error}</div>}
            {success && (
              <div className="updateMessage successMessage">{success}</div>
            )}

            <div className="formActions">
              <button type="submit" disabled={loading}>
                {loading
                  ? t("profileUpdate.buttons.updating")
                  : t("profileUpdate.buttons.updateProfile")}
              </button>

              <Link to="/profile" className="cancelBtn">
                {t("profileUpdate.buttons.cancel")}
              </Link>
            </div>
          </form>

          <aside className="profileAvatarCard">
            <div className="avatarCardHeader">
              <span>{t("profileUpdate.avatar.badge")}</span>

              <h2>{t("profileUpdate.avatar.title")}</h2>

              <p>{t("profileUpdate.avatar.description")}</p>
            </div>

            <div className="avatarPreviewBox">
              <img
                src={preview}
                alt={t("profileUpdate.avatar.alt")}
                onError={(e) => {
                  e.currentTarget.src = "/no-avatar.png";
                }}
              />

              <span>{currentUser.role || "USER"}</span>
            </div>

            <div className="avatarActions">
              <label htmlFor="avatar" className="uploadBtn">
                {t("profileUpdate.avatar.chooseImage")}
              </label>

              {avatar && (
                <button
                  type="button"
                  className="resetImageBtn"
                  onClick={handleResetImage}
                  disabled={loading}
                >
                  {t("profileUpdate.avatar.reset")}
                </button>
              )}
            </div>

            <input
              id="avatar"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageChange}
              disabled={loading}
            />

            <div className="avatarInfo">
              <span>{t("profileUpdate.avatar.accepted")}</span>
              <span>{t("profileUpdate.avatar.maxSize")}</span>
            </div>

            <div className="accountBox">
              <h3>{t("profileUpdate.account.title")}</h3>

              <div>
                <span>{t("profileUpdate.account.username")}</span>
                <strong>{currentUser.username || t("profileUpdate.fallback.user")}</strong>
              </div>

              <div>
                <span>{t("profileUpdate.account.email")}</span>
                <strong>{currentUser.email || t("profileUpdate.fallback.noEmail")}</strong>
              </div>

              <div>
                <span>{t("profileUpdate.account.role")}</span>
                <strong>{currentUser.role || "USER"}</strong>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default ProfileUpdatePage;