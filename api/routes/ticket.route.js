import express from "express";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { ticketImageUpload } from "../middleware/upload.js";
import {
  formatStorageError,
  isR2Enabled,
} from "../lib/cloudStorage.js";
import {
  addTicketMessage,
  assignTicket,
  createTicket,
  getTicket,
  listTicketBoard,
  listTicketLawyers,
  listTickets,
  updateTicketStatus,
} from "../controllers/ticket.controller.js";

const optionalTicketImages = (req, res, next) => {
  ticketImageUpload.array("images", 8)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: formatStorageError(err),
      });
    }

    if ((req.files || []).length && !isR2Enabled()) {
      return res.status(503).json({
        message:
          "Photo upload is not configured. Send the ticket without images, or add Cloudflare R2 keys.",
      });
    }

    return next();
  });
};

const router = express.Router();

router.use(shouldBeLoggedIN);
router.get("/", listTickets);
router.post("/", optionalTicketImages, createTicket);
router.get("/board", listTicketBoard);
router.get("/lawyers", listTicketLawyers);
router.get("/:id", getTicket);
router.post("/:id/messages", addTicketMessage);
router.post("/:id/assign", assignTicket);
router.patch("/:id", updateTicketStatus);

export default router;
