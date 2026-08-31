import express from "express";
import {
  getPosts,
  getPost,
  addPost,
  updatePost,
  deletePost,
  updatePostStatus,
} from "../controllers/post.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { upload } from "../middleware/upload.js";
import { formatStorageError, requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

const uploadPostImages = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.log("POST IMAGE UPLOAD ERROR:", err);

      return res.status(400).json({
        message: formatStorageError(err),
        field: err.field || null,
        code: err.code || null,
      });
    }

    next();
  });
};

router.get("/", getPosts);
router.post("/", shouldBeLoggedIN, requireR2Upload, uploadPostImages, addPost);

router.patch("/:id/status", shouldBeLoggedIN, updatePostStatus);
router.get("/:id", getPost);
router.put("/:id", shouldBeLoggedIN, requireR2Upload, uploadPostImages, updatePost);
router.delete("/:id", shouldBeLoggedIN, deletePost);

export default router;
