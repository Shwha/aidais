import type { WSContext } from "hono/ws";
import type { Persona, PersonaId, ChaosAgentMode } from "@aidais/shared";
import { getActivePersonas } from "@aidais/shared";
import type { LLMProvider } from "./providers/types.js";
import { runAgent } from "./agent-worker.js";
import { logger } from "../middleware/logger.js";

export class AgentService {
  private provider: LLMProvider;
  private model: string;
  private personaIds?: PersonaId[];
  private chaosMode: ChaosAgentMode = "chaos";

  constructor(provider: LLMProvider, model: string, personaIds?: PersonaId[]) {
    this.provider = provider;
    this.model = model;
    this.personaIds = personaIds;
  }

  setChaosMode(mode: ChaosAgentMode): void {
    this.chaosMode = mode;
    logger.verbose("agent_service_chaos_mode", { mode });
  }

  async processTranscript(
    transcript: string,
    ws: WSContext,
    signal: AbortSignal,
    chaosMode?: ChaosAgentMode
  ): Promise<void> {
    const activePersonas = getActivePersonas(
      this.personaIds,
      chaosMode ?? this.chaosMode
    );
    if (!transcript.trim()) {
      logger.verbose("agents_skipped_empty_transcript");
      return;
    }

    logger.debug("agents_processing", {
      transcript_length: transcript.length,
      persona_count: activePersonas.length,
    });
    logger.verbose("agents_transcript_preview", {
      personas: activePersonas.map((p) => p.id),
      provider: this.provider.id,
      model: this.model,
      transcriptPreview: transcript.slice(0, 200),
    });

    // Fan out to all personas in parallel
    const agentPromises = activePersonas.map(async (persona) => {
      try {
        logger.verbose("agent_fan_out", { persona: persona.id });
        const result = await runAgent(
          persona,
          transcript,
          this.model,
          this.provider,
          signal
        );
        logger.verbose("agent_stream_started", { persona: persona.id, messageId: result.messageId });

        let fullText = "";
        let chunkCount = 0;

        for await (const chunk of result.chunks) {
          if (signal.aborted) {
            logger.verbose("agent_stream_aborted", { persona: persona.id, chunkCount, textLength: fullText.length });
            return;
          }

          fullText += chunk.delta;
          chunkCount++;

          if (chunkCount <= 3 || chunk.isComplete) {
            logger.verbose("agent_chunk", { persona: persona.id, chunkNum: chunkCount, delta: chunk.delta, isComplete: chunk.isComplete, totalLength: fullText.length });
          }

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
          logger.verbose("agent_sending_completion", { persona: persona.id, messageId: result.messageId });
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
        logger.verbose("agent_full_response", { persona: persona.id, messageId: result.messageId, text: fullText, chunkCount });
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
