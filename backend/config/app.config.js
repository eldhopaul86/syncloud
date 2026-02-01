export const APP_CONFIG = {
  get PORT() { return process.env.PORT || 4000; },
  get DROPBOX_ACCESS_TOKEN() { return process.env.DROPBOX_ACCESS_TOKEN; },
  DROPBOX_UPLOAD_PATH: "/SynCloud",
};