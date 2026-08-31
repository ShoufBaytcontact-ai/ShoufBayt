import express from "express";

import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  savePost,
  profilePosts,
  getNotificationNumber,
  updateAgentStatus,
  getOwnerDashboard,
} from "../controllers/user.controller.js";
import { savePhone } from "../controllers/phone.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { shouldBeAdmin } from "../middleware/verifyAdmin.js";
import { upload } from "../middleware/upload.js";
import { requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

router.get("/", shouldBeLoggedIN, getUsers);

router.get("/profile/posts", shouldBeLoggedIN, profilePosts);
router.get("/me/owner-dashboard", shouldBeLoggedIN, getOwnerDashboard);
router.get("/notifications", shouldBeLoggedIN, getNotificationNumber);

router.post("/phone", shouldBeLoggedIN, savePhone);
router.post("/phone/request", shouldBeLoggedIN, savePhone);

router.post("/save/:id", shouldBeLoggedIN, savePost);

router.put(
  "/agents/:id/status",
  shouldBeLoggedIN,
  shouldBeAdmin,
  updateAgentStatus
);

router.get("/:id", shouldBeLoggedIN, getUser);
router.put("/:id", shouldBeLoggedIN, requireR2Upload, upload.single("avatar"), updateUser);
router.delete("/:id", shouldBeLoggedIN, deleteUser);

export default router;
