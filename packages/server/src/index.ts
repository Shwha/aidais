import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Load .env from project root
loadDotenv({ path: resolve(import.meta.dirname, "../../../.env") });

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { loadConfig } from "./config.js";
import {
  corsMiddleware,
  securityHeaders,
  rateLimiter,
} from "./middleware/security.js";
import { requestLogger, logger } from "./middleware/logger.js";
import { health } from "./routes/health.js";
import { registerWebSocket } from "./routes/ws.js";
import { createProvider } from "./services/providers/registry.js";
import { AgentService } from "./services/agent.service.js";
import { TranscriptionService } from "./services/transcription.service.js";

// --- Load and validate configuration ---
const config = loadConfig();

// --- Initialize LLM provider ---
const provider = createProvider(config);
const agentService = new AgentService(provider, config.llmModel);

// --- Initialize transcription (optional — requires WHISPER_API_KEY) ---
let transcriptionService: TranscriptionService | null = null;
if (config.whisperApiKey) {
  transcriptionService = new TranscriptionService(
    config.whisperApiKey,
    config.whisperApiUrl,
    config.whisperModel
  );
} else {
  logger.info("transcription_disabled", {
    reason: "WHISPER_API_KEY not set — audio chunks will not be transcribed",
  });
}

// --- Create Hono app ---
const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// --- Middleware ---
app.use("*", requestLogger());
app.use("*", corsMiddleware(config.corsOrigin));
app.use("*", securityHeaders());
app.use("/api/*", rateLimiter());

// --- Routes ---
app.route("/", health);
registerWebSocket(app, upgradeWebSocket, config, agentService, transcriptionService);

// --- Start server ---
const server = serve(
  { fetch: app.fetch, port: config.port },
  (info) => {
    logger.info("server_started", {
      port: info.port,
      env: config.nodeEnv,
      llm_provider: config.llmProvider,
      llm_model: config.llmModel,
      stt_provider: config.sttProvider,
    });
    console.log(`\n  AIDAIS server running at http://localhost:${info.port}`);
    console.log(`  LLM: ${provider.name} (${config.llmModel})`);
    console.log(`  STT: ${transcriptionService ? "Whisper (" + (config.whisperModel ?? "whisper-large-v3") + ")" : "webspeech (mic only)"}\n`);
  }
);

injectWebSocket(server);

// --- Graceful shutdown ---
function shutdown(signal: string) {
  logger.info("server_shutting_down", { signal });
  server.close(() => {
    logger.info("server_stopped");
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
