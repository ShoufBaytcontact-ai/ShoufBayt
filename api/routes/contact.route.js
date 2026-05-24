import express from "express";
import jwt from "jsonwebtoken";
import {
  createContactMessage,
  getMyContactMessages,
} from "../controllers/contact.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

const optionalLogin = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, payload) => {
    if (!err && payload?.id) {
      req.userId = payload.id;
    }

    next();
  });
};

router.post("/", optionalLogin, createContactMessage);
router.get("/my-messages", shouldBeLoggedIN, getMyContactMessages);

export default router;