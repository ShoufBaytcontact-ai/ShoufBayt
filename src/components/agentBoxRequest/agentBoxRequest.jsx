import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./agentBoxRequest.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import PhoneField from "../phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";
import {
  AgentPreviewCard,
  AgentUnlockPath,
  getUnlockStep,
  saveAgentPreview,
} from "../agentUnlock/agentUnlock";

const initialForm = {
  name: "",
  title: "",
  phone: "",
  location: "",
  bio: "",
};

function AgentRequestBox({ compact = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, updateUser } = useContext(AuthContext);

  const [freshUser, setFreshUser] = useState(currentUser);
  const [application, setApplication] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffPreview, setHandoffPreview] = useState(null);

  const userRole = (freshUser?.role || currentUser?.role || "").toUpperCase();
  const requestStatus = (
    application?.status ||
    freshUser?.agentRequestStatus ||
    currentUser?.agentRequestStatus ||
    "NONE"
  ).toUpperCase();

  const isAgent = userRole === "AGENT";
  const isPending = requestStatus === "PENDING";
  const isRejected = requestStatus === "REJECTED";

  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const getImageUrl = (image) => {
    if (!image || typeof image !== "string") {
      return "/no-avatar.png";
    }

    if (
      image.startsWith("http") ||
      image.startsWith("data:") ||
      image.startsWith("blob:")
    ) {
      return image;
    }

    return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
  };

  const fetchFreshUser = async ({ silent = false } = {}) => {
    if (!currentUser?.id) {
      return;
    }

    try {
      if (!silent) {
        setChecking(true);
      }

      const [res, requestRes] = await Promise.all([
        apiRequest.get(`/users/${currentUser.id}`),
        apiRequest.get("/agents/my-request").catch(() => ({ data: null })),
      ]);
      const updatedUser = res.data?.user || res.data;

      setApplication(requestRes.data || null);
      setFreshUser(updatedUser);

      if (updateUser) {
        updateUser({
          ...currentUser,
          ...updatedUser,
        });
      }

      setForm((prev) => ({
        ...prev,
        name: prev.name || updatedUser?.username || currentUser?.username || "",
      }));

      if (!silent) {
        setImagePreview(updatedUser?.avatar || currentUser?.avatar || "");
      }
    } catch (err) {
      console.log("FETCH USER STATUS ERROR:", err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchFreshUser();
  }, [currentUser?.id]);

  const clearMessages = () => {
    setError("");
    setMessage("");
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
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(t("agentRequest.validation.validImage"));
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t("agentRequest.validation.imageSize"));
      e.target.value = "";
      return;
    }

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setImageFile(file);
    setImagePreview(previewUrl);
    clearMessages();

    e.target.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview(freshUser?.avatar || currentUser?.avatar || "");
    clearMessages();
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return t("agentRequest.validation.nameRequired");
    }

    if (!form.title.trim()) {
      return t("agentRequest.validation.titleRequired");
    }

    if (!form.phone.trim()) {
      return t("agentRequest.validation.phoneRequired");
    }

    if (!isValidPhone(form.phone)) {
      return t("phoneField.errors.invalid");
    }

    if (!form.location.trim()) {
      return t("agentRequest.validation.locationRequired");
    }

    if (!form.bio.trim()) {
      return t("agentRequest.validation.bioRequired");
    }

    if (form.bio.trim().length < 20) {
      return t("agentRequest.validation.bioLength");
    }

    return "";
  };

  const openRequestForm = () => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || freshUser?.username || currentUser?.username || "",
      title: prev.title || t("agentRequest.form.agentTitlePlaceholder"),
    }));

    setShowForm(true);
    clearMessages();
  };

  const closeRequestForm = () => {
    if (requesting) {
      return;
    }

    setShowForm(false);
    setError("");
  };

  const handleRequestAgent = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setRequesting(true);
      clearMessages();

      const data = new FormData();

      data.append("name", form.name.trim());
      data.append("fullName", form.name.trim());
      data.append("title", form.title.trim());
      data.append("agencyName", form.title.trim());
      data.append("phone", form.phone.trim());
      data.append("location", form.location.trim());
      data.append("bio", form.bio.trim());

      if (imageFile) {
        data.append("image", imageFile);
      }

      await apiRequest.post("/agents/request", data);

      const preview = {
        name: form.name.trim(),
        title: form.title.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        image: imagePreview || "",
      };

      saveAgentPreview(preview);
      setHandoffPreview(preview);
      setApplication((prev) => ({
        ...(prev || {}),
        status: "PENDING",
        isPaid: false,
        name: preview.name,
        fullName: preview.name,
        title: preview.title,
        agencyName: preview.title,
        location: preview.location,
        bio: preview.bio,
        image: preview.image,
      }));
      setMessage(t("agentRequest.success.sent"));
      setShowForm(false);
      setShowHandoff(true);
      fetchFreshUser({ silent: true });
    } catch (err) {
      console.log("AGENT REQUEST ERROR:", err);
      const code = err.response?.data?.code;
      const mapped =
        code === "PHONE_TAKEN"
          ? t("agentRequest.errors.phoneTaken")
          : code === "FULL_NAME_TAKEN"
            ? t("agentRequest.errors.nameTaken")
            : null;
      setError(
        mapped || err.response?.data?.message || t("agentRequest.errors.failed")
      );
    } finally {
      setRequesting(false);
    }
  };

  const unlockStep = getUnlockStep({
    isAgent,
    isPending: isPending || showHandoff,
    isPaid: Boolean(application?.isPaid),
  });

  const boxClass = (extra = "") =>
    `agentRequestBox${compact ? " isCompact" : ""}${extra ? ` ${extra}` : ""}`;

  const withJourney = (box) =>
    compact ? (
      box
    ) : (
      <div className="agentJourney">
        <AgentUnlockPath currentStep={unlockStep} />
        {box}
      </div>
    );

  const goToPremium = () => {
    navigate("/billing?apply=1");
  };

  const handoffOverlay =
    showHandoff && handoffPreview ? (
      <div className="agentHandoff">
        <div className="agentHandoffPanel">
          <div className="handoffCard">
            <div className="handoffPath">
              <AgentUnlockPath currentStep={2} />
            </div>
            <AgentPreviewCard {...handoffPreview} />
          </div>
          <div className="handoffCopy">
            <p className="eyebrow">{t("agentUnlock.handoff.badge")}</p>
            <h2>{t("agentUnlock.handoff.title")}</h2>
            <p>{t("agentUnlock.handoff.description", { price: 20 })}</p>
            <div className="handoffActions">
              <button type="button" className="handoffPrimary" onClick={goToPremium}>
                {t("agentUnlock.handoff.continue")}
              </button>
              <button
                type="button"
                className="handoffGhost"
                onClick={() => setShowHandoff(false)}
              >
                {t("agentUnlock.handoff.later")}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  if (userRole === "ADMIN") {
    return null;
  }

  if (!currentUser) {
    return (
      <div className={boxClass()}>
        <div>
          <span>{t("agentRequest.guest.badge")}</span>
          <h2>{t("agentRequest.guest.title")}</h2>
          <p>{t("agentRequest.guest.description")}</p>
        </div>

        <Link to="/login">{t("agentRequest.guest.login")}</Link>
      </div>
    );
  }

  if (checking) {
    return (
      <div className={boxClass()}>
        <div>
          <span>{t("agentRequest.checking.badge")}</span>
          <h2>{t("agentRequest.checking.title")}</h2>
          <p>{t("agentRequest.checking.description")}</p>
        </div>
      </div>
    );
  }

  if (isAgent) {
    return withJourney(
      <div className={boxClass("verifiedBox")}>
        <div>
          <span>{t("agentRequest.verified.badge")}</span>
          <h2>{t("agentRequest.verified.title")}</h2>
          <p>{t("agentRequest.verified.description")}</p>
        </div>

        <Link to="/agent">{t("agentRequest.verified.profile")}</Link>
      </div>
    );
  }

  if (isPending) {
    const waitingReview = Boolean(application?.isPaid);

    return (
      <>
        {handoffOverlay}
        {withJourney(
          <div className={boxClass("pendingBox")}>
            <div>
              <span>{t("agentRequest.pending.badge")}</span>
              <h2>{t("agentRequest.pending.title")}</h2>
              <p>
                {waitingReview
                  ? t("agentRequest.pending.waitingReview")
                  : t("agentRequest.pending.description")}
              </p>
            </div>

            <Link to="/billing?apply=1">
              {waitingReview
                ? t("agentRequest.pending.viewBilling")
                : t("agentRequest.pending.completePayment")}
            </Link>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {handoffOverlay}
      {withJourney(
        <div className={boxClass(isRejected ? "rejectedBox" : "")}>
          <div>
            <span>
              {isRejected
                ? t("agentRequest.rejected.badge")
                : t("agentRequest.default.badge")}
            </span>

            <h2>
              {isRejected
                ? t("agentRequest.rejected.title")
                : t("agentRequest.default.title")}
            </h2>

            <p>
              {isRejected
                ? t("agentRequest.rejected.description")
                : t("agentRequest.default.description")}
            </p>

            {message && <small>{message}</small>}
            {error && <small className="requestError">{error}</small>}
          </div>

          <button type="button" onClick={openRequestForm}>
            {isRejected
              ? t("agentRequest.default.requestAgain")
              : t("agentRequest.default.becomeAgent")}
          </button>
        </div>
      )}

      {showForm && (
        <div className="agentRequestModal">
          <div className="agentRequestPanel">
            <div className="modalHeader">
              <div>
                <span>{t("agentRequest.modal.badge")}</span>
                <h2>{t("agentRequest.modal.title")}</h2>
                <p>{t("agentRequest.modal.description")}</p>
              </div>

              <button type="button" onClick={closeRequestForm}>
                ×
              </button>
            </div>

            <form onSubmit={handleRequestAgent} className="agentRequestForm">
              <div className="formGrid">
                <div className="inputGroup">
                  <label>{t("agentRequest.form.fullName")}</label>

                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={t("agentRequest.form.fullNamePlaceholder")}
                    disabled={requesting}
                  />
                </div>

                <div className="inputGroup">
                  <label>{t("agentRequest.form.agentTitle")}</label>

                  <input
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder={t("agentRequest.form.agentTitlePlaceholder")}
                    disabled={requesting}
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="agent-phone">
                    {t("agentRequest.form.phoneNumber")}
                  </label>
                  <PhoneField
                    id="agent-phone"
                    value={form.phone}
                    onChange={(phone) => {
                      setForm((prev) => ({
                        ...prev,
                        phone,
                      }));
                      clearMessages();
                    }}
                    disabled={requesting}
                    required
                  />
                </div>

                <div className="inputGroup">
                  <label>{t("agentRequest.form.location")}</label>

                  <input
                    name="location"
                    type="text"
                    value={form.location}
                    onChange={handleChange}
                    placeholder={t("agentRequest.form.locationPlaceholder")}
                    disabled={requesting}
                  />
                </div>

                <div className="inputGroup wide">
                  <label>{t("agentRequest.form.profileImage")}</label>

                  <div className="agentImageUpload">
                    <div className="agentImagePreview">
                      <img
                        src={getImageUrl(imagePreview)}
                        alt={t("agentRequest.form.agentPreview")}
                        onError={(e) => {
                          e.currentTarget.src = "/no-avatar.png";
                        }}
                      />
                    </div>

                    <div className="agentImageActions">
                      <label htmlFor="agentImage">
                        {t("agentRequest.form.uploadImage")}
                      </label>

                      {imageFile && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={requesting}
                        >
                          {t("agentRequest.form.remove")}
                        </button>
                      )}

                      <small>{t("agentRequest.form.imageInfo")}</small>
                    </div>

                    <input
                      id="agentImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={requesting}
                    />
                  </div>
                </div>

                <div className="inputGroup wide">
                  <label>{t("agentRequest.form.bio")}</label>

                  <textarea
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    placeholder={t("agentRequest.form.bioPlaceholder")}
                    disabled={requesting}
                  ></textarea>
                </div>
              </div>

              {error && <div className="modalError">{error}</div>}

              <div className="modalActions">
                <button
                  type="button"
                  className="cancelBtn"
                  onClick={closeRequestForm}
                  disabled={requesting}
                >
                  {t("agentRequest.buttons.cancel")}
                </button>

                <button type="submit" disabled={requesting}>
                  {requesting
                    ? t("agentRequest.buttons.sending")
                    : t("agentRequest.buttons.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default AgentRequestBox;