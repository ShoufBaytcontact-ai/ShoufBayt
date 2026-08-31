import prisma from "../lib/prisma.js";
import { cleanText, isValidObjectId } from "../lib/subscription.js";
import { notificationWhereForRole } from "../lib/notify.js";

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

/* =========================================================
   GET MY NOTIFICATIONS
========================================================= */

export const getMyNotifications = async (req, res) => {
  const userId = req.userId;

  try {
    if (!userId) {
      return res.status(401).json({ message: "You are not logged in!" });
    }

    const unreadOnly = String(req.query.unread || "").toLowerCase() === "true";
    const scopedWhere = notificationWhereForRole(userId, req.userRole);

    const notifications = await prisma.notification.findMany({
      where: {
        ...scopedWhere,
        ...(unreadOnly
          ? {
              isRead: false,
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const unreadCount = await prisma.notification.count({
      where: {
        ...scopedWhere,
        isRead: false,
      },
    });

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get notifications");
  }
};

/* =========================================================
   MARK ONE AS READ
========================================================= */

export const markNotificationRead = async (req, res) => {
  const userId = req.userId;
  const id = cleanText(req.params.id);

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    const updated = await prisma.notification.update({
      where: {
        id,
      },
      data: {
        isRead: true,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleError(res, error, "Failed to mark notification as read");
  }
};

/* =========================================================
   MARK ALL AS READ
========================================================= */

export const markAllNotificationsRead = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await prisma.notification.updateMany({
      where: {
        ...notificationWhereForRole(userId, req.userRole),
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.status(200).json({
      message: "All notifications marked as read",
      count: result.count,
    });
  } catch (error) {
    return handleError(res, error, "Failed to mark notifications as read");
  }
};

/* =========================================================
   DELETE ALL NOTIFICATIONS
========================================================= */

export const deleteAllNotifications = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await prisma.notification.deleteMany({
      where: notificationWhereForRole(userId, req.userRole),
    });

    return res.status(200).json({
      message: "All notifications deleted",
      count: result.count,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete notifications");
  }
};

/* =========================================================
   DELETE NOTIFICATION
========================================================= */

export const deleteNotification = async (req, res) => {
  const userId = req.userId;
  const id = cleanText(req.params.id);

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    await prisma.notification.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "Notification deleted",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete notification");
  }
};
