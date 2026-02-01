import { v2 as cloudinary } from "cloudinary";

function ensureConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

/**
 * Standard interface used by upload.controller.js
 * @param {string} originalName
 * @param {Buffer} buffer
 * @param {string} mimetype
 */
async function uploadFile(originalName, buffer, mimetype = "application/octet-stream") {
  ensureConfigured();

  const isImage = typeof mimetype === "string" && mimetype.startsWith("image/");
  const resourceType = isImage ? "image" : "raw"; // raw supports pdf/docx/xlsx/etc.

  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: "syncloud",
        public_id: `${Date.now()}_${originalName}`.replace(/[^\w.\-]+/g, "_"),
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

export default { uploadFile };
