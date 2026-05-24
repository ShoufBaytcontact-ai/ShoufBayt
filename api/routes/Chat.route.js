import express from "express";

import {
  getChats,
  getChat,
  addChat,
  readChat,
} from "../controllers/chat.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", shouldBeLoggedIN, getChats);
router.post("/", shouldBeLoggedIN, addChat);
router.put("/read/:id", shouldBeLoggedIN, readChat);
router.get("/:id", shouldBeLoggedIN, getChat);

export default router;