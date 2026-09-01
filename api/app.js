import "./lib/dnsIPv4.js";
import "./lib/loadEnv.js";
import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import userroute from "./routes/user.route.js";
import postroute from "./routes/post.route.js";
import authroute from "./routes/auth.route.js";
import chatroute from "./routes/chat.route.js";
import messageroute from "./routes/message.route.js";
import adminroute from "./routes/admin.route.js";
import publicroute from "./routes/public.route.js";
import contactroute from "./routes/contact.route.js";
import agentroute from "./routes/agent.route.js";
import airoute from "./routes/ai.route.js";
import subscriptionroute from "./routes/subscription.route.js";
import paymentroute from "./routes/payment.route.js";
import notificationroute from "./routes/notification.route.js";
import reportroute from "./routes/report.route.js";
import reviewroute from "./routes/review.route.js";
import listingRequestroute from "./routes/listingRequest.route.js";
import appointmentroute from "./routes/appointment.route.js";
import { startVisitReminderJob } from "./lib/visitReminderJob.js";
import { startAutoRenewJob } from "./lib/autoRenewJob.js";
import { startSubscriptionExpiryReminderJob } from "./lib/subscriptionExpiryReminderJob.js";
import { startLaunchPeriodEmailJob } from "./lib/launchPeriodEmailJob.js";
import { restoreListingsForActiveAgents } from "./lib/subscription.js";
import { ensurePropertySearchIndexes } from "./lib/ensureSearchIndexes.js";
import { ensureUniqueIndexes } from "./lib/ensureUniqueIndexes.js";
import { initRealtime } from "./lib/realtime.js";
import { stripeWebhook } from "./controllers/payment.controller.js";
import { isR2Enabled } from "./lib/cloudStorage.js";
import { shouldBeLoggedIN } from "./middleware/verifyToken.js";
import { savePhone } from "./controllers/phone.controller.js";
import {
  clearMyAnsweredContactMessages,
  updateMyContactMessage,
  deleteMyContactMessage,
} from "./controllers/contact.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 8800;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const CLIENT_URLS = [
  CLIENT_URL,
  "http://localhost:3000",
  process.env.RENDER_EXTERNAL_URL,
].filter((url, index, arr) => url && arr.indexOf(url) === index);

const frontendCandidates = [
  path.join(__dirname, "client-build"),
  path.join(__dirname, "..", "build"),
  path.join(process.cwd(), "build"),
  path.join(process.cwd(), "..", "build"),
];

const frontendDir =
  frontendCandidates.find((dir) => fs.existsSync(path.join(dir, "index.html"))) ||
  "";
const frontendIndex = frontendDir ? path.join(frontendDir, "index.html") : "";
const serveFrontend = Boolean(frontendIndex);

if (!serveFrontend) {
  console.warn("Website build not found. Looked in:", frontendCandidates.join(" | "));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CLIENT_URLS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Stripe needs the raw body for signature verification
app.post(
  "/api/payments/webhook/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".webm")) {
        res.setHeader("Content-Type", "audio/webm");
      }
      if (filePath.endsWith(".m4a")) {
        res.setHeader("Content-Type", "audio/mp4");
      }
      if (filePath.endsWith(".wav")) {
        res.setHeader("Content-Type", "audio/wav");
      }
    },
  })
);

if (!serveFrontend) {
  app.get("/", (req, res) => {
    res.status(200).json({
      message: "ShoufBayt API",
    });
  });
}

app.use("/api/auth", authroute);
app.post("/api/users/phone", shouldBeLoggedIN, savePhone);
app.post("/api/users/phone/request", shouldBeLoggedIN, savePhone);
app.put("/api/users/phone", shouldBeLoggedIN, savePhone);
app.use("/api/users", userroute);
app.use("/api/posts", postroute);
app.use("/api/properties", postroute);
app.use("/api/chats", chatroute);
app.use("/api/messages", messageroute);
app.use("/api/admin", adminroute);
app.use("/api/public", publicroute);
app.use("/api/contact", contactroute);
app.post(
  "/api/contact/clear-tracking",
  shouldBeLoggedIN,
  clearMyAnsweredContactMessages
);
app.put(
  "/api/contact/my-messages/:id",
  shouldBeLoggedIN,
  updateMyContactMessage
);
app.post(
  "/api/contact/my-messages/:id/remove",
  shouldBeLoggedIN,
  deleteMyContactMessage
);
app.use("/api/agents", agentroute);
app.use("/api/ai", airoute);
app.use("/api/subscriptions", subscriptionroute);
app.use("/api/payments", paymentroute);
app.use("/api/notifications", notificationroute);
app.use("/api/reports", reportroute);
app.use("/api/reviews", reviewroute);
app.use("/api/listing-requests", listingRequestroute);
app.use("/api/appointments", appointmentroute);

if (serveFrontend) {
  app.use(express.static(frontendDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }
    return res.sendFile(frontendIndex);
  });
}

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.log("SERVER ERROR:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

const httpServer = http.createServer(app);

initRealtime(httpServer, { clientUrls: CLIENT_URLS });

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. The API is probably already running.`
    );
    process.exit(1);
  }

  throw error;
});

httpServer.listen(PORT, () => {
  const googleId = String(
    process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || ""
  )
    .trim()
    .replace(/^["']|["']$/g, "");

  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO realtime attached on port ${PORT}`);
  console.log(
    serveFrontend
      ? "Website: serving React build from /"
      : "Website: not bundled (run npm run build in the repo root)"
  );
  console.log(
    googleId
      ? "Google sign-in: enabled"
      : "Google sign-in: missing GOOGLE_CLIENT_ID in api/.env"
  );
  console.log(
    isR2Enabled()
      ? "Image uploads: Cloudflare R2"
      : "Image uploads: Cloudflare R2 is missing keys in api/.env"
  );
  startVisitReminderJob();
  startAutoRenewJob();
  startSubscriptionExpiryReminderJob();
  startLaunchPeriodEmailJob();
  restoreListingsForActiveAgents().catch((error) => {
    console.error("Failed to restore agent listings on startup:", error);
  });
  ensurePropertySearchIndexes().catch((error) => {
    console.error("Failed to ensure property search indexes:", error);
  });
  ensureUniqueIndexes().catch((error) => {
    console.error("Failed to ensure unique indexes:", error);
  });
});
