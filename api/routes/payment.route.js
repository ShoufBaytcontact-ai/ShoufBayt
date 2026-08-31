import express from "express";
import {
  completeCardPayment,
  createCardPaymentIntent,
  getAdminPayments,
  getBillingOverview,
  getCardConfig,
  getMyPayments,
  reviewPayment,
  submitPayment,
} from "../controllers/payment.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";
import { upload } from "../middleware/upload.js";
import { requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

router.get("/overview", shouldBeLoggedIN, getBillingOverview);
router.get("/me", shouldBeLoggedIN, getMyPayments);

router.get("/card/config", shouldBeLoggedIN, getCardConfig);
router.post("/card/intent", shouldBeLoggedIN, createCardPaymentIntent);
router.post("/card/complete", shouldBeLoggedIN, completeCardPayment);

router.post(
  "/submit",
  shouldBeLoggedIN,
  requireR2Upload,
  upload.single("proof"),
  submitPayment
);

router.get("/admin", shouldBeLoggedIN, shouldBeAdmin, getAdminPayments);

router.patch(
  "/admin/:id/review",
  shouldBeLoggedIN,
  shouldBeAdmin,
  reviewPayment
);

export default router;
