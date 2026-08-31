import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./agentpage.scss";
import apiRequest from "../../lib/apiRequest";
import PageState from "../../components/pageState/pageState";
import AgentRequestBox from "../../components/agentBoxRequest/agentBoxRequest";
import { AuthContext } from "../../context/AuthContext";

function getImageUrl(image) {
  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  if (!image || typeof image !== "string") {
    return "/no-avatar.png";
  }

  if (image.startsWith("http") || image.startsWith("data:")) {
    return image;
  }

  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

function plainBio(value, fallback) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-5.1 7-12a7 7 0 0 0-14 0c0 6.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function AgentPage() {
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const isAdmin = String(currentUser?.role || "").toUpperCase() === "ADMIN";

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await apiRequest.get("/agents");
      setAgents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("LOAD AGENTS ERROR:", err);
      setError(err.response?.data?.message || t("agents.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return agents;
    }

    return agents.filter((agent) => {
      const haystack = [
        agent.name,
        agent.username,
        agent.title,
        agent.location,
        agent.agencyName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [agents, query]);

  return (
    <main className="agentPage pageFade">
      <header className="agentPageHeader">
        <div>
          <p className="agentEyebrow">{t("agents.directory.badge")}</p>
          <h1>{t("agents.directory.title")}</h1>
          <span>{t("agents.directory.description")}</span>
        </div>
        {!isAdmin && (
          <div className="agentRequestAside">
            <AgentRequestBox compact />
          </div>
        )}
      </header>

      {loading ? (
        <section className="agentStateWrapper">
          <PageState
            type="loading"
            title={t("agents.states.loadingTitle")}
            message={t("agents.states.loadingMessage")}
          />
        </section>
      ) : error ? (
        <section className="agentStateWrapper">
          <PageState
            type="error"
            title={t("agents.states.errorTitle")}
            message={error}
            buttonText={t("agents.states.tryAgain")}
            onClick={() => fetchAgents()}
          />
        </section>
      ) : agents.length === 0 ? (
        <section className="agentStateWrapper">
          <PageState
            type="empty"
            title={t("agents.states.emptyTitle")}
            message={t("agents.states.emptyMessage")}
          />
        </section>
      ) : (
        <section className="agentDirectory">
          <div className="agentToolbar">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("agents.directory.searchPlaceholder")}
              aria-label={t("agents.directory.searchPlaceholder")}
            />
            <p>
              {t("agents.directory.count", {
                shown: filteredAgents.length,
                total: agents.length,
              })}
            </p>
          </div>

          {filteredAgents.length === 0 ? (
            <PageState
              type="empty"
              title={t("agents.states.emptyTitle")}
              message={t("agents.directory.noMatch")}
            />
          ) : (
            <div className="agentGrid">
              {filteredAgents.map((agent) => {
                const agentId = agent.id || agent._id;
                const agentName =
                  agent.name || agent.username || t("agents.card.defaultName");
                const agentTitle =
                  agent.title || t("agents.card.defaultTitle");
                const agentImage = getImageUrl(agent.image || agent.avatar);
                const agentListings =
                  Number(agent.properties || agent.posts?.length || 0) || 0;
                const agentAgency = String(agent.agencyName || "").trim();

                return (
                  <Link
                    to={`/agents/${agentId}`}
                    className="agentCard"
                    key={agentId}
                  >
                    <div className="agentCardMedia">
                      <img
                        src={agentImage}
                        alt={agentName}
                        onError={(event) => {
                          event.currentTarget.src = "/no-avatar.png";
                        }}
                      />
                      <span>{t("agents.card.verified")}</span>
                    </div>

                    <div className="agentCardBody">
                      <h3>{agentName}</h3>
                      <p>{agentTitle}</p>
                      {agentAgency ? <em>{agentAgency}</em> : null}
                      {agent.location ? (
                        <small>
                          <PinIcon />
                          <span>{agent.location}</span>
                        </small>
                      ) : null}
                      <span className="agentDescription">
                        {plainBio(agent.bio, t("agents.card.defaultBio"))}
                      </span>
                    </div>

                    <div className="agentCardFoot">
                      <b>
                        {t("agents.card.listingsCount", {
                          count: agentListings,
                        })}
                      </b>
                      <em>{t("agents.card.viewProfile")}</em>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default AgentPage;
