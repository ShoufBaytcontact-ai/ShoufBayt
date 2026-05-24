import express from "express";

import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  savePost,
  profilePosts,
  getNotificationNumber,
} from "../controllers/user.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getUsers);

router.get("/profile/posts", shouldBeLoggedIN, profilePosts);
router.get("/notifications", shouldBeLoggedIN, getNotificationNumber);

router.get("/:id", shouldBeLoggedIN, getUser);
router.put("/:id", shouldBeLoggedIN, upload.single("avatar"), updateUser);
router.delete("/:id", shouldBeLoggedIN, deleteUser);

router.post("/save/:id", shouldBeLoggedIN, savePost);

export default router;