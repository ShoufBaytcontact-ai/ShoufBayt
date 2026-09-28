import express from "express";
import {
  addInvestment,
  deleteInvestment,
  getInvestment,
  getInvestments,
  updateInvestment,
  updateInvestmentLocation,
} from "../controllers/investment.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { upload } from "../middleware/upload.js";
import { formatStorageError, requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

const uploadImages = (req, res, next) => {
  upload.array("images", 12)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: formatStorageError(err),
      });
    }
    next();
  });
};

router.get("/", getInvestments);
router.get("/:id", getInvestment);
router.patch("/:id/location", shouldBeLoggedIN, updateInvestmentLocation);
router.put("/:id", shouldBeLoggedIN, uploadImages, updateInvestment);
router.delete("/:id", shouldBeLoggedIN, deleteInvestment);
router.post("/", shouldBeLoggedIN, requireR2Upload, uploadImages, addInvestment);

export default router;
