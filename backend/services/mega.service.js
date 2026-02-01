import { Storage } from "megajs";

async function uploadFile(originalName, buffer) {
  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;
  if (!email || !password) throw new Error("Missing MEGA_EMAIL / MEGA_PASSWORD");

  const storage = new Storage({ email, password });

  await new Promise((resolve, reject) => {
    storage.on("ready", resolve);
    storage.on("error", reject);
  });

  const remote = await new Promise((resolve, reject) => {
    const up = storage.upload({ name: `${Date.now()}_${originalName}` }, buffer);
    up.on("complete", (file) => resolve(file));
    up.on("error", reject);
  });

  const shareUrl = await new Promise((resolve) => {
    remote.link((err, url) => resolve(err ? null : url));
  });

  storage.close?.();

  return { name: remote?.name, shareUrl, url: shareUrl };
}

export default { uploadFile };
