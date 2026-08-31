import { useTranslation } from "react-i18next";
import "./agentUnlock.scss";

const SERVER_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:8800/api"
).replace("/api", "");

export function getAgentImageUrl(image) {
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
}

export function saveAgentPreview(preview) {
  try {
    sessionStorage.setItem("se_agent_preview", JSON.stringify(preview));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readAgentPreview() {
  try {
    const raw = sessionStorage.getItem("se_agent_preview");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AgentUnlockPath({ currentStep = 1 }) {
  const { t } = useTranslation();
  const step = Math.min(4, Math.max(1, Number(currentStep) || 1));

  const steps = [
    { id: 1, label: t("agentUnlock.steps.profile") },
    { id: 2, label: t("agentUnlock.steps.pay") },
    { id: 3, label: t("agentUnlock.steps.review") },
    { id: 4, label: t("agentUnlock.steps.live") },
  ];

  return (
    <ol className="agentUnlockPath" aria-label={t("agentUnlock.pathLabel")}>
      {steps.map((item) => {
        const state =
          item.id < step ? "done" : item.id === step ? "current" : "todo";

        return (
          <li key={item.id} className={`unlockStep is-${state}`}>
            <span className="unlockIndex">
              {state === "done" ? "✓" : item.id}
            </span>
            <span className="unlockLabel">{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AgentPreviewCard({
  name,
  title,
  location,
  bio,
  image,
  badge,
}) {
  const { t } = useTranslation();
  const displayName = name || t("agentUnlock.card.fallbackName");
  const displayTitle = title || t("agentUnlock.card.fallbackTitle");

  return (
    <article className="agentPreviewCard">
      <span className="previewBadge">
        {badge || t("agentUnlock.card.badge")}
      </span>
      <img
        src={getAgentImageUrl(image)}
        alt={displayName}
        onError={(event) => {
          event.currentTarget.src = "/no-avatar.png";
        }}
      />
      <div>
        <small>{displayTitle}</small>
        <h3>{displayName}</h3>
        {location ? <p className="previewPlace">{location}</p> : null}
        {bio ? <p className="previewBio">{bio}</p> : null}
      </div>
    </article>
  );
}

export function getUnlockStep({ isAgent, isPending, isPaid } = {}) {
  if (isAgent) return 4;
  if (isPending && isPaid) return 3;
  if (isPending) return 2;
  return 1;
}
