import express from "express";
import {
  getAgents,
  getAgent,
  requestAgent,
  getMyAgentRequest,
  getAgentRequests,
  approveAgentRequest,
  rejectAgentRequest,
} from "../controllers/agent.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getAgents);

router.post(
  "/request",
  shouldBeLoggedIN,
  upload.single("image"),
  requestAgent
);

router.get("/my-request", shouldBeLoggedIN, getMyAgentRequest);

router.get("/requests", shouldBeLoggedIN, shouldBeAdmin, getAgentRequests);
router.put("/requests/:id/approve", shouldBeLoggedIN, shouldBeAdmin, approveAgentRequest);
router.put("/requests/:id/reject", shouldBeLoggedIN, shouldBeAdmin, rejectAgentRequest);

router.get("/:id", getAgent);

export default router;