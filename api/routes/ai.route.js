import express from "express";
import {
  generatePropertyDescription,
  generateAdminReply,
} from "../controllers/ai.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.post(
  "/property-description",
  shouldBeLoggedIN,
  generatePropertyDescription
);

router.post("/admin-reply", shouldBeLoggedIN, generateAdminReply);

export default router;