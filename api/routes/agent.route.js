import express from "express";

import {
  getAgents,
  getAgent,
  getMyAgentInsights,
  getMyAgentListings,
  getMyAgentProfile,
  updateMyAgentProfile,
  requestAgent,
  getMyAgentRequest,
  getMyAgentApplication,
  getAgentRequests,
  getAgentApplications,
  approveAgentRequest,
  approveAgentApplication,
  rejectAgentRequest,
  rejectAgentApplication,
} from "../controllers/agent.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";
import { upload } from "../middleware/upload.js";
import { requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

router.get("/", getAgents);

router.get("/me/insights", shouldBeLoggedIN, getMyAgentInsights);
router.get("/me/listings", shouldBeLoggedIN, getMyAgentListings);
router.get("/me", shouldBeLoggedIN, getMyAgentProfile);
router.put(
  "/me",
  shouldBeLoggedIN,
  requireR2Upload,
  upload.single("image"),
  updateMyAgentProfile
);

router.post(
  "/request",
  shouldBeLoggedIN,
  requireR2Upload,
  upload.single("image"),
  requestAgent
);

router.post(
  "/applications",
  shouldBeLoggedIN,
  requireR2Upload,
  upload.single("image"),
  requestAgent
);

router.get("/my-request", shouldBeLoggedIN, getMyAgentRequest);
router.get("/my-application", shouldBeLoggedIN, getMyAgentApplication);

router.get("/requests", shouldBeLoggedIN, shouldBeAdmin, getAgentRequests);
router.get(
  "/applications",
  shouldBeLoggedIN,
  shouldBeAdmin,
  getAgentApplications
);

router.put(
  "/requests/:id/approve",
  shouldBeLoggedIN,
  shouldBeAdmin,
  approveAgentRequest
);

router.put(
  "/applications/:id/approve",
  shouldBeLoggedIN,
  shouldBeAdmin,
  approveAgentApplication
);

router.put(
  "/requests/:id/reject",
  shouldBeLoggedIN,
  shouldBeAdmin,
  rejectAgentRequest
);

router.put(
  "/applications/:id/reject",
  shouldBeLoggedIN,
  shouldBeAdmin,
  rejectAgentApplication
);

router.get("/:id", getAgent);

export default router;
