import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

let r2Client = null;

const trim = (value) => String(value || "").trim();

const getAccountId = () => {
  let value = trim(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID);
  const fromUrl = value.match(
    /https?:\/\/([a-z0-9]+)(?:\.[a-z0-9-]+)?\.r2\.cloudflarestorage\.com/i
  );
  if (fromUrl) {
    return fromUrl[1];
  }

  value = value.replace(/^https?:\/\//i, "").split("/")[0];
  if (value.endsWith(".r2.cloudflarestorage.com")) {
    return value.split(".")[0];
  }

  return value;
};
const getAccessKey = () =>
  trim(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  );
const getSecretKey = () =>
  trim(
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY
  );
const getBucket = () =>
  trim(process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET).toLowerCase();
const getPublicUrl = () =>
  trim(process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL).replace(
    /\/+$/,
    ""
  );
const getRootFolder = () =>
  trim(process.env.CLOUDFLARE_R2_FOLDER || process.env.R2_FOLDER || "shoufbayt") ||
  "shoufbayt";

export const isR2Enabled = () =>
  Boolean(
    getAccountId() &&
      getAccessKey() &&
      getSecretKey() &&
      getBucket() &&
      getPublicUrl()
  );

export const isCloudStorageEnabled = isR2Enabled;

const getR2Client = () => {
  if (!isR2Enabled()) {
    return null;
  }

  if (r2Client) {
    return r2Client;
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${getAccountId()}.r2.cloudflarestorage.com`,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: getAccessKey(),
      secretAccessKey: getSecretKey(),
    },
  });

  return r2Client;
};

export const isCloudAssetUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") {
      return false;
    }

    const host = url.hostname.toLowerCase();
    if (host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com")) {
      return true;
    }

    const publicHost = getPublicUrl()
      ? new URL(getPublicUrl()).hostname.toLowerCase()
      : "";

    return Boolean(publicHost && host === publicHost);
  } catch {
    return false;
  }
};

const folderFor = (kind, file) => {
  const root = getRootFolder();
  if (kind === "chat") {
    return `${root}/chat`;
  }

  const field = String(file?.fieldname || "");
  if (field === "avatar") {
    return `${root}/avatars`;
  }
  if (field === "proof") {
    return `${root}/receipts`;
  }
  if (field === "image") {
    return `${root}/agents`;
  }

  return `${root}/listings`;
};

const safeExt = (file) => {
  const fromName = path.extname(file?.originalname || "").toLowerCase();
  if (fromName && fromName.length <= 8 && /^\.[a-z0-9.]+$/.test(fromName)) {
    return fromName;
  }

  const mime = String(file?.mimetype || "").split(";")[0].trim().toLowerCase();
  const byMime = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
  };

  return byMime[mime] || "";
};

const objectKeyFor = (kind, file) => {
  const folder = folderFor(kind, file);
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt(file)}`;
  return `${folder}/${unique}`.replace(/\\/g, "/");
};

const publicUrlFor = (key) =>
  `${getPublicUrl()}/${String(key).replace(/^\/+/, "")}`;

const bufferFromStream = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });

export const getStoredFileUrl = (req, file) => {
  if (!file) {
    return "";
  }

  if (file.secure_url && /^https:\/\//i.test(file.secure_url)) {
    return file.secure_url;
  }

  if (file.url && /^https:\/\//i.test(file.url)) {
    return file.url;
  }

  if (file.path && /^https:\/\//i.test(file.path)) {
    return file.path;
  }

  return "";
};

export const formatStorageError = (error) => {
  const code = String(error?.name || error?.Code || error?.code || "");
  const message = String(error?.message || error || "");

  if (/access.?denied/i.test(message) || /AccessDenied/i.test(code)) {
    return "Cloudflare storage rejected the upload. In api/.env, set CLOUDFLARE_R2_BUCKET to the exact lowercase bucket name from the R2 dashboard, and use an R2 API token with Object Read & Write on that bucket.";
  }

  if (/NoSuchBucket/i.test(code) || /specified bucket/i.test(message)) {
    return "Cloudflare bucket was not found. Check CLOUDFLARE_R2_BUCKET.";
  }

  return message || "Image upload failed";
};

export const requireR2Upload = (req, res, next) => {
  if (!isR2Enabled()) {
    return res.status(503).json({
      message:
        "Cloud uploads are not configured. Add Cloudflare R2 keys in api/.env",
    });
  }

  return next();
};

export const createR2Storage = (kind = "listings") => {
  return {
    _handleFile(req, file, cb) {
      const client = getR2Client();
      if (!client) {
        return cb(new Error("Cloudflare R2 is not configured"));
      }

      const key = objectKeyFor(kind, file);

      bufferFromStream(file.stream)
        .then((body) =>
          client
            .send(
              new PutObjectCommand({
                Bucket: getBucket(),
                Key: key,
                Body: body,
                ContentLength: body.length,
                ContentType: file.mimetype || "application/octet-stream",
              })
            )
            .then(() => body)
        )
        .then((body) => {
          const url = publicUrlFor(key);
          file.secure_url = url;
          file.url = url;
          file.public_id = key;

          cb(null, {
            path: url,
            filename: key,
            destination: folderFor(kind, file),
            size: body.length,
          });
        })
        .catch((error) => {
          console.error("R2 UPLOAD ERROR:", error?.name || error?.Code, error?.message);
          cb(error);
        });
    },

    _removeFile(req, file, cb) {
      const client = getR2Client();
      const key = file.public_id || file.filename;
      if (!client || !key) {
        return cb(null);
      }

      client
        .send(
          new DeleteObjectCommand({
            Bucket: getBucket(),
            Key: key,
          })
        )
        .then(() => cb(null))
        .catch(() => cb(null));
    },
  };
};

export const createUploadStorage = (kind) => createR2Storage(kind);
