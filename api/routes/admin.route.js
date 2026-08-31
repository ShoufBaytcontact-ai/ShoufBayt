import express from "express";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";
import { upload } from "../middleware/upload.js";
import { requireR2Upload } from "../lib/cloudStorage.js";

import {
  getAdminStats,
  getAdminUsers,
  getAdminProperties,
  getAdminPosts,
  deleteAdminUser,
  deleteAdminProperty,
  deleteAdminPost,
  updateUserRole,
  updateUserStatus,
  updatePropertyStatus,
  getAdminContactMessages,
  updateContactMessageStatus,
  deleteContactMessage,
  replyToContactMessage,
  getAdminAgents,
  getAdminAgentApplications,
  reviewAgentApplication,
  createAdminAgent,
  updateAdminAgent,
  removeAdminAgent,
} from "../controllers/admin.controller.js";

import {
  getAgentRequests,
  approveAgentRequest,
  rejectAgentRequest,
} from "../controllers/agent.controller.js";

import {
  getAdminPayments,
  reviewPayment,
} from "../controllers/payment.controller.js";

import {
  getAdminSubscriptions,
  expireSubscription,
} from "../controllers/subscription.controller.js";

import {
  getAdminReports,
  reviewPropertyReport,
} from "../controllers/report.controller.js";
import {
  getAdminSupportChats,
  getAdminSupportChat,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.use(shouldBeLoggedIN);
router.use(shouldBeAdmin);

/* Stats */
router.get("/stats", getAdminStats);

/* Users */
router.get("/users", getAdminUsers);
router.put("/users/:id/role", updateUserRole);
router.put("/users/:id/status", updateUserStatus);
router.delete("/users/:id", deleteAdminUser);

/* Properties (new + old aliases) */
router.get("/properties", getAdminProperties);
router.patch("/properties/:id/status", updatePropertyStatus);
router.delete("/properties/:id", deleteAdminProperty);

router.get("/posts", getAdminPosts);
router.delete("/posts/:id", deleteAdminPost);

/* Agents */
router.get("/agents", getAdminAgents);
router.post("/agents", requireR2Upload, upload.single("image"), createAdminAgent);
router.put("/agents/:id", requireR2Upload, upload.single("image"), updateAdminAgent);
router.delete("/agents/:id", removeAdminAgent);

/* Agent applications */
router.get("/agent-applications", getAdminAgentApplications);
router.put("/agent-applications/:id/review", reviewAgentApplication);

router.get("/agent-requests", getAgentRequests);
router.put("/agent-requests/:id/approve", approveAgentRequest);
router.put("/agent-requests/:id/reject", rejectAgentRequest);

/* Contact */
router.get("/contact-messages", getAdminContactMessages);
router.put("/contact-messages/:id/status", updateContactMessageStatus);
router.put("/contact-messages/:id/reply", replyToContactMessage);
router.delete("/contact-messages/:id", deleteContactMessage);

/* Payments */
router.get("/payments", getAdminPayments);
router.patch("/payments/:id/review", reviewPayment);

/* Subscriptions */
router.get("/subscriptions", getAdminSubscriptions);
router.patch("/subscriptions/:id/expire", expireSubscription);

/* Reports */
router.get("/reports", getAdminReports);
router.patch("/reports/:id/review", reviewPropertyReport);

/* Live support chat */
router.get("/support-chats", getAdminSupportChats);
router.get("/support-chats/:id", getAdminSupportChat);

export default router;
