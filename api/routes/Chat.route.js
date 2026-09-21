import express from "express";

import {
  getChats,
  getChat,
  addChat,
  readChat,
  deleteChat,
  deleteMessage,
  sendMessage,
  clearChat,
  getOrCreateSupportChat,
} from "../controllers/chat.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", shouldBeLoggedIN, getChats);
router.post("/", shouldBeLoggedIN, addChat);
router.get("/support", shouldBeLoggedIN, getOrCreateSupportChat);
router.post("/support", shouldBeLoggedIN, getOrCreateSupportChat);
router.put("/read/:id", shouldBeLoggedIN, readChat);
router.post("/:id/clear", shouldBeLoggedIN, clearChat);
router.post("/:id/messages", shouldBeLoggedIN, sendMessage);
router.delete("/:id/messages/:messageId", shouldBeLoggedIN, deleteMessage);
router.delete("/:id", shouldBeLoggedIN, deleteChat);
router.get("/:id", shouldBeLoggedIN, getChat);

export default router;
