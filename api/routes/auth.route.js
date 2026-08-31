import express from "express";
import {
  register,
  login,
  verifyLoginCode,
  resendLoginCode,
  forgotPassword,
  resendResetCode,
  verifyResetCode,
  resetPassword,
  refreshSession,
  logout,
  googleConfig,
  googleAuth,
} from "../controllers/auth.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/google-config", googleConfig);
router.post("/google", googleAuth);
router.post("/register", register);
router.post("/login", login);
router.post("/verify-login-code", verifyLoginCode);
router.post("/resend-login-code", resendLoginCode);
router.post("/forgot-password", forgotPassword);
router.post("/resend-reset-code", resendResetCode);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password", resetPassword);
router.post("/refresh", shouldBeLoggedIN, refreshSession);
router.post("/logout", logout);

export default router;
