import type { WSContext } from "hono/ws";
import type { Persona, PersonaId } from "@aidais/shared";
import { getActivePersonas } from "@aidais/shared";
import type { LLMProvider } from "./providers/types.js";
import { runAgent } from "./agent-worker.js";
import { logger } from "../middleware/logger.js";

export class AgentService {
  private provider: LLMProvider;
  private model: string;
  private activePersonas: Persona[];

  constructor(provider: LLMProvider, model: string, personaIds?: PersonaId[]) {
    this.provider = provider;
    this.model = model;
    this.activePersonas = getActivePersonas(personaIds);
  }

  async processTranscript(
    transcript: string,
    ws: WSContext,
    signal: AbortSignal
  ): Promise<void> {
    if (!transcript.trim()) return;

    logger.debug("agents_processing", {
      transcript_length: transcript.length,
      persona_count: this.activePersonas.length,
    });

    // Fan out to all personas in parallel
    const agentPromises = this.activePersonas.map(async (persona) => {
      try {
        const result = await runAgent(
          persona,
          transcript,
          this.model,
          this.provider,
          signal
        );

        let fullText = "";

        for await (const chunk of result.chunks) {
          if (signal.aborted) return;

          fullText += chunk.delta;

          ws.send(
            JSON.stringify({
              type: "agent_response",
              persona: persona.id,
              messageId: result.messageId,
              text: fullText,
              delta: chunk.delta,
              isComplete: chunk.isComplete,
              timestamp: Date.now(),
            })
          );
        }

        // If the stream ended without an explicit isComplete, send one
        if (fullText && !fullText.endsWith("")) {
          ws.send(
            JSON.stringify({
              type: "agent_response",
              persona: persona.id,
              messageId: result.messageId,
              text: fullText,
              delta: "",
              isComplete: true,
              timestamp: Date.now(),
            })
          );
        }

        logger.debug("agent_completed", {
          persona: persona.id,
          messageId: result.messageId,
          response_length: fullText.length,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        logger.error("agent_failed", {
          persona: persona.id,
          error: err instanceof Error ? err.message : String(err),
        });

        ws.send(
          JSON.stringify({
            type: "error",
            code: "AGENT_ERROR",
            message: `${persona.displayName} encountered an error`,
          })
        );
      }
    });

    await Promise.allSettled(agentPromises);
  }
}
