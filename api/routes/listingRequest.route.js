import express from "express";
import {
  acceptListingInvite,
  acceptListingProposal,
  cancelListingRequest,
  createListingRequest,
  getAgentLeads,
  getAgentListingInbox,
  getListingRequestById,
  getMyListingRequests,
  rejectListingInvite,
  rejectListingProposal,
  submitListingProposal,
  withdrawListingProposal,
} from "../controllers/listingRequest.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { upload } from "../middleware/upload.js";
import { formatStorageError, requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

const uploadImages = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: formatStorageError(err),
      });
    }
    next();
  });
};

router.post("/", shouldBeLoggedIN, requireR2Upload, uploadImages, createListingRequest);
router.get("/me", shouldBeLoggedIN, getMyListingRequests);
router.get("/leads", shouldBeLoggedIN, getAgentLeads);
router.get("/inbox", shouldBeLoggedIN, getAgentListingInbox);

router.post(
  "/:id/proposals",
  shouldBeLoggedIN,
  submitListingProposal
);
router.post(
  "/proposals/:id/withdraw",
  shouldBeLoggedIN,
  withdrawListingProposal
);
router.post(
  "/:id/proposals/:proposalId/accept",
  shouldBeLoggedIN,
  acceptListingProposal
);
router.post(
  "/:id/proposals/:proposalId/reject",
  shouldBeLoggedIN,
  rejectListingProposal
);

router.post("/invites/:id/accept", shouldBeLoggedIN, acceptListingInvite);
router.post("/invites/:id/reject", shouldBeLoggedIN, rejectListingInvite);
router.patch("/:id/cancel", shouldBeLoggedIN, cancelListingRequest);
router.get("/:id", shouldBeLoggedIN, getListingRequestById);

export default router;
