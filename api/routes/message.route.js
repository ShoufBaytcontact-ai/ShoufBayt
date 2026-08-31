import express from "express";

import { addMessage } from "../controllers/message.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { chatUploadSingle } from "../middleware/chatUpload.js";
import { requireR2Upload } from "../lib/cloudStorage.js";

const router = express.Router();

router.post("/", shouldBeLoggedIN, requireR2Upload, chatUploadSingle, addMessage);
router.post("/:chatId", shouldBeLoggedIN, requireR2Upload, chatUploadSingle, addMessage);

export default router;
