import axios from "axios";
import { APP_CONFIG } from "../config/app.config.js";
import { Logger } from "../utils/logger.js";

class DropboxService {
  constructor() {
    this.accessToken = APP_CONFIG.DROPBOX_ACCESS_TOKEN;
    this.uploadPath = APP_CONFIG.DROPBOX_UPLOAD_PATH;
  }

  async uploadFile(fileName, fileBuffer) {
    try {
      Logger.info("☁️  Uploading file to Dropbox...");

      const uploadResponse = await axios.post(
        "https://content.dropboxapi.com/2/files/upload",
        fileBuffer,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: `${this.uploadPath}/${fileName}`,
              mode: "add",
              autorename: true,
            }),
            "Content-Type": "application/octet-stream",
          },
        }
      );

      return uploadResponse.data;
    } catch (error) {
      Logger.error("Dropbox upload failed", error.response?.data || error.message);
      throw error;
    }
  }

  async createShareLink(filePath) {
    try {
      const shareLinkResponse = await axios.post(
        "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
        {
          path: filePath,
          settings: {
            requested_visibility: "public",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const shareUrl = shareLinkResponse.data.url;
      const directUrl = shareUrl
        .replace("www.dropbox.com", "dl.dropboxusercontent.com")
        .replace("?dl=0", "");

      return { shareUrl, directUrl };
    } catch (error) {
      // Handle "shared_link_already_exists" error
      if (error.response?.data?.error?.['.tag'] === 'shared_link_already_exists') {
        Logger.info("⚠️ Shared link already exists, retrieving existing link...");
        try {
          const listLinksResponse = await axios.post(
            "https://api.dropboxapi.com/2/sharing/list_shared_links",
            { path: filePath },
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (listLinksResponse.data.links && listLinksResponse.data.links.length > 0) {
            const shareUrl = listLinksResponse.data.links[0].url;
            const directUrl = shareUrl
              .replace("www.dropbox.com", "dl.dropboxusercontent.com")
              .replace("?dl=0", "");
            return { shareUrl, directUrl };
          }
        } catch (listError) {
          Logger.error("Failed to retrieve existing shared link", listError.response?.data || listError.message);
        }
      }

      Logger.error("Failed to create share link", error.response?.data || error.message);
      throw error;
    }
  }
}

// Lazy initialization: create instance only when first accessed
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new DropboxService();
  }
  return instance;
}

export default new Proxy({}, {
  get(target, prop) {
    const service = getInstance();
    const value = service[prop];
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  }
});