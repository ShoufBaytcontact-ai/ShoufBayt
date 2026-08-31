import express from "express";
import jwt from "jsonwebtoken";

import {
  createContactMessage,
  getMyContactMessages,
  getMyContactMessage,
  updateMyContactMessage,
  deleteMyContactMessage,
  clearMyAnsweredContactMessages,
} from "../controllers/contact.controller.js";

import { shouldBeLoggedIN } from "../middleware/verifyToken.js";
import { SESSION_IDLE_JWT } from "../lib/sessionIdle.js";

const router = express.Router();

const optionalLogin = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token || !process.env.JWT_SECRET_KEY) {
    return next();
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET_KEY,
    { maxAge: SESSION_IDLE_JWT },
    (err, payload) => {
    if (!err && payload?.id) {
      req.userId = payload.id;
      req.userRole = payload.role || null;
    }

    return next();
  });
};

router.post("/", optionalLogin, createContactMessage);
router.get("/my-messages", shouldBeLoggedIN, getMyContactMessages);
router.post("/clear-tracking", shouldBeLoggedIN, clearMyAnsweredContactMessages);
router.delete("/clear-tracking", shouldBeLoggedIN, clearMyAnsweredContactMessages);
router.delete("/my-messages/clear", shouldBeLoggedIN, clearMyAnsweredContactMessages);
router.get("/my-messages/:id", shouldBeLoggedIN, getMyContactMessage);
router.put("/my-messages/:id", shouldBeLoggedIN, updateMyContactMessage);
router.patch("/my-messages/:id", shouldBeLoggedIN, updateMyContactMessage);
router.post("/my-messages/:id/remove", shouldBeLoggedIN, deleteMyContactMessage);
router.delete("/my-messages/:id", shouldBeLoggedIN, deleteMyContactMessage);

export default router;
