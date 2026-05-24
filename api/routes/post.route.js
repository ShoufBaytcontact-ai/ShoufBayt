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

const router = express.Router();

router.get("/", getPosts);
router.post("/", shouldBeLoggedIN, upload.array("images"), addPost);

router.patch("/:id/status", shouldBeLoggedIN, updatePostStatus);

router.get("/:id", getPost);
router.put("/:id", shouldBeLoggedIN, upload.array("images"), updatePost);
router.delete("/:id", shouldBeLoggedIN, deletePost);

export default router;