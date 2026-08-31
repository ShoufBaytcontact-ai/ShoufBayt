import { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import apiRequest from "../../lib/apiRequest";
import "./supportChat.scss";

function getId(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
}

function SupportChat() {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const sendingLock = useRef(false);

  const role = String(currentUser?.role || "").toUpperCase();
  const userId = getId(currentUser);
  const hidden =
    role === "ADMIN" || location.pathname.startsWith("/chat");

  const messages = Array.isArray(chat?.messages) ? chat.messages : [];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("support") === "1" && !hidden) {
      setOpen(true);
    }
  }, [location.search, hidden]);

  useEffect(() => {
    if (!open || !userId || hidden) {
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    apiRequest
      .post("/chats/support")
      .then((res) => {
        if (!cancelled) {
          setChat(res.data || null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err.response?.data?.message || t("supportChat.error")
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId, hidden, t]);

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length, open]);

  useEffect(() => {
    if (!socket || !chat?.id || hidden) {
      return undefined;
    }

    const onMessage = (payload) => {
      const incomingChatId = getId(payload?.chatId);
      if (incomingChatId !== getId(chat.id)) {
        return;
      }

      setChat((prev) => {
        if (!prev) return prev;
        const nextId = getId(payload?.id || payload?._id);
        const exists = (prev.messages || []).some(
          (item) => getId(item.id || item._id) === nextId
        );
        if (exists) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), payload],
        };
      });
    };

    socket.on("getMessage", onMessage);
    return () => socket.off("getMessage", onMessage);
  }, [socket, chat?.id, hidden]);

  const send = async (event) => {
    event.preventDefault();
    const next = text.trim();
    if (!next || !chat?.id || sending || sendingLock.current) {
      return;
    }

    sendingLock.current = true;
    try {
      setSending(true);
      const res = await apiRequest.post("/messages", {
        chatId: chat.id,
        text: next,
      });
      setText("");
      setChat((prev) => {
        if (!prev) return prev;
        const nextId = getId(res.data?.id);
        const exists = (prev.messages || []).some(
          (item) => getId(item.id) === nextId
        );
        if (exists) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), res.data],
        };
      });
    } catch (err) {
      setError(err.response?.data?.message || t("supportChat.error"));
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <div className={open ? "supportChat isOpen" : "supportChat"}>
      {open ? (
        <div className="supportPanel">
          <header className="supportHead">
            <div>
              <strong>{t("supportChat.title")}</strong>
              <small>{t("supportChat.subtitle")}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          {!currentUser ? (
            <div className="supportGuest">
              <p>{t("supportChat.signIn")}</p>
              <Link to="/login">{t("nav.login")}</Link>
            </div>
          ) : (
            <>
              <div className="supportList" ref={listRef}>
                {loading ? (
                  <p className="supportHint">{t("supportChat.loading")}</p>
                ) : error ? (
                  <p className="supportHint">{error}</p>
                ) : messages.length === 0 ? (
                  <p className="supportHint">{t("supportChat.empty")}</p>
                ) : (
                  messages.map((message) => {
                    const mine = getId(message.senderId || message.userId) === userId;
                    return (
                      <div
                        key={getId(message.id || message._id)}
                        className={mine ? "supportBubble own" : "supportBubble"}
                      >
                        {message.text || ""}
                      </div>
                    );
                  })
                )}
              </div>

              <form className="supportForm" onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("supportChat.placeholder")}
                  maxLength={2000}
                />
                <button type="submit" disabled={sending || !text.trim()}>
                  {t("supportChat.send")}
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="supportFab"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("supportChat.title")}
      >
        {open ? "×" : t("supportChat.fab")}
      </button>
    </div>
  );
}

export default SupportChat;
