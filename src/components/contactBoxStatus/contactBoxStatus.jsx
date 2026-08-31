import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./contactBoxStatus.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function hasReply(item) {
  return Boolean(String(item?.adminReply || "").trim());
}

function getEditDeadline(item) {
  if (item?.editExpiresAt) {
    return new Date(item.editExpiresAt).getTime();
  }

  return new Date(item?.createdAt || Date.now()).getTime() + 60 * 60 * 1000;
}

function isEditable(item, now) {
  if (!item || hasReply(item)) {
    return false;
  }

  return now < getEditDeadline(item);
}

function remainingMs(item, now) {
  return Math.max(0, getEditDeadline(item) - now);
}

function ContactStatusBox({ refreshKey }) {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ subject: "", message: "" });
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const getMessages = async () => {
      if (!currentUser) {
        return;
      }

      try {
        setLoading(true);
        setActionError("");
        const res = await apiRequest.get("/contact/my-messages");
        setMessages(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.log("GET MY CONTACT MESSAGES ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    getMessages();
  }, [currentUser, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const item = messages.find((message) => message.id === editingId);

    if (item && !isEditable(item, now)) {
      setEditingId("");
      setEditForm({ subject: "", message: "" });
      setActionError(t("contactStatus.edit.windowClosed"));
    }
  }, [editingId, messages, now, t]);

  const formatDate = (date) => {
    if (!date) {
      return t("contactStatus.unknownDate");
    }

    return new Date(date).toLocaleString(
      i18n.language === "ar" ? "ar-LB" : "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };

  const getStatusLabel = (status) => {
    const value = (status || "NEW").toUpperCase();

    if (value === "OPEN") return t("contactStatus.status.new");
    if (value === "NEW") return t("contactStatus.status.new");
    if (value === "READ") return t("contactStatus.status.inReview");
    if (value === "IN_REVIEW") return t("contactStatus.status.inReview");
    if (value === "RESOLVED") return t("contactStatus.status.answered");
    if (value === "ANSWERED") return t("contactStatus.status.answered");

    return value.replace("_", " ");
  };

  const getStatusClass = (status) => {
    const value = (status || "NEW").toUpperCase();

    if (value === "OPEN" || value === "NEW") return "new";
    if (value === "READ" || value === "IN_REVIEW") return "in-review";
    if (value === "RESOLVED" || value === "ANSWERED") return "answered";

    return "new";
  };

  const getTypeLabel = (type) => {
    const value = (type || "MESSAGE").toUpperCase();

    if (value === "REPORT") {
      return t("contactStatus.type.report");
    }

    return t("contactStatus.type.message");
  };

  const clearableCount = useMemo(
    () => messages.filter((item) => hasReply(item)).length,
    [messages]
  );

  const startEdit = (item) => {
    if (!isEditable(item, now)) {
      return;
    }

    setActionError("");
    setEditingId(item.id);
    setEditForm({
      subject: item.subject || "",
      message: item.message || "",
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditForm({ subject: "", message: "" });
  };

  const handleSave = async (item) => {
    if (!item?.id || savingId || !isEditable(item, now)) {
      return;
    }

    try {
      setSavingId(item.id);
      setActionError("");

      const res = await apiRequest.put(`/contact/my-messages/${item.id}`, {
        subject: editForm.subject.trim(),
        message: editForm.message.trim(),
      });

      setMessages((prev) =>
        prev.map((message) => (message.id === item.id ? res.data : message))
      );
      cancelEdit();
    } catch (err) {
      console.log("UPDATE CONTACT MESSAGE ERROR:", err);
      setActionError(
        err.response?.data?.message || t("contactStatus.errors.updateFailed")
      );
    } finally {
      setSavingId("");
    }
  };

  const handleDelete = async (item) => {
    const messageId = item?.id;

    if (!messageId || deletingId || clearing) {
      return;
    }

    if (!hasReply(item)) {
      setActionError(t("contactStatus.errors.deleteBlocked"));
      return;
    }

    const confirmed = window.confirm(t("contactStatus.confirms.delete"));

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(messageId);
      setActionError("");
      await apiRequest.post(`/contact/my-messages/${messageId}/remove`);
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    } catch (err) {
      console.log("DELETE CONTACT MESSAGE ERROR:", err);
      setActionError(
        err.response?.data?.message || t("contactStatus.errors.deleteFailed")
      );
    } finally {
      setDeletingId("");
    }
  };

  const handleClearAll = async () => {
    if (!clearableCount || deletingId || clearing) {
      return;
    }

    const confirmed = window.confirm(t("contactStatus.confirms.clearAll"));

    if (!confirmed) {
      return;
    }

    try {
      setClearing(true);
      setActionError("");
      const res = await apiRequest.post("/contact/clear-tracking");
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
    } catch (err) {
      console.log("CLEAR CONTACT MESSAGES ERROR:", err);
      setActionError(
        err.response?.data?.message || t("contactStatus.errors.clearFailed")
      );
    } finally {
      setClearing(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="contactStatusBox">
        <div className="contactStatusHeader">
          <span>{t("contactStatus.guest.badge")}</span>
          <h2>{t("contactStatus.guest.title")}</h2>
          <p>{t("contactStatus.guest.description")}</p>
        </div>

        <button
          type="button"
          className="contactLoginTrackBtn"
          onClick={() => navigate("/login")}
        >
          {t("contactStatus.guest.button")}
        </button>
      </div>
    );
  }

  const busy = Boolean(deletingId) || Boolean(savingId) || clearing;

  return (
    <div className="contactStatusBox">
      <div className="contactStatusHeader">
        <div>
          <span>{t("contactStatus.user.badge")}</span>
          <h2>{t("contactStatus.user.title")}</h2>
          <p>{t("contactStatus.user.description")}</p>
        </div>

        {clearableCount > 0 && !loading && (
          <button
            type="button"
            className="contactClearBtn"
            onClick={handleClearAll}
            disabled={busy}
          >
            {clearing
              ? t("contactStatus.actions.clearing")
              : t("contactStatus.actions.clearAll")}
          </button>
        )}
      </div>

      {actionError && <div className="contactStatusError">{actionError}</div>}

      {loading ? (
        <div className="contactStatusState">
          {t("contactStatus.states.loading")}
        </div>
      ) : messages.length === 0 ? (
        <div className="contactStatusState">
          {t("contactStatus.states.empty")}
        </div>
      ) : (
        <div className="contactStatusList">
          {messages.map((item) => {
            const editable = isEditable(item, now);
            const deletable = hasReply(item);
            const editing = editingId === item.id;

            return (
              <div className="contactStatusCard" key={item.id}>
                <div className="statusCardTop">
                  <div>
                    <div className="statusTypeRow">
                      <span className={`statusType ${(item.type || "message").toLowerCase()}`}>
                        {getTypeLabel(item.type)}
                      </span>

                      {item.wasEdited && (
                        <span className="statusEdited">{t("contactStatus.edited")}</span>
                      )}
                    </div>

                    <h3>{item.subject}</h3>

                    <p>
                      {t("contactStatus.sentOn")} {formatDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="statusCardActions">
                    <strong className={`statusBadge ${getStatusClass(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </strong>

                    {editable && !editing && (
                      <button
                        type="button"
                        className="contactEditBtn"
                        onClick={() => startEdit(item)}
                        disabled={busy}
                      >
                        {t("contactStatus.actions.edit")}
                      </button>
                    )}

                    {deletable && (
                      <button
                        type="button"
                        className="contactDeleteBtn"
                        onClick={() => handleDelete(item)}
                        disabled={busy}
                      >
                        {deletingId === item.id
                          ? t("contactStatus.actions.deleting")
                          : t("contactStatus.actions.delete")}
                      </button>
                    )}
                  </div>
                </div>

                {editable ? (
                  <p className="statusHint">
                    {t("contactStatus.edit.windowOpen", {
                      time: formatCountdown(remainingMs(item, now)),
                    })}
                  </p>
                ) : hasReply(item) ? (
                  <p className="statusHint isLocked">
                    {t("contactStatus.edit.lockedAfterReply")}
                  </p>
                ) : (
                  <p className="statusHint isLocked">
                    {t("contactStatus.edit.windowClosed")}
                    {" "}
                    {t("contactStatus.edit.deleteHint")}
                  </p>
                )}

                {editing ? (
                  <form
                    className="contactEditForm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSave(item);
                    }}
                  >
                    <label>
                      {t("contact.form.subject")}
                      <input
                        type="text"
                        value={editForm.subject}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            subject: event.target.value,
                          }))
                        }
                        disabled={busy}
                        required
                      />
                    </label>

                    <label>
                      {t("contact.form.message")}
                      <textarea
                        value={editForm.message}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            message: event.target.value,
                          }))
                        }
                        disabled={busy}
                        required
                      />
                    </label>

                    <div className="contactEditActions">
                      <button type="submit" disabled={busy}>
                        {savingId === item.id
                          ? t("contactStatus.actions.saving")
                          : t("contactStatus.actions.save")}
                      </button>

                      <button
                        type="button"
                        className="cancelBtn"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        {t("contactStatus.actions.cancel")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="statusMessage">
                    <b>{t("contactStatus.yourMessage")}</b>
                    <p>{item.message}</p>
                  </div>
                )}

                {item.adminReply ? (
                  <div className="adminReplyBox">
                    <b>{t("contactStatus.adminReply")}</b>
                    <p>{item.adminReply}</p>
                    <span>
                      {t("contactStatus.repliedOn")}{" "}
                      {formatDate(item.adminRepliedAt)}
                    </span>
                  </div>
                ) : (
                  <div className="noReplyBox">
                    {t("contactStatus.noReply")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContactStatusBox;
