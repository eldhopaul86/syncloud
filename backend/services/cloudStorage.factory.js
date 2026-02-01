import { CLOUD_CONFIG } from "../config/cloud.config.js";
import dropboxService from "./dropbox.service.js";
import cloudinaryService from "./cloudinary.service.js";
import megaService from "./mega.service.js";
import googleDriveService from "./googledrive.service.js";

function normalizeCloud(v) {
  const x = String(v || "").toLowerCase().trim();
  if (x === "dropbox" || x === "cloudinary" || x === "mega" || x === "googledrive") return x;
  return null;
}

// CHANGED: accept runtime selection, fallback to env
export function getCloudStorageService(requestedCloud) {
  const cloud =
    normalizeCloud(requestedCloud) ||
    normalizeCloud(process.env.CLOUD_PLATFORM) ||
    "dropbox";

  switch (cloud) {
    case "dropbox":
      return dropboxService;
    case "cloudinary":
      return cloudinaryService;
    case "mega":
      return megaService;
    case "googledrive":
      return googleDriveService;
    default:
      return dropboxService;
  }
}

class CloudStorageFactory {
  getService() {
    const platform = CLOUD_CONFIG.platform.toLowerCase();

    switch (platform) {
      case "cloudinary":
        return cloudinaryService;
      case "mega":
        return megaService;
      case "googledrive":
      case "google-drive":
        return googleDriveService;
      default:
        throw new Error(`Unsupported cloud platform: ${platform}`);
    }
  }
}

export default new CloudStorageFactory();
