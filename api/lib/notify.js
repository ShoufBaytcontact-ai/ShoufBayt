import prisma from "./prisma.js";
import { emitNotification } from "./realtime.js";

/** In-app + email alerts that belong only to verified agents. */
export const AGENT_ONLY_NOTIFICATION_TYPES = [
  "LISTING_LEAD",
  "LISTING_PROPOSAL_ACCEPTED",
  "LISTING_PROPOSAL_REJECTED",
  "SUBSCRIPTION_EXPIRING",
  "SUBSCRIPTION_EXPIRED",
];

/** Alerts that belong to the homeowner who submitted a listing request. */
export const HOMEOWNER_ONLY_NOTIFICATION_TYPES = [
  "LISTING_REQUEST",
  "LISTING_PROPOSAL",
  "LISTING_REQUEST_ACCEPTED",
  "LISTING_REQUEST_REJECTED",
];

export const notificationWhereForRole = (userId, role) => {
  const roleUpper = String(role || "").toUpperCase();
  const excluded =
    roleUpper === "AGENT"
      ? HOMEOWNER_ONLY_NOTIFICATION_TYPES
      : AGENT_ONLY_NOTIFICATION_TYPES;

  return {
    userId,
    ...(excluded.length
      ? {
          type: {
            notIn: excluded,
          },
        }
      : {}),
  };
};

export const notificationBadgeWhere = (userId, role) => {
  const scoped = notificationWhereForRole(userId, role);
  const excluded = ["NEW_MESSAGE", ...(scoped.type?.notIn || [])];

  return {
    userId: scoped.userId,
    type: {
      notIn: excluded,
    },
  };
};

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  link,
  metadata,
  requireRole,
} = {}) => {
  if (!userId || !type || !title || !message) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status === "SUSPENDED" || user.status === "BANNED") {
      return null;
    }

    const role = String(user.role || "").toUpperCase();
    const allowedRoles = requireRole
      ? (Array.isArray(requireRole) ? requireRole : [requireRole]).map((item) =>
          String(item).toUpperCase()
        )
      : null;

    if (allowedRoles && !allowedRoles.includes(role)) {
      return null;
    }

    if (AGENT_ONLY_NOTIFICATION_TYPES.includes(type) && role !== "AGENT") {
      return null;
    }

    if (HOMEOWNER_ONLY_NOTIFICATION_TYPES.includes(type) && role === "AGENT") {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
        metadata: metadata || undefined,
      },
    });

    emitNotification(userId, {
      id: notification.id,
      userId,
      type,
      title,
      message,
      link: notification.link,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      replaced: false,
    });

    return { notification, user };
  } catch (error) {
    console.error("NOTIFICATION ERROR:", error);
    return null;
  }
};

const toPayload = (notification, replaced = false) => ({
  id: notification.id,
  userId: notification.userId,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  link: notification.link,
  isRead: notification.isRead,
  createdAt: notification.createdAt,
  replaced,
});

export const upsertChatNotification = async ({
  userId,
  title,
  message,
  link,
  metadata,
} = {}) => {
  if (!userId || !title || !message) {
    return null;
  }

  const chatId = String(metadata?.chatId || "");

  try {
    const unread = await prisma.notification.findMany({
      where: {
        userId,
        type: "NEW_MESSAGE",
        isRead: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    });

    const existing = unread.find((item) => {
      const meta = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      return chatId && String(meta.chatId || "") === chatId;
    });

    if (existing) {
      const notification = await prisma.notification.update({
        where: { id: existing.id },
        data: {
          title,
          message,
          link: link || existing.link,
          metadata: metadata || existing.metadata || undefined,
          createdAt: new Date(),
        },
      });

      emitNotification(userId, toPayload(notification, true));
      return { notification, replaced: true };
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "NEW_MESSAGE",
        title,
        message,
        link: link || null,
        metadata: metadata || undefined,
      },
    });

    emitNotification(userId, toPayload(notification, false));
    return { notification, replaced: false };
  } catch (error) {
    console.error("CHAT NOTIFICATION ERROR:", error);
    return null;
  }
};
