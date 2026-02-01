// IMPORTANT: Load environment variables FIRST before any other imports
// This ensures that modules which depend on env vars (like gemini.service.js)
// have access to them when they are initialized
import dotenv from "dotenv";
dotenv.config();



import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import uploadRoutes from "./routes/upload.routes.js";
import { APP_CONFIG } from "./config/app.config.js";
import { Logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

// Set up HBS
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.use("/api", uploadRoutes);

// Start server
app.listen(APP_CONFIG.PORT, () => {
  Logger.success(`Backend running on http://localhost:${APP_CONFIG.PORT}`);
});

export default app;