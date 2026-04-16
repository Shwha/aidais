import type { Persona } from "@aidais/shared";
import type { LLMProvider, StreamChunk } from "./providers/types.js";
import { logger } from "../middleware/logger.js";

export interface AgentResult {
  persona: Persona;
  messageId: string;
  chunks: AsyncIterable<StreamChunk>;
}

export async function runAgent(
  persona: Persona,
  transcript: string,
  model: string,
  provider: LLMProvider,
  signal: AbortSignal
): Promise<AgentResult> {
  const messageId = `${persona.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  logger.debug("agent_invoked", { persona: persona.id, messageId });
  logger.verbose("agent_worker_params", {
    persona: persona.id,
    messageId,
    model,
    provider: provider.id,
    temperature: persona.temperature,
    maxTokens: persona.maxTokens,
    transcriptLength: transcript.length,
    systemPromptLength: persona.systemPrompt.length,
  });

  const userContent = `Here is the latest segment of the podcast conversation:\n\n"${transcript}"\n\nProvide your reaction as ${persona.name} (${persona.displayName}).`;
  logger.verbose("agent_worker_prompt", { persona: persona.id, userContentPreview: userContent.slice(0, 200) });

  const chunks = provider.streamChat({
    model,
    systemPrompt: persona.systemPrompt,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: persona.temperature,
    maxTokens: persona.maxTokens,
    signal,
  });

  return { persona, messageId, chunks };
}
