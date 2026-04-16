import { DEFAULT_PORT } from "@aidais/shared";

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  llmProvider: string;
  llmModel: string;
  sttProvider: string;
  xaiApiKey?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  deepgramApiKey?: string;
  whisperApiKey?: string;
  whisperApiUrl?: string;
  whisperModel?: string;
}

function requireEnvForProvider(provider: string): void {
  const keyMap: Record<string, string> = {
    xai: "XAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
  };

  const envVar = keyMap[provider];
  if (!envVar) {
    throw new Error(
      `Unknown LLM provider: "${provider}". Supported: xai, anthropic, openai`
    );
  }

  if (!process.env[envVar]) {
    throw new Error(
      `LLM_PROVIDER is set to "${provider}" but ${envVar} is not set. ` +
        `Add ${envVar}=your_key to your .env file.`
    );
  }
}

export function loadConfig(): AppConfig {
  const llmProvider = process.env["LLM_PROVIDER"] ?? "xai";
  const sttProvider = process.env["STT_PROVIDER"] ?? "webspeech";

  requireEnvForProvider(llmProvider);

  if (sttProvider === "deepgram" && !process.env["DEEPGRAM_API_KEY"]) {
    throw new Error(
      "STT_PROVIDER is set to 'deepgram' but DEEPGRAM_API_KEY is not set."
    );
  }

  return {
    port: parseInt(process.env["PORT"] ?? String(DEFAULT_PORT), 10),
    nodeEnv: process.env["NODE_ENV"] ?? "development",
    corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
    llmProvider,
    llmModel: process.env["LLM_MODEL"] ?? getDefaultModel(llmProvider),
    sttProvider,
    xaiApiKey: process.env["XAI_API_KEY"],
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
    openaiApiKey: process.env["OPENAI_API_KEY"],
    deepgramApiKey: process.env["DEEPGRAM_API_KEY"],
    whisperApiKey: process.env["WHISPER_API_KEY"],
    whisperApiUrl: process.env["WHISPER_API_URL"],
    whisperModel: process.env["WHISPER_MODEL"],
  };
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "xai":
      return "grok-3";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "openai":
      return "gpt-4o";
    default:
      return "grok-3";
  }
}
