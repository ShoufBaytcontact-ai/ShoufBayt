import express from "express";
import {
  createPropertyReport,
  getAdminReports,
  getMyReports,
  reviewPropertyReport,
} from "../controllers/report.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";

const router = express.Router();

router.post("/", shouldBeLoggedIN, createPropertyReport);
router.get("/me", shouldBeLoggedIN, getMyReports);

router.get("/admin", shouldBeLoggedIN, shouldBeAdmin, getAdminReports);
router.patch(
  "/admin/:id/review",
  shouldBeLoggedIN,
  shouldBeAdmin,
  reviewPropertyReport
);

export default router;
