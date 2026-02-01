import { google } from "googleapis";
import { CLOUD_CONFIG } from "../config/cloud.config.js";
import fs from "fs";

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initDrive();
  }

  initDrive() {
    const oauth2Client = new google.auth.OAuth2(
      CLOUD_CONFIG.googleDrive.clientId,
      CLOUD_CONFIG.googleDrive.clientSecret,
      CLOUD_CONFIG.googleDrive.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: CLOUD_CONFIG.googleDrive.refreshToken,
    });

    this.drive = google.drive({ version: "v3", auth: oauth2Client });
  }

  async upload(filePath, options = {}) {
    try {
      const fileName = options.fileName || filePath.split("/").pop();
      const fileMetadata = {
        name: fileName,
        parents: options.folderId ? [options.folderId] : [],
      };

      const media = {
        body: fs.createReadStream(filePath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, size, webViewLink, webContentLink",
      });

      return {
        url: response.data.webViewLink,
        fileId: response.data.id,
        name: response.data.name,
        size: response.data.size,
        downloadUrl: response.data.webContentLink,
      };
    } catch (error) {
      throw new Error(`Google Drive upload failed: ${error.message}`);
    }
  }

  async delete(fileId) {
    try {
      await this.drive.files.delete({ fileId });
      return { success: true };
    } catch (error) {
      throw new Error(`Google Drive delete failed: ${error.message}`);
    }
  }

  async getFile(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: "id, name, size, webViewLink, webContentLink",
      });
      return response.data;
    } catch (error) {
      throw new Error(`Google Drive get file failed: ${error.message}`);
    }
  }
}

export default new GoogleDriveService();
