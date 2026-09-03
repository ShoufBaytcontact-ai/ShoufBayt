import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import {
  sendLoginCodeEmail,
  sendPasswordResetCodeEmail,
  sendWelcomeEmail,
} from "../lib/sendEmail.js";
import { SESSION_IDLE_JWT, SESSION_IDLE_MS } from "../lib/sessionIdle.js";
import { unsetEmptyGoogleId } from "../lib/ensureUniqueIndexes.js";
import {
  UniqueConflictError,
  sendUniqueConflict,
  uniqueTargetMessage,
  assertUsernameAvailable,
  assertEmailAvailable,
  findUsernameOwner,
  normalizeEmail,
  normalizeUsername,
} from "../lib/uniqueFields.js";

const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL = "15m";
const MAX_CODE_ATTEMPTS = 5;

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const isDatabaseConnectivityError = (error) => {
  const message = String(error?.message || error?.meta?.message || "");
  return (
    error?.code === "P2010" ||
    error?.code === "P1001" ||
    /Server selection timeout|ReplicaSetNoPrimary|timed out|I\/O error|Connection pool/i.test(
      message
    )
  );
};

const databaseUnavailableResponse = (res) =>
  res.status(503).json({
    message:
      "Database is temporarily unavailable. Please wait a moment and try again.",
  });

const getCookieOptions = () => {
  // Split hosting (Cloudflare Pages + Render) is cross-site, so production
  // cookies must be SameSite=None; Secure or the browser will not send them.
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
  };
};

const issueAuthCookie = (res, user) => {
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: SESSION_IDLE_JWT,
    }
  );

  const { password: userPassword, ...userInfo } = user;

  return res
    .cookie("token", token, {
      ...getCookieOptions(),
      maxAge: SESSION_IDLE_MS,
    })
    .status(200)
    .json(userInfo);
};

const invalidateUnusedCodes = async (userId, type = "LOGIN") => {
  await prisma.verificationCode.updateMany({
    where: {
      userId,
      type,
      used: false,
    },
    data: {
      used: true,
    },
  });
};

const createVerificationCode = async (userId, type, ttlMs) => {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.verificationCode.create({
    data: {
      userId,
      type,
      codeHash,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  return code;
};

const createLoginCode = async (userId) =>
  createVerificationCode(userId, "LOGIN", LOGIN_CODE_TTL_MS);

const createPasswordResetCode = async (userId) =>
  createVerificationCode(userId, "PASSWORD_RESET", RESET_CODE_TTL_MS);

const sendAuthEmailInBackground = (sendPromise, label) => {
  Promise.resolve(sendPromise).catch((error) => {
    console.error(`${label}:`, error?.message || error);
  });
};

const issuePasswordResetToken = (userId, codeId) => {
  if (!process.env.JWT_SECRET_KEY) {
    throw new Error("JWT secret key is missing");
  }

  return jwt.sign(
    {
      purpose: "password_reset",
      userId,
      codeId,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: RESET_TOKEN_TTL,
    }
  );
};

const sendWelcomeOnFirstSignIn = async (user) => {
  if (!user?.id || user.welcomeEmailSentAt) return;

  const sent = await sendWelcomeEmail(user.email, user.username);
  if (!sent) {
    console.error("WELCOME EMAIL ERROR: send failed, will retry next sign-in");
    return;
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeEmailSentAt: new Date() },
    });
  } catch (error) {
    try {
      await prisma.$runCommandRaw({
        update: "User",
        updates: [
          {
            q: { _id: { $oid: user.id } },
            u: {
              $set: {
                welcomeEmailSentAt: { $date: new Date().toISOString() },
              },
            },
          },
        ],
      });
    } catch (markError) {
      console.error(
        "WELCOME EMAIL MARK ERROR:",
        markError?.message || markError
      );
    }
  }
};

