import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import { notificationApi } from "../../lib/services";
import { useNotificationStore } from "../../lib/notificationStore";
import {
  countUnreadAlerts,
  formatRelativeTime,
  isMessageType,
  isUnread,
  parseNotificationList,
  resolveNotificationLink,
} from "../../lib/notificationMeta";
import "./notificationBell.scss";

function panelStyleFromTrigger(trigger) {
  if (!trigger) {
    return null;
  }

  const rect = trigger.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 32);
  const rtl = document.documentElement.getAttribute("dir") === "rtl";
  const top = rect.bottom + 10;
  let left = rtl ? rect.left : rect.right - width;
  left = Math.min(Math.max(16, left), window.innerWidth - width - 16);

  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
  };
}

function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useContext(AuthContext);
  const socket = useContext(SocketContext)?.socket;
  const fetchBadge = useNotificationStore((state) => state.fetch);
  const setNumber = useNotificationStore((state) => state.setNumber);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [panelStyle, setPanelStyle] = useState(null);
  const boxRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const toastTimers = useRef(new Map());

  const language = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const unread = items.filter((item) => isUnread(item)).length;

  const loadPreview = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.list();
      const list = parseNotificationList(res.data);
      const alerts = list.filter((item) => !isMessageType(item.type));
      setItems(alerts.slice(0, 6));
      setNumber(countUnreadAlerts(list));
      await fetchBadge();
    } catch {
      setItems([]);
      setNumber(0);
    } finally {
      setLoading(false);
    }
  };

  const syncPanelPosition = () => {
    setPanelStyle(panelStyleFromTrigger(triggerRef.current));
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setItems([]);
      setToasts([]);
      setOpen(false);
      return undefined;
    }

    loadPreview();
    return undefined;
  }, [currentUser?.id]);

  useEffect(() => {
    if (!socket || !currentUser?.id) {
      return undefined;
    }

    const onNotification = (payload) => {
      const targetId = String(payload?.userId || payload?.receiverId || "");
      const myId = String(currentUser.id || "");
      if (targetId && myId && targetId !== myId) {
        return;
      }

      const next = {
        id: payload?.id || `live-${Date.now()}`,
        type: payload?.type || "GENERAL",
        title: payload?.title || t("notificationsPage.inbox.newAlert"),
        message: payload?.message || "",
        link: payload?.link || "",
        createdAt: payload?.createdAt || new Date().toISOString(),
        isRead: false,
      };

      fetchBadge();

      if (isMessageType(next.type)) {
        return;
      }

      setItems((prev) =>
        [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 6)
      );

      if (location.pathname !== "/notifications") {
        setToasts((prev) =>
          [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 3)
        );
      }
    };

    socket.on("getNotification", onNotification);
    return () => socket.off("getNotification", onNotification);
  }, [socket, currentUser?.id, fetchBadge, location.pathname, t]);

  useEffect(() => {
    toasts.forEach((toast) => {
      if (toastTimers.current.has(toast.id)) {
        return;
      }

      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
        toastTimers.current.delete(toast.id);
      }, 5600);

      toastTimers.current.set(toast.id, timer);
    });

    const liveIds = new Set(toasts.map((toast) => toast.id));
    toastTimers.current.forEach((timer, id) => {
      if (!liveIds.has(id)) {
        window.clearTimeout(timer);
        toastTimers.current.delete(id);
      }
    });
  }, [toasts]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => window.clearTimeout(timer));
      toastTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    syncPanelPosition();

    const onReposition = () => syncPanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, language]);

  useEffect(() => {
    const onPointer = (event) => {
      const target = event.target;
      if (boxRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setToasts([]);
      }
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      syncPanelPosition();
      await loadPreview();
    }
  };

  const openItem = async (item) => {
    const path = resolveNotificationLink(item?.link) || "/notifications";
    if (item?.id && isUnread(item)) {
      try {
        await notificationApi.markRead(item.id);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, isRead: true } : row
          )
        );
        await fetchBadge();
      } catch {
        /* keep navigating even if mark-read fails */
      }
    }
    setOpen(false);
    setToasts((prev) => prev.filter((toast) => toast.id !== item?.id));
    navigate(path);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      await fetchBadge();
    } catch {
      /* ignore */
    }
  };

  if (!currentUser) {
    return null;
  }

  const dropdown =
    open && panelStyle
      ? createPortal(
        <div
          className="nbPanel"
          ref={panelRef}
          style={panelStyle || undefined}
          role="dialog"
          aria-label={t("notificationsPage.inbox.title")}
        >
          <div className="nbPanelHeader">
            <h3>{t("notificationsPage.inbox.title")}</h3>
            <button type="button" onClick={markAll} disabled={unread === 0}>
              {t("notificationsPage.actions.markAll")}
            </button>
          </div>

          {loading ? (
            <div className="nbEmpty">{t("notificationsPage.states.loading")}</div>
          ) : items.length === 0 ? (
            <div className="nbEmpty">{t("notificationsPage.inbox.empty")}</div>
          ) : (
            items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={isUnread(item) ? "nbRow unread" : "nbRow"}
                onClick={() => openItem(item)}
              >
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <span>{formatRelativeTime(item.createdAt, language)}</span>
              </button>
            ))
          )}

          <Link
            to="/notifications"
            className="nbFooter"
            onClick={() => setOpen(false)}
          >
            {t("notificationsPage.inbox.viewAll")}
          </Link>
        </div>,
        document.body
      )
    : null;

  const toastStack =
    toasts.length > 0
      ? createPortal(
          <div className="nbToastStack">
            {toasts.map((toast) => (
              <button
                type="button"
                className="nbToast"
                key={toast.id}
                onClick={() => openItem({ ...toast, isRead: false })}
              >
                <strong>{toast.title}</strong>
                <p>{toast.message}</p>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="notificationBell" ref={boxRef}>
      <button
        type="button"
        ref={triggerRef}
        className={open ? "nbTrigger isOpen" : "nbTrigger"}
        onClick={openPanel}
        aria-label={t("notificationsPage.inbox.title")}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.8a6.2 6.2 0 0 1 6.2 6.2v3.2l1.7 2.6H4.1l1.7-2.6V10A6.2 6.2 0 0 1 12 3.8zm0 16.4a2.5 2.5 0 0 1-2.4-2h4.8a2.5 2.5 0 0 1-2.4 2z" />
        </svg>
        {unread > 0 && <em>{unread > 9 ? "9+" : unread}</em>}
      </button>

      {dropdown}
      {toastStack}
    </div>
  );
}

export default NotificationBell;
