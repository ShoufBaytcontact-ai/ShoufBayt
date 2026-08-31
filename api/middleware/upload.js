import multer from "multer";
import { createUploadStorage } from "../lib/cloudStorage.js";

const storage = createUploadStorage("listings");

const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image files are allowed: JPG, PNG, JPEG, or WEBP."),
      false
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 20,
  },
});
