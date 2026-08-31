import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { notificationApi } from "../../lib/services";
import { useNotificationStore } from "../../lib/notificationStore";
import {
  formatRelativeTime,
  getTypeTone,
  groupByDay,
  isMessageType,
  isUnread,
  resolveNotificationLink,
} from "../../lib/notificationMeta";
import "./notificationsPage.scss";

function parseList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notifications)) return data.notifications;
  return [];
}

function TypeMark({ tone = "neutral" }) {
  return <span className={`noticeMark tone-${tone}`} aria-hidden="true" />;
}

function NotificationsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const fetchBadge = useNotificationStore((state) => state.fetch);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const language = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await notificationApi.list();
      setItems(parseList(res.data));
      await fetchBadge();
    } catch (err) {
      setError(
        err.response?.data?.message || t("notificationsPage.errors.load")
      );
    } finally {
      setLoading(false);
    }
  }, [fetchBadge, t]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    load();
  }, [currentUser, navigate, load]);

  const unreadCount = useMemo(
    () => items.filter((item) => isUnread(item)).length,
    [items]
  );

  const visibleItems = useMemo(() => {
    if (filter === "unread") {
      return items.filter((item) => isUnread(item));
    }
    if (filter === "messages") {
      return items.filter((item) => isMessageType(item.type));
    }
    if (filter === "account") {
      return items.filter((item) => !isMessageType(item.type));
    }
    return items;
  }, [filter, items]);

  const grouped = useMemo(() => {
    const buckets = { today: [], yesterday: [], earlier: [] };
    visibleItems.forEach((item) => {
      buckets[groupByDay(item.createdAt)].push(item);
    });
    return buckets;
  }, [visibleItems]);

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      await fetchBadge();
    } catch (err) {
      setError(
        err.response?.data?.message || t("notificationsPage.errors.markAll")
      );
    }
  };

  const markOne = async (id) => {
    if (!id) return;
    try {
      await notificationApi.markRead(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isRead: true } : item
        )
      );
      await fetchBadge();
    } catch (err) {
      setError(
        err.response?.data?.message || t("notificationsPage.errors.update")
      );
    }
  };

  const removeOne = async (id) => {
    if (!id) return;
    try {
      await notificationApi.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      await fetchBadge();
    } catch (err) {
      setError(
        err.response?.data?.message || t("notificationsPage.errors.delete")
      );
    }
  };

  const removeAll = async () => {
    if (!items.length) return;
    try {
      setDeletingAll(true);
      setError("");
      await notificationApi.removeAll();
      setItems([]);
      setConfirmDeleteAll(false);
      await fetchBadge();
    } catch (err) {
      setError(
        err.response?.data?.message || t("notificationsPage.errors.deleteAll")
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const openItem = async (item) => {
    const path = resolveNotificationLink(item.link);
    if (isUnread(item)) {
      await markOne(item.id);
    }
    if (path) {
      navigate(path);
    }
  };

  const renderGroup = (key, list) => {
    if (!list.length) return null;
    return (
      <section key={key} className="noticeGroup">
        <h2>{t(`notificationsPage.groups.${key}`)}</h2>
        <div className="notificationsList">
          {list.map((item) => {
            const unread = isUnread(item);
            const path = resolveNotificationLink(item.link);
            return (
              <article
                key={item.id}
                className={unread ? "notificationCard unread" : "notificationCard"}
              >
                <button
                  type="button"
                  className="noticeMain"
                  onClick={() => openItem(item)}
                >
                  <TypeMark tone={getTypeTone(item.type)} />
                  <div>
                    <span className="type">
                      {t(`notificationsPage.types.${String(item.type || "GENERAL").toUpperCase()}`, {
                        defaultValue: t("notificationsPage.types.GENERAL"),
                      })}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.message}</p>
                    <small>{formatRelativeTime(item.createdAt, language)}</small>
                  </div>
                </button>

                <div className="cardActions">
                  {path && (
                    <Link
                      to={path}
                      className="ghostBtn"
                      onClick={() => {
                        if (unread) markOne(item.id);
                      }}
                    >
                      {t("notificationsPage.actions.open")}
                    </Link>
                  )}
                  {unread && (
                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => markOne(item.id)}
                    >
                      {t("notificationsPage.actions.markRead")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghostBtn danger"
                    onClick={() => removeOne(item.id)}
                  >
                    {t("notificationsPage.actions.delete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  if (!currentUser) return null;

  return (
    <main className="notificationsPage pageFade">
      <header className="notificationsHero">
        <div>
          <p className="notificationsEyebrow">
            {t("notificationsPage.hero.badge")}
          </p>
          <h1>{t("notificationsPage.hero.title")}</h1>
          <p>{t("notificationsPage.hero.description")}</p>
        </div>

        <div className="headerActions">
          <button
            type="button"
            className="ghostBtn"
            onClick={markAll}
            disabled={unreadCount === 0}
          >
            {t("notificationsPage.actions.markAll")}
          </button>
          {confirmDeleteAll ? (
            <>
              <button
                type="button"
                className="ghostBtn danger"
                onClick={removeAll}
                disabled={deletingAll || items.length === 0}
              >
                {deletingAll
                  ? t("notificationsPage.states.deletingAll")
                  : t("notificationsPage.actions.confirmDeleteAll")}
              </button>
              <button
                type="button"
                className="ghostBtn"
                onClick={() => setConfirmDeleteAll(false)}
                disabled={deletingAll}
              >
                {t("notificationsPage.actions.cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ghostBtn danger"
              onClick={() => {
                setError("");
                setConfirmDeleteAll(true);
              }}
              disabled={items.length === 0}
            >
              {t("notificationsPage.actions.deleteAll")}
            </button>
          )}
          <Link to="/chat" className="primaryBtn">
            {t("notificationsPage.actions.openChat")}
          </Link>
        </div>
      </header>

      <div className="notificationStats">
        <div>
          <span>{t("notificationsPage.stats.total")}</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>{t("notificationsPage.stats.unread")}</span>
          <strong>{unreadCount}</strong>
        </div>
      </div>

      <div className="noticeFilters">
        {["all", "unread", "messages", "account"].map((key) => (
          <button
            type="button"
            key={key}
            className={filter === key ? "isActive" : ""}
            onClick={() => setFilter(key)}
          >
            {t(`notificationsPage.filters.${key}`)}
          </button>
        ))}
      </div>

      {error && <div className="notice error">{error}</div>}

      {loading ? (
        <div className="notice">{t("notificationsPage.states.loading")}</div>
      ) : items.length === 0 ? (
        <div className="emptyBox">
          <h2>{t("notificationsPage.empty.title")}</h2>
          <p>{t("notificationsPage.empty.message")}</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="emptyBox">
          <h2>{t("notificationsPage.empty.filteredTitle")}</h2>
          <p>{t("notificationsPage.empty.filteredMessage")}</p>
        </div>
      ) : (
        <>
          {renderGroup("today", grouped.today)}
          {renderGroup("yesterday", grouped.yesterday)}
          {renderGroup("earlier", grouped.earlier)}
        </>
      )}
    </main>
  );
}

export default NotificationsPage;
