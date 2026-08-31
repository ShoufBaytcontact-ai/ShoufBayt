import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./adminAgentRequests.scss";
import apiRequest from "../../lib/apiRequest";

const CLEARED_AGENT_REQUESTS_KEY = "shoufbayt_cleared_agent_requests";

function getServerUrl() {
  return (process.env.REACT_APP_API_URL || "http://localhost:8800/api").replace(
    "/api",
    ""
  );
}

function getImageUrl(image, fallback = "/no-avatar.png") {
  if (!image || typeof image !== "string") {
    return fallback;
  }

  if (image.startsWith("http") || image.startsWith("data:")) {
    return image;
  }

  const serverUrl = getServerUrl();

  return `${serverUrl}${image.startsWith("/") ? "" : "/"}${image}`;
}

function AdminAgentRequests({ onRequestUpdated }) {
  const { t } = useTranslation();

  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [clearedIds, setClearedIds] = useState(() => {
    try {
      const stored =
        localStorage.getItem(CLEARED_AGENT_REQUESTS_KEY) ||
        localStorage.getItem("smartestate_cleared_agent_requests");
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      return [];
    }
  });

  const saveClearedIds = (ids) => {
    setClearedIds(ids);
    localStorage.setItem(CLEARED_AGENT_REQUESTS_KEY, JSON.stringify(ids));
  };

  const getRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const url =
        filter === "ALL"
          ? "/admin/agent-requests"
          : `/admin/agent-requests?status=${filter}`;

      const res = await apiRequest.get(url);

      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("GET AGENT REQUESTS ERROR:", err);
      setError(
        err.response?.data?.message || t("adminAgentRequests.errors.loadFailed")
      );
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    getRequests();
  }, [getRequests]);

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => !clearedIds.includes(request.id));
  }, [requests, clearedIds]);

  const requestStats = useMemo(() => {
    return {
      total: visibleRequests.length,
      pending: visibleRequests.filter(
        (item) => (item.status || "PENDING").toUpperCase() === "PENDING"
      ).length,
      approved: visibleRequests.filter(
        (item) => (item.status || "").toUpperCase() === "APPROVED"
      ).length,
      rejected: visibleRequests.filter(
        (item) => (item.status || "").toUpperCase() === "REJECTED"
      ).length,
    };
  }, [visibleRequests]);

  const processedRequests = useMemo(() => {
    return requests.filter((request) => {
      const status = (request.status || "PENDING").toUpperCase();
      return status === "APPROVED" || status === "REJECTED";
    });
  }, [requests]);

  const refreshEverything = async () => {
    await getRequests();

    if (onRequestUpdated) {
      await onRequestUpdated();
    }
  };

  const handleApprove = async (request) => {
    const agentName =
      request.name || request.user?.username || t("adminAgentRequests.fallback.thisUser");
    const isPaid =
      request.isPaid ||
      String(request.paymentStatus || request.latestPayment?.status || "").toUpperCase() ===
        "SUCCESS";

    if (!isPaid) {
      alert(t("adminAgentRequests.errors.paymentRequired"));
      return;
    }

    const confirmApprove = window.confirm(
      t("adminAgentRequests.confirms.approve", { name: agentName })
    );

    if (!confirmApprove) {
      return;
    }

    try {
      setActionLoading(request.id);

      const res = await apiRequest.put(`/admin/agent-requests/${request.id}/approve`, {
        adminNote: t("adminAgentRequests.notes.approvedByAdmin"),
      });

      await refreshEverything();

      alert(
        res.data?.emailSent
          ? t("adminAgentRequests.success.approvedEmailSent")
          : t("adminAgentRequests.success.approvedEmailNotSent")
      );
    } catch (err) {
      console.log("APPROVE REQUEST ERROR:", err);
      alert(
        err.response?.data?.message ||
          t("adminAgentRequests.errors.approveFailed")
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleReject = async (request) => {
    const agentName =
      request.name || request.user?.username || t("adminAgentRequests.fallback.thisUser");

    const adminNote = window.prompt(
      t("adminAgentRequests.prompts.rejectReason", { name: agentName })
    );

    if (adminNote === null) {
      return;
    }

    const finalNote =
      adminNote.trim() || t("adminAgentRequests.notes.rejectedByAdmin");

    try {
      setActionLoading(request.id);

      const res = await apiRequest.put(`/admin/agent-requests/${request.id}/reject`, {
        adminNote: finalNote,
      });

      await refreshEverything();

      alert(
        res.data?.emailSent
          ? t("adminAgentRequests.success.rejectedEmailSent")
          : t("adminAgentRequests.success.rejectedEmailNotSent")
      );
    } catch (err) {
      console.log("REJECT REQUEST ERROR:", err);
      alert(
        err.response?.data?.message ||
          t("adminAgentRequests.errors.rejectFailed")
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleClearProcessed = () => {
    if (processedRequests.length === 0) {
      alert(t("adminAgentRequests.alerts.noProcessed"));
      return;
    }

    const confirmClear = window.confirm(
      t("adminAgentRequests.confirms.clearProcessed")
    );

    if (!confirmClear) {
      return;
    }

    const processedIds = processedRequests.map((request) => request.id);
    const nextIds = [...new Set([...clearedIds, ...processedIds])];

    saveClearedIds(nextIds);
  };

  const handleRestoreCleared = () => {
    const confirmRestore = window.confirm(
      t("adminAgentRequests.confirms.restoreCleared")
    );

    if (!confirmRestore) {
      return;
    }

    saveClearedIds([]);
  };

  const getRequestImage = (request) => {
    return getImageUrl(request.image || request.user?.avatar);
  };

  const getFilterLabel = (item) => {
    return t(`adminAgentRequests.filters.${item.toLowerCase()}`, {
      defaultValue: item,
    });
  };

  const getPaymentStatus = (request) => {
    return String(
      request.paymentStatus || request.latestPayment?.status || "UNPAID"
    ).toUpperCase();
  };

  const getPaymentLabel = (status) => {
    const value = (status || "UNPAID").toUpperCase();

    if (value === "SUCCESS") {
      return t("adminAgentRequests.status.paid", { defaultValue: "PAID" });
    }

    if (value === "PENDING") {
      return t("adminAgentRequests.status.paymentPending", {
        defaultValue: "PAYMENT PENDING",
      });
    }

    if (value === "FAILED") {
      return t("adminAgentRequests.status.failed", { defaultValue: "FAILED" });
    }

    return t("adminAgentRequests.status.unpaid", { defaultValue: "UNPAID" });
  };

  const getStatusLabel = (status) => {
    const value = (status || "PENDING").toUpperCase();

    return t(`adminAgentRequests.status.${value.toLowerCase()}`, {
      defaultValue: value,
    });
  };

  return (
    <section className="adminAgentRequests">
      <div className="adminAgentHeader">
        <div>
          <span>{t("adminAgentRequests.header.badge")}</span>

          <h2>{t("adminAgentRequests.header.title")}</h2>

          <p>{t("adminAgentRequests.header.description")}</p>
        </div>

        <div className="adminAgentCount">
          <strong>{requestStats.total}</strong>
          <small>{t("adminAgentRequests.stats.total")}</small>
        </div>
      </div>

      <div className="agentRequestStats">
        <div>
          <strong>{requestStats.pending}</strong>
          <span>{t("adminAgentRequests.stats.pending")}</span>
        </div>

        <div>
          <strong>{requestStats.approved}</strong>
          <span>{t("adminAgentRequests.stats.approved")}</span>
        </div>

        <div>
          <strong>{requestStats.rejected}</strong>
          <span>{t("adminAgentRequests.stats.rejected")}</span>
        </div>
      </div>

      <div className="agentRequestFilters">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {getFilterLabel(item)}
          </button>
        ))}

        <button
          type="button"
          className="clearRequestsBtn"
          onClick={handleClearProcessed}
        >
          {t("adminAgentRequests.buttons.clearProcessed")}
        </button>

        {clearedIds.length > 0 && (
          <button
            type="button"
            className="restoreRequestsBtn"
            onClick={handleRestoreCleared}
          >
            {t("adminAgentRequests.buttons.restoreCleared")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="adminAgentState">
          {t("adminAgentRequests.states.loading")}
        </div>
      ) : error ? (
        <div className="adminAgentState errorState">
          <p>{error}</p>

          <button type="button" onClick={getRequests}>
            {t("adminAgentRequests.buttons.tryAgain")}
          </button>
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="adminAgentState">
          {t("adminAgentRequests.states.empty")}
        </div>
      ) : (
        <div className="requestTable">
          {visibleRequests.map((request) => {
            const status = (request.status || "PENDING").toUpperCase();
            const isPending = status === "PENDING";
            const isWorking = actionLoading === request.id;
            const paymentStatus = getPaymentStatus(request);
            const isPaid =
              request.isPaid || paymentStatus === "SUCCESS";
            const displayName =
              request.name ||
              request.fullName ||
              request.user?.username ||
              t("adminAgentRequests.fallback.unknownAgent");

            return (
              <div className="requestRow" key={request.id}>
                <div className="requestUser">
                  <img
                    src={getRequestImage(request)}
                    alt={displayName}
                    onError={(e) => {
                      e.currentTarget.src = "/no-avatar.png";
                    }}
                  />

                  <div>
                    <h3>{displayName}</h3>
                    <p>
                      {request.user?.email ||
                        request.email ||
                        t("adminAgentRequests.fallback.noEmail")}
                    </p>
                    <small>
                      @{request.user?.username || t("adminAgentRequests.fallback.unknown")}
                    </small>
                  </div>
                </div>

                <div className="requestInfo">
                  <div>
                    <span>{t("adminAgentRequests.labels.title")}</span>
                    <b>{request.title || t("adminAgentRequests.fallback.noTitle")}</b>
                  </div>

                  <div>
                    <span>{t("adminAgentRequests.labels.phone")}</span>
                    <b>{request.phone || t("adminAgentRequests.fallback.noPhone")}</b>
                  </div>

                  <div>
                    <span>{t("adminAgentRequests.labels.location")}</span>
                    <b>
                      {request.location ||
                        t("adminAgentRequests.fallback.noLocation")}
                    </b>
                  </div>

                  <div>
                    <span>{t("adminAgentRequests.labels.payment")}</span>
                    <b className={`paymentBadge ${paymentStatus.toLowerCase()}`}>
                      {getPaymentLabel(paymentStatus)}
                    </b>
                  </div>
                </div>

                <div className="requestBio">
                  <span>{t("adminAgentRequests.labels.bio")}</span>

                  <p>
                    {request.bio || t("adminAgentRequests.fallback.noBio")}
                  </p>

                  {request.message && (
                    <>
                      <span>{t("adminAgentRequests.labels.message")}</span>
                      <p>{request.message}</p>
                    </>
                  )}

                  {request.adminNote && (
                    <>
                      <span>{t("adminAgentRequests.labels.adminNote")}</span>
                      <p>{request.adminNote}</p>
                    </>
                  )}
                </div>

                <div className={`requestStatus ${status.toLowerCase()}`}>
                  {getStatusLabel(status)}
                </div>

                <div className="requestActions">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        disabled={isWorking || !isPaid}
                        title={
                          isPaid
                            ? undefined
                            : t("adminAgentRequests.errors.paymentRequired")
                        }
                        onClick={() => handleApprove(request)}
                      >
                        {isWorking
                          ? t("adminAgentRequests.buttons.working")
                          : isPaid
                            ? t("adminAgentRequests.buttons.approve")
                            : t("adminAgentRequests.buttons.waitForPayment")}
                      </button>

                      <button
                        type="button"
                        disabled={isWorking}
                        className="rejectBtn"
                        onClick={() => handleReject(request)}
                      >
                        {isWorking
                          ? t("adminAgentRequests.buttons.working")
                          : t("adminAgentRequests.buttons.reject")}
                      </button>
                    </>
                  ) : (
                    <span>{t("adminAgentRequests.status.processed")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdminAgentRequests;