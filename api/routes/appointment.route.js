import express from "express";
import {
  createAppointment,
  getMyAppointments,
  getMyPropertyAppointment,
  requestAppointment,
  updateAppointment,
} from "../controllers/appointment.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/me", shouldBeLoggedIN, getMyAppointments);
router.get(
  "/property/:propertyId",
  shouldBeLoggedIN,
  getMyPropertyAppointment
);
router.post("/", shouldBeLoggedIN, createAppointment);
router.post("/request", shouldBeLoggedIN, requestAppointment);
router.patch("/:id", shouldBeLoggedIN, updateAppointment);

export default router;