export const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required",
      });
    }

    const cleanUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    if (!cleanUsername || !normalizedEmail) {
      return res.status(400).json({
        message: "Username and email cannot be empty",
      });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters, uppercase, lowercase, number, and special character",
      });
    }

    await assertUsernameAvailable(cleanUsername);

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, googleId: true },
    });

    if (existingEmail?.googleId) {
      throw new UniqueConflictError(
        "This email already has a Google account. Use Continue with Google.",
        "GOOGLE_ACCOUNT"
      );
    }

    await assertEmailAvailable(normalizedEmail);

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: false,
      },
    });

    await unsetEmptyGoogleId(newUser.id);

    await invalidateUnusedCodes(newUser.id, "LOGIN");
    const code = await createLoginCode(newUser.id);

    sendAuthEmailInBackground(
      sendLoginCodeEmail(newUser.email, code),
      "REGISTER EMAIL ERROR"
    );

    return res.status(200).json({
      message: "Verification code sent to your email",
      email: newUser.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.log("REGISTER ERROR:", error);

    if (sendUniqueConflict(res, error)) {
      return;
    }

    if (error.code === "P2002") {
      return res.status(400).json({
        message: uniqueTargetMessage(error),
      });
    }

    return res.status(500).json({
      message: "Failed to create user",
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      if (user.googleId) {
        return res.status(401).json({
          message:
            "This email is linked with Google. Continue with Google to sign in.",
        });
      }

      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    await invalidateUnusedCodes(user.id, "LOGIN");
    const code = await createLoginCode(user.id);

    sendAuthEmailInBackground(
      sendLoginCodeEmail(user.email, code),
      "LOGIN EMAIL ERROR"
    );

    return res.status(200).json({
      message: "Verification code sent to your email",
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);

    if (isDatabaseConnectivityError(error)) {
      return databaseUnavailableResponse(res);
    }

    return res.status(500).json({
      message: error?.message
        ? `Failed to login: ${error.message}`
        : "Failed to login",
    });
  }
};

export const verifyLoginCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({
        message: "Email and code are required",
      });
    }

    if (!process.env.JWT_SECRET_KEY) {
      return res.status(500).json({
        message: "JWT secret key is missing",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: {
        agentProfile: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid verification code",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    const loginCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: "LOGIN",
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!loginCode) {
      return res.status(400).json({
        message: "Code expired or invalid",
      });
    }

    if (loginCode.attempts >= MAX_CODE_ATTEMPTS) {
      await prisma.verificationCode.update({
        where: {
          id: loginCode.id,
        },
        data: {
          used: true,
        },
      });

      return res.status(429).json({
        message: "Too many wrong attempts. Please login again.",
      });
    }

    const isCodeValid = await bcrypt.compare(cleanCode, loginCode.codeHash);

    if (!isCodeValid) {
      await prisma.verificationCode.update({
        where: {
          id: loginCode.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({
        message: "Invalid verification code",
      });
    }

    await prisma.verificationCode.update({
      where: {
        id: loginCode.id,
      },
      data: {
        used: true,
      },
    });

    let signedInUser = user;
    if (!user.emailVerified) {
      signedInUser = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    sendWelcomeOnFirstSignIn(signedInUser).catch((error) => {
      console.error("WELCOME EMAIL ERROR:", error?.message || error);
    });

    return issueAuthCookie(res, signedInUser);
  } catch (error) {
    console.log("VERIFY LOGIN CODE ERROR:", error);

    return res.status(500).json({
      message: error?.message
        ? `Failed to verify login code: ${error.message}`
        : "Failed to verify login code",
    });
  }
};

export const resendLoginCode = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(200).json({
        message: "If this email exists, a new verification code was sent.",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    await invalidateUnusedCodes(user.id, "LOGIN");
    const code = await createLoginCode(user.id);

    sendAuthEmailInBackground(
      sendLoginCodeEmail(user.email, code),
      "RESEND LOGIN EMAIL ERROR"
    );

    return res.status(200).json({
      message: "A new verification code was sent to your email.",
    });
  } catch (error) {
    console.log("RESEND LOGIN CODE ERROR:", error);

    return res.status(500).json({
      message: "Failed to resend verification code",
    });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this email address",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    await invalidateUnusedCodes(user.id, "PASSWORD_RESET");
    const code = await createPasswordResetCode(user.id);

    sendAuthEmailInBackground(
      sendPasswordResetCodeEmail(user.email, code),
      "FORGOT PASSWORD EMAIL ERROR"
    );

    return res.status(200).json({
      message: "Verification code sent to your email",
      email: user.email,
    });
  } catch (error) {
    console.log("FORGOT PASSWORD ERROR:", error);

    if (isDatabaseConnectivityError(error)) {
      return databaseUnavailableResponse(res);
    }

    return res.status(500).json({
      message: "Failed to start password reset",
    });
  }
};

export const resendResetCode = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this email address",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    await invalidateUnusedCodes(user.id, "PASSWORD_RESET");
    const code = await createPasswordResetCode(user.id);

    sendAuthEmailInBackground(
      sendPasswordResetCodeEmail(user.email, code),
      "RESEND RESET EMAIL ERROR"
    );

    return res.status(200).json({
      message: "A new verification code was sent to your email.",
    });
  } catch (error) {
    console.log("RESEND RESET CODE ERROR:", error);

    return res.status(500).json({
      message: "Failed to resend verification code",
    });
  }
};

export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({
        message: "Email and code are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid verification code",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    const resetCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: "PASSWORD_RESET",
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!resetCode) {
      return res.status(400).json({
        message: "Code expired or invalid",
      });
    }

    if (resetCode.attempts >= MAX_CODE_ATTEMPTS) {
      await prisma.verificationCode.update({
        where: {
          id: resetCode.id,
        },
        data: {
          used: true,
        },
      });

      return res.status(429).json({
        message: "Too many wrong attempts. Please request a new code.",
      });
    }

    const isCodeValid = await bcrypt.compare(cleanCode, resetCode.codeHash);

    if (!isCodeValid) {
      await prisma.verificationCode.update({
        where: {
          id: resetCode.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({
        message: "Invalid verification code",
      });
    }

    let resetToken;

    try {
      resetToken = issuePasswordResetToken(user.id, resetCode.id);
    } catch (tokenError) {
      return res.status(500).json({
        message: tokenError.message || "JWT secret key is missing",
      });
    }

    return res.status(200).json({
      message: "Code verified. You can set a new password.",
      resetToken,
      email: user.email,
    });
  } catch (error) {
    console.log("VERIFY RESET CODE ERROR:", error);

    return res.status(500).json({
      message: "Failed to verify reset code",
    });
  }
};

export const resetPassword = async (req, res) => {
  const { resetToken, password } = req.body;

  try {
    if (!resetToken || !password) {
      return res.status(400).json({
        message: "Reset token and new password are required",
      });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters, uppercase, lowercase, number, and special character",
      });
    }

    if (!process.env.JWT_SECRET_KEY) {
      return res.status(500).json({
        message: "JWT secret key is missing",
      });
    }

    let payload;

    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET_KEY);
    } catch {
      return res.status(400).json({
        message: "Reset session expired. Please request a new code.",
      });
    }

    if (
      payload?.purpose !== "password_reset" ||
      !payload?.userId ||
      !payload?.codeId
    ) {
      return res.status(400).json({
        message: "Invalid reset session",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    const resetCode = await prisma.verificationCode.findUnique({
      where: {
        id: payload.codeId,
      },
    });

    if (
      !resetCode ||
      resetCode.userId !== user.id ||
      resetCode.type !== "PASSWORD_RESET" ||
      resetCode.used ||
      resetCode.expiresAt <= new Date()
    ) {
      return res.status(400).json({
        message: "Reset code expired or already used. Please request a new code.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    await prisma.verificationCode.update({
      where: {
        id: resetCode.id,
      },
      data: {
        used: true,
      },
    });

    await invalidateUnusedCodes(user.id, "PASSWORD_RESET");
    await invalidateUnusedCodes(user.id, "LOGIN");

    return res.status(200).json({
      message: "Password updated successfully. You can sign in now.",
    });
  } catch (error) {
    console.log("RESET PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Failed to reset password",
    });
  }
};

const cleanEnvValue = (value) =>
  String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

const googleClientId = () =>
  cleanEnvValue(process.env.GOOGLE_CLIENT_ID) ||
  cleanEnvValue(process.env.REACT_APP_GOOGLE_CLIENT_ID);

const uniqueGoogleUsername = async (name, email) => {
  const fromName = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  const fromEmail = String(email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 18);
  const base = fromName || fromEmail || "user";

  for (let index = 0; index < 40; index += 1) {
    const username = index === 0 ? base : `${base}${index + 1}`;
    const existing = await findUsernameOwner(username);

    if (!existing) {
      return username;
    }
  }

  return `user${crypto.randomInt(1000, 1000000)}`;
};

const readGoogleProfile = async ({ accessToken, credential }) => {
  if (accessToken) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("GOOGLE_PROFILE_FAILED");
    }

    return response.json();
  }

  if (credential) {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
        credential
      )}`
    );

    if (!response.ok) {
      throw new Error("GOOGLE_TOKEN_FAILED");
    }

    const payload = await response.json();
    const expectedAudience = googleClientId();

    if (expectedAudience && payload.aud !== expectedAudience) {
      throw new Error("GOOGLE_AUDIENCE_MISMATCH");
    }

    return payload;
  }

  throw new Error("GOOGLE_TOKEN_MISSING");
};

export const googleConfig = (req, res) => {
  const clientId = googleClientId();

  return res.status(200).json({
    enabled: Boolean(clientId),
    clientId,
  });
};

export const googleAuth = async (req, res) => {
  try {
    if (!googleClientId()) {
      return res.status(503).json({
        message: "Google sign-in is not configured yet.",
      });
    }

    const profile = await readGoogleProfile({
      accessToken: req.body?.accessToken,
      credential: req.body?.credential,
    });

    const email = String(profile.email || "").trim().toLowerCase();
    const googleId = String(profile.sub || "").trim();
    const emailVerified =
      profile.email_verified === true ||
      profile.email_verified === "true";

    if (!email || !googleId) {
      return res.status(401).json({
        message: "Google did not return a valid account.",
      });
    }

    if (!emailVerified) {
      return res.status(401).json({
        message: "Please verify your Google email first.",
      });
    }

    let isNewAccount = false;
    let user =
      (await prisma.user.findUnique({ where: { googleId } })) ||
      (await prisma.user.findUnique({ where: { email } }));

    if (user && (user.status === "SUSPENDED" || user.status === "BANNED")) {
      return res.status(403).json({
        message: `Your account is ${user.status.toLowerCase()}`,
      });
    }

    if (!user) {
      const hashedPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10
      );

      user = await prisma.user.create({
        data: {
          email,
          username: await uniqueGoogleUsername(profile.name, email),
          password: hashedPassword,
          googleId,
          avatar: profile.picture || null,
          emailVerified: true,
        },
      });
      isNewAccount = true;
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          emailVerified: true,
          avatar: user.avatar || profile.picture || null,
        },
      });
    } else if (user.googleId !== googleId) {
      return res.status(409).json({
        message:
          "This email already has a Google account. Use Continue with Google.",
        code: "GOOGLE_ACCOUNT",
      });
    }

    if (isNewAccount || !user.welcomeEmailSentAt) {
      sendWelcomeOnFirstSignIn(user).catch((error) => {
        console.error("WELCOME EMAIL ERROR:", error?.message || error);
      });
    }

    return issueAuthCookie(res, user);
  } catch (error) {
    console.log("GOOGLE AUTH ERROR:", error);

    if (sendUniqueConflict(res, error)) {
      return;
    }

    if (error.code === "P2002") {
      const message = uniqueTargetMessage(error);
      return res.status(409).json({
        message,
        code: /google/i.test(message) ? "GOOGLE_ACCOUNT" : "CONFLICT",
      });
    }

    if (isDatabaseConnectivityError(error)) {
      return databaseUnavailableResponse(res);
    }

    return res.status(401).json({
      message: "Google sign-in failed. Please try again.",
    });
  }
};

export const refreshSession = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET_KEY) {
      return res.status(500).json({ message: "JWT secret key is missing" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        code: "SESSION_EXPIRED",
        message: "Session expired. Please sign in again.",
      });
    }

    return issueAuthCookie(res, user);
  } catch (error) {
    console.log("REFRESH SESSION ERROR:", error);

    return res.status(401).json({
      code: "SESSION_EXPIRED",
      message: "Session expired. Please sign in again.",
    });
  }
};

export const logout = (req, res) => {
  const cookieOptions = getCookieOptions();

  res.clearCookie("token", cookieOptions);

  // Extra clear for browsers that ignore clearCookie mismatches
  res.cookie("token", "", {
    ...cookieOptions,
    expires: new Date(0),
    maxAge: 0,
  });

  return res.status(200).json({
    message: "Logout successful",
  });
};
