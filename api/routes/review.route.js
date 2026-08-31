import express from "express";
import {
  createAgentReview,
  createPropertyReview,
  deleteMyAgentReview,
  deleteMyPropertyReview,
  getAgentReviews,
  getPropertyReviews,
  updateMyAgentReview,
  updateMyPropertyReview,
} from "../controllers/review.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/property/:id", getPropertyReviews);
router.post("/property/:id", shouldBeLoggedIN, createPropertyReview);
router.patch("/property/item/:id", shouldBeLoggedIN, updateMyPropertyReview);
router.delete(
  "/property/item/:id",
  shouldBeLoggedIN,
  deleteMyPropertyReview
);

router.get("/agent/:id", getAgentReviews);
router.post("/agent/:id", shouldBeLoggedIN, createAgentReview);
router.patch("/agent/item/:id", shouldBeLoggedIN, updateMyAgentReview);
router.delete("/agent/item/:id", shouldBeLoggedIN, deleteMyAgentReview);

export default router;
