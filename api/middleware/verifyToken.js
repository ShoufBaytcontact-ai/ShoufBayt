import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { SESSION_IDLE_JWT } from "../lib/sessionIdle.js";

export const shouldBeLoggedIN = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      code: "NOT_LOGGED_IN",
      message: "You are not logged in!",
    });
  }

  if (!process.env.JWT_SECRET_KEY) {
    return res.status(500).json({ message: "JWT secret key is missing" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET_KEY,
    { maxAge: SESSION_IDLE_JWT },
    async (err, payload) => {
      if (err) {
        const expired =
          err.name === "TokenExpiredError" || /maxAge/i.test(err.message || "");

        return res.status(401).json({
          code: expired ? "SESSION_EXPIRED" : "INVALID_TOKEN",
          message: expired
            ? "Session expired. Please sign in again."
            : "Token is not valid!",
        });
      }

      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { id: true, role: true, status: true },
        });

        if (!user) {
          return res.status(401).json({
            code: "INVALID_TOKEN",
            message: "Token is not valid!",
          });
        }

        if (user.status !== "ACTIVE") {
          return res.status(401).json({
            code: "SESSION_EXPIRED",
            message: "Session expired. Please sign in again.",
          });
        }

        req.userId = user.id;
        req.userRole = user.role;
        return next();
      } catch (error) {
        console.error("AUTH CHECK ERROR:", error);
        return res.status(500).json({
          message: "Failed to verify session",
        });
      }
    }
  );
};
