import type { LLMProvider } from "./types.js";
import type { AppConfig } from "../../config.js";
import { XAIProvider } from "./xai.provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OpenAIProvider } from "./openai.provider.js";
import { logger } from "../../middleware/logger.js";

type ProviderFactory = (config: AppConfig) => LLMProvider;

const factories = new Map<string, ProviderFactory>();

factories.set("xai", (config) => {
  if (!config.xaiApiKey) throw new Error("XAI_API_KEY is required");
  return new XAIProvider(config.xaiApiKey);
});

factories.set("anthropic", (config) => {
  if (!config.anthropicApiKey)
    throw new Error("ANTHROPIC_API_KEY is required");
  return new AnthropicProvider(config.anthropicApiKey);
});

factories.set("openai", (config) => {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required");
  return new OpenAIProvider(config.openaiApiKey);
});

export function createProvider(config: AppConfig): LLMProvider {
  const factory = factories.get(config.llmProvider);
  if (!factory) {
    throw new Error(
      `Unknown LLM provider: "${config.llmProvider}". ` +
        `Supported: ${[...factories.keys()].join(", ")}`
    );
  }

  const provider = factory(config);
  logger.info("llm_provider_initialized", {
    provider: provider.id,
    name: provider.name,
    model: config.llmModel,
  });
  return provider;
}

export function registerProvider(id: string, factory: ProviderFactory): void {
  factories.set(id, factory);
}
