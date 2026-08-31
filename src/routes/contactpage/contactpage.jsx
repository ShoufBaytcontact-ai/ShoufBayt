import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./contact.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import ContactStatusBox from "../../components/contactBoxStatus/contactBoxStatus";

const getInitialFormData = (user) => ({
  name: user?.username || "",
  email: user?.email || "",
  subject: "",
  message: "",
  type: "MESSAGE",
});

function ContactPage() {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [formData, setFormData] = useState(getInitialFormData(currentUser));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [refreshMessages, setRefreshMessages] = useState(0);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      name: currentUser?.username || "",
      email: currentUser?.email || "",
    }));
  }, [currentUser]);

  const clearMessages = () => {
    setSuccess("");
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      return t("contact.validation.nameRequired");
    }

    if (!formData.email.trim()) {
      return t("contact.validation.emailRequired");
    }

    if (!formData.subject.trim()) {
      return t("contact.validation.subjectRequired");
    }

    if (!formData.message.trim()) {
      return t("contact.validation.messageRequired");
    }

    if (!["MESSAGE", "REPORT"].includes(formData.type)) {
      return t("contact.validation.invalidType");
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      navigate("/login");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      await apiRequest.post("/contact", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        type: formData.type,
      });

      setSuccess(
        formData.type === "REPORT"
          ? t("contact.success.report")
          : t("contact.success.message")
      );

      setFormData(getInitialFormData(currentUser));
      setRefreshMessages((prev) => prev + 1);
    } catch (err) {
      console.log("SEND CONTACT MESSAGE ERROR:", err);
      setError(err.response?.data?.message || t("contact.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="contactPage pageFade">
      <section className="contactHero">
        <div>
          <p className="contactEyebrow">{t("contact.hero.badge")}</p>
          <h1>{t("contact.hero.title")}</h1>
          <span>{t("contact.hero.description")}</span>

          {!currentUser && (
            <div className="contactLoginNotice">
              {t("contact.hero.loginNoticeBefore")}{" "}
              <Link to="/login">{t("contact.hero.signIn")}</Link>{" "}
              {t("contact.hero.loginNoticeAfter")}
            </div>
          )}
        </div>
      </section>

      <section className="contactMain">
        <aside className="contactInfoPanel">
          <p className="contactEyebrow">{t("contact.info.badge")}</p>

          <h2>{t("contact.info.title")}</h2>

          <p>{t("contact.info.description")}</p>

          <div className="contactInfoGrid">
            <div className="contactInfoBox">
              <span>{t("contact.info.email")}</span>
              <b>farhathamza633@gmail.com</b>
            </div>

            <div className="contactInfoBox">
              <span>{t("contact.info.phone")}</span>
              <b>+961 71 582 487</b>
            </div>

            <div className="contactInfoBox">
              <span>{t("contact.info.location")}</span>
              <b>{t("contact.info.locationValue")}</b>
            </div>

            <div className="contactInfoBox">
              <span>{t("contact.info.workingHours")}</span>
              <b>{t("contact.info.workingHoursValue")}</b>
            </div>
          </div>
        </aside>

        <section className="contactFormPanel">
          <div className="contactFormHeader">
            <p className="contactEyebrow">{t("contact.form.badge")}</p>

            <h2>{t("contact.form.title")}</h2>

            <p>{t("contact.form.description")}</p>
          </div>

          <form onSubmit={handleSubmit} className="contactForm">
            <div className="contactFormRow">
              <div className="contactFormGroup">
                <label htmlFor="name">{t("contact.form.fullName")}</label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder={t("contact.form.namePlaceholder")}
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={!currentUser || loading}
                />
              </div>

              <div className="contactFormGroup">
                <label htmlFor="email">{t("contact.form.emailAddress")}</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("contact.form.emailPlaceholder")}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={!currentUser || loading}
                />
              </div>
            </div>

            <div className="contactFormRow">
              <div className="contactFormGroup">
                <label htmlFor="type">{t("contact.form.requestType")}</label>

                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  disabled={!currentUser || loading}
                >
                  <option value="MESSAGE">{t("contact.form.generalMessage")}</option>
                  <option value="REPORT">{t("contact.form.reportProblem")}</option>
                </select>
              </div>

              <div className="contactFormGroup">
                <label htmlFor="subject">{t("contact.form.subject")}</label>

                <input
                  id="subject"
                  name="subject"
                  type="text"
                  placeholder={t("contact.form.subjectPlaceholder")}
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  disabled={!currentUser || loading}
                />
              </div>
            </div>

            <div className="contactFormGroup">
              <label htmlFor="message">{t("contact.form.message")}</label>

              <textarea
                id="message"
                name="message"
                placeholder={
                  currentUser
                    ? t("contact.form.messagePlaceholder")
                    : t("contact.form.signInPlaceholder")
                }
                value={formData.message}
                onChange={handleChange}
                required
                disabled={!currentUser || loading}
              ></textarea>
            </div>

            {success && <div className="contactSuccess">{success}</div>}
            {error && <div className="contactError">{error}</div>}

            <button type="submit" disabled={loading}>
              {!currentUser
                ? t("contact.form.signInToSend")
                : loading
                ? t("contact.form.sending")
                : formData.type === "REPORT"
                ? t("contact.form.sendReport")
                : t("contact.form.sendMessage")}
            </button>
          </form>
        </section>
      </section>

      {currentUser ? (
        <section className="contactStatusSection">
          <ContactStatusBox refreshKey={refreshMessages} />
        </section>
      ) : (
        <section className="contactLoginBox">
          <div>
            <p className="contactEyebrow">{t("contact.track.badge")}</p>
            <h2>{t("contact.track.title")}</h2>
            <p>{t("contact.track.description")}</p>
          </div>

          <Link to="/login">{t("contact.track.loginButton")}</Link>
        </section>
      )}
    </main>
  );
}

export default ContactPage;