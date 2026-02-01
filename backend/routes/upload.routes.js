import express from "express";
import multer from "multer";
import { uploadToSelectedCloud } from "../controllers/upload.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function validateCloud(req, res, next) {
  const cloud = String(req.body?.cloud || "").toLowerCase().trim();
  if (!cloud) return res.status(400).json({ error: "cloud is required" });
  if (!["dropbox", "cloudinary", "mega"].includes(cloud)) {
    return res.status(400).json({ error: "Invalid cloud. Use dropbox|cloudinary|mega" });
  }
  next();
}

router.post("/upload", upload.single("file"), validateCloud, uploadToSelectedCloud);

export default router;