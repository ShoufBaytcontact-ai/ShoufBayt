import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./profilepage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";

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

function getRoleKey(role) {
  const value = String(role || "USER").toUpperCase();
  if (value === "ADMIN") return "admin";
  if (value === "AGENT") return "agent";
  return "owner";
}

function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, updateUser } = useContext(AuthContext);

  const userName = currentUser?.username || t("profile.fallback.user");
  const userEmail = currentUser?.email || t("profile.fallback.noEmail");
  const userAvatar = getImageUrl(currentUser?.avatar);
  const roleKey = getRoleKey(currentUser?.role);
  const canSeeBilling = Boolean(currentUser);

  const handleLogout = async () => {
    try {
      await apiRequest.post("/auth/logout");
    } catch (err) {
      console.log("LOGOUT ERROR:", err);
    } finally {
      updateUser(null);
      navigate("/login", { replace: true });
    }
  };

  if (!currentUser) {
    return (
      <main className="profilePage pageFade">
        <div className="profileStateBox">
          <span></span>
          <h2>{t("profile.loading.title")}</h2>
          <p>{t("profile.loading.message")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="profilePage pageFade">
      <section className="profileCard">
        <div className="profilePhoto">
          <img
            src={userAvatar}
            alt={userName}
            onError={(e) => {
              e.currentTarget.src = "/no-avatar.png";
            }}
          />
        </div>

        <p className="profileEyebrow">{t(`profile.role.${roleKey}`)}</p>
        <h1>{userName}</h1>
        <p className="profileEmail">{userEmail}</p>
        {currentUser?.phone || currentUser?.agentProfile?.phone ? (
          <p className="profileEmail">
            {currentUser.phone || currentUser.agentProfile.phone}
          </p>
        ) : null}

        {canSeeBilling && (
          <dl className="profileRows">
            <div>
              <dt>{t("nav.billing")}</dt>
              <dd>
                <Link to="/billing">{t("profile.fields.manageBilling")}</Link>
              </dd>
            </div>
          </dl>
        )}

        <div className="profileActions">
          <Link to="/profile/update" className="editBtn">
            {t("profile.hero.updateProfile")}
          </Link>
          {roleKey === "agent" && (
            <Link to="/agent?tab=profile" className="agentCardBtn">
              {t("profile.hero.editAgentCard")}
            </Link>
          )}
          <button type="button" onClick={handleLogout} className="logoutBtn">
            {t("profile.hero.logout")}
          </button>
        </div>
      </section>
    </main>
  );
}

export default ProfilePage;
