import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_CONFIG, FILE_PROMPTS } from "../config/gemini.config.js";
import { getFileMimeType, getFileExtension } from "../utils/fileHelpers.js";
import { Logger } from "../utils/logger.js";

export class GeminiService {
  constructor() {
    if (!GEMINI_CONFIG.API_KEY) {
      console.error("❌ GEMINI_API_KEY not found in environment variables");
      console.error("Current API_KEY value:", GEMINI_CONFIG.API_KEY);
      console.error("Please check your .env file location and ensure it's in the backend directory");
      throw new Error("GEMINI_API_KEY is not configured");
    }
    this.genAI = new GoogleGenerativeAI(GEMINI_CONFIG.API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: GEMINI_CONFIG.MODEL });
    Logger.success("Gemini API initialized successfully");
  }

  extractScore(analysisResult) {
    try {
      let cleanedResult = analysisResult.trim();

      // Remove markdown code blocks if present
      if (cleanedResult.startsWith("```")) {
        cleanedResult = cleanedResult.substring(3, cleanedResult.length - 3).trim();
        if (cleanedResult.toLowerCase().startsWith("json")) {
          cleanedResult = cleanedResult.substring(4).trim();
        }
      }

      // Try to parse as JSON
      try {
        const parsedResult = JSON.parse(cleanedResult);
        if (parsedResult && typeof parsedResult.importanceScore === "number") {
          return {
            score: parsedResult.importanceScore,
            summary:
              parsedResult.summary ||
              parsedResult.description ||
              parsedResult.assessment ||
              "No summary provided",
          };
        }
      } catch (jsonError) {
        Logger.info("JSON parsing failed, attempting plain text extraction");
      }

      // Fallback: try to extract score from text
      const match = cleanedResult.match(/importanceScore["']?:?\s*(\d+)/i);
      if (match && match[1]) {
        const score = parseInt(match[1], 10);
        if (!isNaN(score)) {
          return {
            score: score,
            summary: cleanedResult.substring(0, 200),
          };
        }
      }

      Logger.info("Could not extract importance score, full response:", analysisResult);
      return { score: -1, summary: "Analysis failed" };
    } catch (error) {
      Logger.error("Unexpected error in extractScore", error);
      return { score: -1, summary: "Error in analysis" };
    }
  }

  async analyzeFile(fileName, fileBuffer) {
    try {
      if (!this.model) {
        throw new Error("Gemini model not initialized");
      }

      const fileExtension = getFileExtension(fileName);

      if (!FILE_PROMPTS[fileExtension]) {
        return {
          isImportant: false,
          reason: `Unsupported file type: ${fileExtension}`,
          score: 0,
          decision: "UNSUPPORTED",
        };
      }

      const fileBase64 = fileBuffer.toString("base64");
      const mimeType = getFileMimeType(fileName);
      const prompt = FILE_PROMPTS[fileExtension];

      Logger.info("🔍 Analyzing file with Gemini...");
      Logger.info(`File: ${fileName}`);
      Logger.info(`Type: ${fileExtension}`);
      Logger.info(`MIME: ${mimeType}`);

      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: fileBase64,
          },
        },
      ];

      Logger.info("Sending request to Gemini API...");
      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const text = response.text();

      Logger.info("📝 Raw Gemini Response:");
      Logger.info(text);

      // Extract score and summary
      const { score: importanceScore, summary } = this.extractScore(text);

      if (importanceScore === -1) {
        throw new Error("Failed to extract importance score from Gemini response");
      }

      // Determine if important based on threshold
      const isImportant =
        importanceScore >= GEMINI_CONFIG.IMPORTANCE_THRESHOLD &&
        importanceScore <= 10;
      const decision = isImportant ? "IMPORTANT" : "NOT_IMPORTANT";

      Logger.analysis("FILE IMPORTANCE ANALYSIS", {
        File: fileName,
        Decision: decision,
        "Importance Score": `${importanceScore}/10`,
        Threshold: `${GEMINI_CONFIG.IMPORTANCE_THRESHOLD}/10`,
        Status: isImportant
          ? "✅ IMPORTANT (Score >= Threshold)"
          : "❌ NOT IMPORTANT (Score < Threshold)",
        "Reason/Summary": summary,
      });

      return {
        isImportant,
        reason: summary,
        score: importanceScore,
        decision,
      };
    } catch (error) {
      Logger.error("❌ Gemini API Error:");
      Logger.error("Error name:", error.name);
      Logger.error("Error message:", error.message);
      Logger.error("Error stack:", error.stack);

      if (error.message && error.message.includes("API key")) {
        Logger.error("API Key issue detected. Please check your GEMINI_API_KEY in .env");
      }

      return {
        isImportant: false,
        reason: `API Error: ${error.message}`,
        score: null,
        decision: "ERROR",
      };
    }
  }

  async analyzeEncryptedFallback(meta = {}) {
    // Meta-only analysis: avoids sending ciphertext to Gemini as a PDF/document
    const fileName = meta.fileName || meta.originalName || "unknown";
    const fileType = meta.fileType || meta.mimeType || "application/octet-stream";
    const fileSize = Number(meta.fileSize || meta.size || 0);

    const prompt = `
You are scoring whether a file should be stored in cloud storage.
Return JSON ONLY with:
- importanceScore (0-10 integer)
- importanceReason (string)

File metadata:
- name: ${fileName}
- type: ${fileType}
- sizeBytes: ${fileSize}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result?.response?.text?.() ?? "";
      // keep your existing JSON extraction logic if you already have it
      return this.parseImportanceResponse(text);
    } catch (e) {
      return {
        importanceScore: 0,
        importanceReason: `Gemini failed on encrypted upload (meta-only fallback). ${e?.message || ""}`.trim(),
      };
    }
  }
}

// Lazy initialization: create instance only when first accessed
let instance = null;

function getInstance() {
  if (!instance) {
    console.log("🚀 Initializing GeminiService instance...");
    instance = new GeminiService();
  }
  return instance;
}

// Export a Proxy that lazily creates the instance
export default new Proxy({}, {
  get(target, prop) {
    const service = getInstance();
    const value = service[prop];
    // If it's a function, bind it to the service instance
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  }
});