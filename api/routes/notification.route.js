import express from "express";
import {
  deleteAllNotifications,
  deleteNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", shouldBeLoggedIN, getMyNotifications);
router.patch("/read-all", shouldBeLoggedIN, markAllNotificationsRead);
router.delete("/", shouldBeLoggedIN, deleteAllNotifications);
router.patch("/:id/read", shouldBeLoggedIN, markNotificationRead);
router.delete("/:id", shouldBeLoggedIN, deleteNotification);

export default router;
