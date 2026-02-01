import geminiService from "../services/gemini.service.js";
import dropboxService from "../services/dropbox.service.js";
import cloudinaryService from "../services/cloudinary.service.js";
import megaService from "../services/mega.service.js";
import { GEMINI_CONFIG } from "../config/gemini.config.js";
import { Logger } from "../utils/logger.js";

export async function uploadToDropbox(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Check file importance with Gemini
    const importanceCheck = await geminiService.analyzeFile(
      req.file.originalname,
      req.file.buffer
    );

    if (!importanceCheck.isImportant) {
      Logger.info("⛔ Upload rejected - File not important enough\n");
      return res.status(400).json({
        error: "File deemed not important for cloud storage",
        reason: importanceCheck.reason,
        score: importanceCheck.score,
        threshold: GEMINI_CONFIG.IMPORTANCE_THRESHOLD,
        decision: importanceCheck.decision,
        rejected: true,
      });
    }

    // Upload file to Dropbox
    const uploadedFile = await dropboxService.uploadFile(
      req.file.originalname,
      req.file.buffer
    );

    // Create shared link
    const { shareUrl, directUrl } = await dropboxService.createShareLink(
      uploadedFile.path_display
    );

    Logger.success("File uploaded successfully to Dropbox\n");

    res.json({
      success: true,
      file: uploadedFile,
      shareUrl,
      directUrl,
      importanceReason: importanceCheck.reason,
      importanceScore: importanceCheck.score,
      threshold: GEMINI_CONFIG.IMPORTANCE_THRESHOLD,
      decision: importanceCheck.decision,
    });
  } catch (err) {
    Logger.error("Upload failed", err.response?.data || err.message);

    const errorMessage =
      err.response?.data?.error_summary ||
      err.response?.data?.error ||
      err.message ||
      "Upload failed";

    res.status(500).json({
      error: errorMessage,
      details: err.response?.data,
    });
  }
}

function normalizeCloud(v) {
  const x = String(v || "").toLowerCase().trim();
  if (x === "dropbox" || x === "cloudinary" || x === "mega") return x;
  return null;
}

async function uploadViaProvider(cloud, file) {
  if (cloud === "dropbox") {
    const uploadedFile = await dropboxService.uploadFile(file.originalname, file.buffer);
    const { shareUrl, directUrl } = await dropboxService.createShareLink(uploadedFile.path_display);
    return { file: uploadedFile, shareUrl, directUrl };
  }

  if (cloud === "cloudinary") {
    // NOTE: assumes your cloudinary.service.js exposes uploadFile(name, buffer, mimetype?)
    const uploadedFile = await cloudinaryService.uploadFile(file.originalname, file.buffer, file.mimetype);

    // Try common return shapes
    const shareUrl =
      uploadedFile?.secure_url ||
      uploadedFile?.url ||
      uploadedFile?.shareUrl ||
      null;

    return { file: uploadedFile, shareUrl, directUrl: shareUrl };
  }

  if (cloud === "mega") {
    // NOTE: assumes your mega.service.js exposes uploadFile(name, buffer)
    const uploadedFile = await megaService.uploadFile(file.originalname, file.buffer);

    const shareUrl =
      uploadedFile?.shareUrl ||
      uploadedFile?.url ||
      null;

    return { file: uploadedFile, shareUrl, directUrl: shareUrl };
  }

  throw new Error(`Unsupported cloud: ${cloud}`);
}

export async function uploadToSelectedCloud(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const cloud = normalizeCloud(req.body?.cloud) || normalizeCloud(process.env.CLOUD_PLATFORM) || "dropbox";

    // Check file importance with Gemini (same logic as before)
    const importanceCheck = await geminiService.analyzeFile(
      req.file.originalname,
      req.file.buffer
    );

    if (!importanceCheck.isImportant) {
      Logger.info("⛔ Upload rejected - File not important enough\n");
      return res.status(400).json({
        error: "File deemed not important for cloud storage",
        reason: importanceCheck.reason,
        score: importanceCheck.score,
        threshold: GEMINI_CONFIG.IMPORTANCE_THRESHOLD,
        decision: importanceCheck.decision,
        rejected: true,
        cloud,
      });
    }

    const uploaded = await uploadViaProvider(cloud, req.file);

    Logger.success(`File uploaded successfully to ${cloud}\n`);

    return res.json({
      success: true,
      cloud,
      file: uploaded.file,
      shareUrl: uploaded.shareUrl,
      directUrl: uploaded.directUrl,
      importanceReason: importanceCheck.reason,
      importanceScore: importanceCheck.score,
      threshold: GEMINI_CONFIG.IMPORTANCE_THRESHOLD,
      decision: importanceCheck.decision,
    });
  } catch (err) {
    Logger.error("Upload failed", err?.response?.data || err?.message);

    const errorMessage =
      err?.response?.data?.error_summary ||
      err?.response?.data?.error ||
      err?.message ||
      "Upload failed";

    return res.status(500).json({
      error: errorMessage,
      details: err?.response?.data,
    });
  }
}
