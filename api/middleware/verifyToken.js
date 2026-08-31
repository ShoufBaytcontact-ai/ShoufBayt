import jwt from "jsonwebtoken";
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
    (err, payload) => {
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

      req.userId = payload.id;
      req.userRole = payload.role;

      next();
    }
  );
};
