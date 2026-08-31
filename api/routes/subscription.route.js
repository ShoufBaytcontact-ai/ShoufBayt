import express from "express";
import {
  cancelAutoRenew,
  cancelMySubscription,
  expireSubscription,
  getAdminSubscriptions,
  getLaunchPeriodStatus,
  getMySubscription,
  getMySubscriptionHistory,
  resumeMySubscription,
  sendLaunchPeriodEmails,
  sendLaunchPeriodTest,
} from "../controllers/subscription.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";

const router = express.Router();

router.get("/me", shouldBeLoggedIN, getMySubscription);
router.get("/me/history", shouldBeLoggedIN, getMySubscriptionHistory);
router.patch("/me/cancel-auto-renew", shouldBeLoggedIN, cancelAutoRenew);
router.patch("/me/cancel", shouldBeLoggedIN, cancelMySubscription);
router.patch("/me/resume", shouldBeLoggedIN, resumeMySubscription);

router.get(
  "/admin",
  shouldBeLoggedIN,
  shouldBeAdmin,
  getAdminSubscriptions
);

router.get(
  "/admin/launch-period",
  shouldBeLoggedIN,
  shouldBeAdmin,
  getLaunchPeriodStatus
);

router.post(
  "/admin/launch-period/test",
  shouldBeLoggedIN,
  shouldBeAdmin,
  sendLaunchPeriodTest
);

router.post(
  "/admin/launch-period/send",
  shouldBeLoggedIN,
  shouldBeAdmin,
  sendLaunchPeriodEmails
);

router.patch(
  "/admin/:id/expire",
  shouldBeLoggedIN,
  shouldBeAdmin,
  expireSubscription
);

export default router;
