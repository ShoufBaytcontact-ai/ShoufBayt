import multer from "multer";
import path from "path";
import { cleanOriginalName } from "../lib/chatSecurity.js";
import { createUploadStorage } from "../lib/cloudStorage.js";

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VOICE_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/mp3",
]);

const FILE_MIMES = new Set(["application/pdf", ...IMAGE_MIMES]);

const ALL_ALLOWED = new Set([...IMAGE_MIMES, ...VOICE_MIMES, ...FILE_MIMES]);

const DANGEROUS_EXT = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".js",
  ".mjs",
  ".html",
  ".htm",
  ".svg",
  ".php",
  ".sh",
  ".com",
  ".msi",
]);

export function classifyChatMime(mime) {
  const m = String(mime || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (VOICE_MIMES.has(m) || m.startsWith("audio/")) return "voice";
  if (IMAGE_MIMES.has(m)) return "image";
  if (m === "application/pdf") return "file";
  return null;
}

const storage = createUploadStorage("chat");

const fileFilter = (req, file, cb) => {
  const mime = String(file.mimetype || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (DANGEROUS_EXT.has(ext)) {
    return cb(new Error("This file extension is not allowed"), false);
  }

  if (!ALL_ALLOWED.has(mime) && !mime.startsWith("audio/")) {
    return cb(
      new Error(
        "Only images, voice notes (audio), and PDF files are allowed in chat"
      ),
      false
    );
  }

  file.cleanedOriginalName = cleanOriginalName(file.originalname);
  return cb(null, true);
};

export const chatUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

export const chatUploadSingle = (req, res, next) => {
  chatUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.message || "Upload failed",
      });
    }
    return next();
  });
};
