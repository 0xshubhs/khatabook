import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { env } from "../env";
import { ApiError, asyncHandler } from "../middleware/error";

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${randomUUID()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    // Accept images and PDFs (bills can be either).
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    cb(null, ok);
  },
});

export const uploadsRouter = Router();

// POST /uploads (multipart field "file") -> { attachmentUrl }
uploadsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No image file uploaded (field 'file')");
    res.status(201).json({ attachmentUrl: `${env.publicUrl}/uploads/${req.file.filename}` });
  }),
);
