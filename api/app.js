import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import userroute from "./routes/user.route.js";
import postroute from "./routes/post.route.js";
import authroute from "./routes/auth.route.js";
import testroute from "./routes/test.route.js";
import chatroute from "./routes/chat.route.js";
import messageroute from "./routes/message.route.js";
import adminroute from "./routes/admin.route.js";
import contactroute from "./routes/contact.route.js";
import agentroute from "./routes/agent.route.js";
import airoute from "./routes/ai.route.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env"),
});

const app = express();
const PORT = process.env.PORT || 8800;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authroute);
app.use("/api/users", userroute);
app.use("/api/posts", postroute);
app.use("/api/chats", chatroute);
app.use("/api/messages", messageroute);
app.use("/api/admin", adminroute);
app.use("/api/contact", contactroute);
app.use("/api/agents", agentroute);
app.use("/api/ai", airoute);
app.use("/api/test", testroute);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Backend is working",
    port: PORT,
  });
});

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});