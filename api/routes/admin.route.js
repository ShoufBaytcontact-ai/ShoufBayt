import express from "express";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";

import {
  getAdminStats,
  getAdminUsers,
  getAdminPosts,
  deleteAdminUser,
  deleteAdminPost,
  updateUserRole,
  getAdminContactMessages,
  updateContactMessageStatus,
  deleteContactMessage,
  replyToContactMessage,
  getAdminAgents,
  createAdminAgent,
  updateAdminAgent,
  removeAdminAgent,
} from "../controllers/admin.controller.js";

import {
  getAgentRequests,
  approveAgentRequest,
  rejectAgentRequest,
} from "../controllers/agent.controller.js";

const router = express.Router();

router.use(shouldBeLoggedIN);
router.use(shouldBeAdmin);

router.get("/stats", getAdminStats);

router.get("/users", getAdminUsers);
router.put("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteAdminUser);

router.get("/posts", getAdminPosts);
router.delete("/posts/:id", deleteAdminPost);

router.get("/agents", getAdminAgents);
router.post("/agents", createAdminAgent);
router.put("/agents/:id", updateAdminAgent);
router.delete("/agents/:id", removeAdminAgent);

router.get("/agent-requests", getAgentRequests);
router.put("/agent-requests/:id/approve", approveAgentRequest);
router.put("/agent-requests/:id/reject", rejectAgentRequest);

router.get("/contact-messages", getAdminContactMessages);
router.put("/contact-messages/:id/status", updateContactMessageStatus);
router.put("/contact-messages/:id/reply", replyToContactMessage);
router.delete("/contact-messages/:id", deleteContactMessage);

export default router;