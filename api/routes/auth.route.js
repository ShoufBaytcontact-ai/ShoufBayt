import express from "express";
import {
  register,
  login,
  verifyLoginCode,
  resendLoginCode,
  logout,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-login-code", verifyLoginCode);
router.post("/logout", logout);
router.post("/resend-login-code", resendLoginCode);

export default router;