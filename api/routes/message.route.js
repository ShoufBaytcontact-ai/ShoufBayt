import express from "express";

import { addMessage } from "../controllers/message.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/", shouldBeLoggedIN, addMessage);

export default router;