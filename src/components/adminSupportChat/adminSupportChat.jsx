import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import apiRequest from "../../lib/apiRequest";
import "./adminSupportChat.scss";

function getId(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
}

function messageId(message) {
  return getId(message?.id || message?._id);
}

function sameMessage(left, right) {
  const leftId = messageId(left);
  const rightId = messageId(right);

  if (leftId && rightId) {
    return leftId === rightId;
  }

  return (
    getId(left?.senderId || left?.userId) ===
      getId(right?.senderId || right?.userId) &&
    String(left?.text || "") === String(right?.text || "") &&
    Math.abs(
      new Date(left?.createdAt || 0).getTime() -
        new Date(right?.createdAt || 0).getTime()
    ) < 8000
  );
}

function appendUniqueMessage(messages, incoming) {
  const list = Array.isArray(messages) ? messages : [];
  if (!incoming) return list;
  if (list.some((item) => sameMessage(item, incoming))) {
    return list;
  }
  return [...list, incoming];
}

function AdminSupportChat() {
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const userId = getId(currentUser);

  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const sendingLock = useRef(false);

  const messages = Array.isArray(thread?.messages) ? thread.messages : [];

  const loadList = async () => {
    const res = await apiRequest.get("/admin/support-chats");
    setChats(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadList()
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || t("admin.liveChat.error"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!activeId) {
      setThread(null);
      return undefined;
    }

    let cancelled = false;
    apiRequest
      .get(`/admin/support-chats/${activeId}`)
      .then((res) => {
        if (!cancelled) setThread(res.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || t("admin.liveChat.error"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, t]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, activeId]);

  useEffect(() => {
    if (!socket) return undefined;

    const onMessage = (payload) => {
      const chatId = getId(payload?.chatId);
      if (!chatId) return;

      setChats((prev) => {
        const exists = prev.some((item) => getId(item.id) === chatId);
        if (!exists) {
          loadList().catch(() => {});
          return prev;
        }
        return prev
          .map((item) =>
            getId(item.id) === chatId
              ? {
                  ...item,
                  lastMessage: payload.text || item.lastMessage,
                  lastMessageAt: payload.createdAt || item.lastMessageAt,
                }
              : item
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
          );
      });

      setThread((prev) => {
        if (!prev || getId(prev.id) !== chatId) return prev;
        return {
          ...prev,
          messages: appendUniqueMessage(prev.messages, payload),
        };
      });
    };

    socket.on("getMessage", onMessage);
    return () => socket.off("getMessage", onMessage);
  }, [socket]);

  const visitorName = useMemo(() => {
    const visitor = thread?.visitor || thread?.receiver;
    return visitor?.username || visitor?.email || t("admin.fallback.user");
  }, [thread, t]);

  const send = async (event) => {
    event.preventDefault();
    const next = text.trim();
    if (!next || !activeId || sending || sendingLock.current) return;

    sendingLock.current = true;
    try {
      setSending(true);
      const res = await apiRequest.post("/messages", {
        chatId: activeId,
        text: next,
      });
      setText("");
      setThread((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: appendUniqueMessage(prev.messages, res.data),
        };
      });
    } catch (err) {
      setError(err.response?.data?.message || t("admin.liveChat.error"));
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  return (
    <section className="adminSection adminLiveChat">
      <div className="sectionHeader">
        <div>
          <span>{t("admin.liveChat.badge")}</span>
          <h2>{t("admin.liveChat.title")}</h2>
          <p>{t("admin.liveChat.description")}</p>
        </div>
      </div>

      {error ? <p className="adminLiveError">{error}</p> : null}

      <div className="adminLiveGrid">
        <aside className="adminLiveList">
          {loading ? (
            <p>{t("admin.liveChat.loading")}</p>
          ) : chats.length === 0 ? (
            <p>{t("admin.liveChat.empty")}</p>
          ) : (
            chats.map((item) => {
              const visitor = item.visitor || item.receiver;
              const id = getId(item.id);
              return (
                <button
                  type="button"
                  key={id}
                  className={id === activeId ? "isActive" : ""}
                  onClick={() => setActiveId(id)}
                >
                  <strong>
                    {visitor?.username || visitor?.email || t("admin.fallback.user")}
                  </strong>
                  <small>{item.lastMessage || t("admin.liveChat.noMessage")}</small>
                </button>
              );
            })
          )}
        </aside>

        <div className="adminLiveThread">
          {!activeId ? (
            <p className="adminLiveHint">{t("admin.liveChat.pick")}</p>
          ) : (
            <>
              <header>
                <strong>{visitorName}</strong>
              </header>
              <div className="adminLiveMessages" ref={listRef}>
                {messages.map((message) => {
                  const mine =
                    getId(message.senderId || message.userId) === userId;
                  return (
                    <div
                      key={getId(message.id || message._id)}
                      className={mine ? "adminLiveBubble own" : "adminLiveBubble"}
                    >
                      {message.text || ""}
                    </div>
                  );
                })}
              </div>
              <form onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("admin.liveChat.placeholder")}
                  maxLength={2000}
                />
                <button type="submit" disabled={sending || !text.trim()}>
                  {t("admin.buttons.sendReply")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminSupportChat;
