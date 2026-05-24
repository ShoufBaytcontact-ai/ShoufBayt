import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { sendLoginCodeEmail } from "../lib/sendEmail.js";;

export const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters, uppercase, lowercase, number, and special character",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingEmail = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingEmail) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      },
    });

    const { password: userPassword, ...userInfo } = newUser;

    return res.status(201).json(userInfo);
  } catch (error) {
    console.log("REGISTER ERROR:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Email already exists",
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

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    await prisma.loginVerificationCode.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.loginVerificationCode.create({
      data: {
        email: user.email,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        userId: user.id,
      },
    });

    await sendLoginCodeEmail(user.email, code);

    return res.status(200).json({
      message: "Verification code sent to your email",
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Failed to login",
      error: error.message,
    });
  }
};

export const verifyLoginCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid verification code" });
    }

    const loginCode = await prisma.loginVerificationCode.findFirst({
      where: {
        userId: user.id,
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
      return res.status(400).json({ message: "Code expired or invalid" });
    }

    if (loginCode.attempts >= 5) {
      await prisma.loginVerificationCode.update({
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

    const isCodeValid = await bcrypt.compare(code, loginCode.codeHash);

    if (!isCodeValid) {
      await prisma.loginVerificationCode.update({
        where: {
          id: loginCode.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({ message: "Invalid verification code" });
    }

    await prisma.loginVerificationCode.update({
      where: {
        id: loginCode.id,
      },
      data: {
        used: true,
      },
    });

    const token = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "7d",
      }
    );

    const { password: userPassword, ...userInfo } = user;

    res
      .cookie("token", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
      .status(200)
      .json(userInfo);
  } catch (error) {
    console.log("VERIFY LOGIN CODE ERROR:", error);
    res.status(500).json({ message: "Failed to verify login code" });
  }
};
export const resendLoginCode = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
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

    await prisma.loginVerificationCode.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.loginVerificationCode.create({
      data: {
        email: user.email,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        userId: user.id,
      },
    });

    await sendLoginCodeEmail(user.email, code);

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
export const logout = (req, res) => {
  res
    .clearCookie("token", {
      sameSite: "lax",
    })
    .status(200)
    .json({ message: "Logout successful" });
};