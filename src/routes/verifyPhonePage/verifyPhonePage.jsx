import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../login/login.scss";
import "./verifyPhonePage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import PhoneField from "../../components/phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";

function VerifyPhonePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, updateUser } = useContext(AuthContext);

  const isChange = Boolean(currentUser?.phone);

  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) return;

    if (!isValidPhone(phone)) {
      setError(t("phoneField.errors.invalid"));
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setSuccess("");
      const res = await apiRequest.post("/users/phone", {
        phone,
      });
      updateUser(res.data);
      setSuccess(t("verifyPhone.success.saved"));
      setTimeout(() => {
        navigate(isChange ? "/profile/update" : "/", { replace: true });
      }, 700);
    } catch (err) {
      const code = err.response?.data?.code;
      setError(
        code === "PHONE_TAKEN"
          ? t("verifyPhone.errors.phoneTaken")
          : err.response?.data?.message || t("verifyPhone.errors.saveFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="loginPage pageFade">
      <section className="loginCard">
        <div className="loginFormSide">
          <form onSubmit={handleSubmit} className="loginForm">
            <span className="loginBadge">{t("verifyPhone.badge")}</span>

            <div className="loginHeader">
              <h1>
                {isChange
                  ? t("verifyPhone.changeTitle")
                  : t("verifyPhone.title")}
              </h1>
              <p>
                {isChange
                  ? t("verifyPhone.changeText")
                  : t("verifyPhone.text")}
              </p>
            </div>

            <div className="loginFormGroup">
              <label htmlFor="phone">{t("verifyPhone.phoneLabel")}</label>
              <PhoneField
                id="phone"
                value={phone}
                onChange={(next) => {
                  setPhone(next);
                  setError("");
                  setSuccess("");
                }}
                disabled={isLoading}
                required
              />
            </div>

            <p className="loginSpamHint">{t("verifyPhone.phoneHint")}</p>

            {error ? <div className="loginError">{error}</div> : null}
            {success ? <div className="loginSuccess">{success}</div> : null}

            <button
              type="submit"
              className="loginMainBtn"
              disabled={isLoading}
            >
              {isLoading ? t("verifyPhone.saving") : t("verifyPhone.save")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default VerifyPhonePage;
