import type { Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { ChaosAgentMode } from "@aidais/shared";
import { clientMessageSchema, AGENT_DEBOUNCE_MS, TRANSCRIPT_CONTEXT_MAX_CHARS } from "@aidais/shared";
import { logger } from "../middleware/logger.js";
import type { AgentService } from "../services/agent.service.js";
import type { TranscriptionService } from "../services/transcription.service.js";
import type { AppConfig } from "../config.js";

interface SessionState {
  isActive: boolean;
  transcriptBuffer: string;
  lastAgentInvocation: number;
  abortController: AbortController | null;
  chaosMode: ChaosAgentMode;
}

export function registerWebSocket(
  app: Hono,
  upgradeWebSocket: (handler: (c: any) => any) => any,
  config: AppConfig,
  agentService: AgentService,
  transcriptionService?: TranscriptionService | null
) {
  app.get(
    "/ws",
    upgradeWebSocket(() => {
      const session: SessionState = {
        isActive: false,
        transcriptBuffer: "",
        lastAgentInvocation: 0,
        abortController: null,
        chaosMode: "chaos",
      };

      return {
        onOpen(_evt: Event, ws: WSContext) {
          logger.info("ws_connected");
          logger.verbose("ws_open_details", { sessionState: { ...session } });
          ws.send(
            JSON.stringify({
              type: "session_status",
              status: "active",
              message: "Connected to AIDAIS server",
            })
          );
        },

        onMessage(evt: MessageEvent, ws: WSContext) {
          try {
            logger.verbose("ws_raw_message", { dataType: typeof evt.data, dataLength: typeof evt.data === "string" ? evt.data.length : 0 });
            const raw =
              typeof evt.data === "string" ? evt.data : String(evt.data);
            const parsed = clientMessageSchema.safeParse(JSON.parse(raw));

            if (!parsed.success) {
              logger.warn("ws_invalid_message", {
                errors: parsed.error.issues.map((i) => i.message),
              });
              ws.send(
                JSON.stringify({
                  type: "error",
                  code: "INVALID_MESSAGE",
                  message: "Invalid message format",
                })
              );
              return;
            }

            const msg = parsed.data;

            switch (msg.type) {
              case "start_session":
                session.isActive = true;
                session.transcriptBuffer = "";
                logger.info("session_started");
                logger.verbose("session_start_state", { session: { ...session } });
                ws.send(
                  JSON.stringify({
                    type: "session_status",
                    status: "active",
                    message: "Session started",
                  })
                );
                break;

              case "stop_session":
                logger.verbose("session_stop_requested", { wasActive: session.isActive, hadAbortController: !!session.abortController });
                session.isActive = false;
                session.abortController?.abort();
                session.abortController = null;
                logger.info("session_stopped");
                ws.send(
                  JSON.stringify({
                    type: "session_status",
                    status: "stopped",
                    message: "Session stopped",
                  })
                );
                break;

              case "transcript":
                if (!session.isActive) {
                  logger.verbose("transcript_ignored_inactive", { text: msg.text?.slice(0, 80) });
                  return;
                }

                logger.verbose("transcript_received", { isFinal: msg.isFinal, textLength: msg.text?.length ?? 0, textPreview: msg.text?.slice(0, 100) });

                // Only buffer final results to avoid duplication
                if (msg.isFinal) {
                  session.transcriptBuffer += " " + msg.text;
                  logger.verbose("transcript_buffered", { bufferLength: session.transcriptBuffer.length });

                  // Trim to context window
                  if (session.transcriptBuffer.length > TRANSCRIPT_CONTEXT_MAX_CHARS) {
                    session.transcriptBuffer =
                      session.transcriptBuffer.slice(-TRANSCRIPT_CONTEXT_MAX_CHARS);
                    logger.verbose("transcript_buffer_trimmed", { newLength: session.transcriptBuffer.length });
                  }
                }

                // Debounce agent invocations
                if (msg.isFinal) {
                  const now = Date.now();
                  const timeSinceLast = now - session.lastAgentInvocation;
                  if (timeSinceLast >= AGENT_DEBOUNCE_MS) {
                    logger.verbose("agent_invocation_triggered", { timeSinceLast, bufferLength: session.transcriptBuffer.trim().length, abortingPrevious: !!session.abortController });
                    session.lastAgentInvocation = now;
                    session.abortController?.abort();
                    session.abortController = new AbortController();

                    agentService
                      .processTranscript(
                        session.transcriptBuffer.trim(),
                        ws,
                        session.abortController.signal,
                        session.chaosMode
                      )
                      .catch((err) => {
                        if (err instanceof Error && err.name === "AbortError") {
                          logger.verbose("agent_aborted", { reason: "new transcript arrived" });
                          return;
                        }
                        logger.error("agent_error", {
                          error: err instanceof Error ? err.message : String(err),
                        });
                      });
                  } else {
                    logger.verbose("agent_invocation_debounced", { timeSinceLast, waitRemaining: AGENT_DEBOUNCE_MS - timeSinceLast });
                  }
                }
                break;

              case "set_chaos_mode":
                session.chaosMode = msg.mode;
                logger.info("chaos_mode_changed", { mode: msg.mode });
                agentService.setChaosMode(msg.mode);
                ws.send(
                  JSON.stringify({
                    type: "session_status",
                    status: session.isActive ? "active" : "stopped",
                    message: `Chaos agent mode: ${msg.mode}`,
                  })
                );
                break;

              case "audio_chunk":
                if (!session.isActive) return;
                if (!transcriptionService) {
                  logger.verbose("audio_chunk_ignored_no_stt", { dataLength: msg.data.length });
                  return;
                }

                logger.verbose("audio_chunk_received", { dataLength: msg.data.length });

                // Transcribe in background — don't block the message handler
                transcriptionService
                  .transcribe(msg.data, session.abortController?.signal)
                  .then((text) => {
                    if (!text || !session.isActive) return;

                    logger.info("audio_transcribed", { textLength: text.length, preview: text.slice(0, 80) });

                    // Feed into transcript buffer (same as text transcript)
                    session.transcriptBuffer += " " + text;
                    if (session.transcriptBuffer.length > TRANSCRIPT_CONTEXT_MAX_CHARS) {
                      session.transcriptBuffer = session.transcriptBuffer.slice(-TRANSCRIPT_CONTEXT_MAX_CHARS);
                    }

                    // Trigger agents (respecting debounce)
                    const now = Date.now();
                    const timeSinceLast = now - session.lastAgentInvocation;
                    if (timeSinceLast >= AGENT_DEBOUNCE_MS) {
                      logger.verbose("audio_agent_invocation", { timeSinceLast, bufferLength: session.transcriptBuffer.trim().length });
                      session.lastAgentInvocation = now;
                      session.abortController?.abort();
                      session.abortController = new AbortController();

                      agentService
                        .processTranscript(
                          session.transcriptBuffer.trim(),
                          ws,
                          session.abortController.signal,
                          session.chaosMode
                        )
                        .catch((err) => {
                          if (err instanceof Error && err.name === "AbortError") return;
                          logger.error("agent_error", {
                            error: err instanceof Error ? err.message : String(err),
                          });
                        });
                    }
                  })
                  .catch((err) => {
                    logger.error("audio_transcription_failed", {
                      error: err instanceof Error ? err.message : String(err),
                    });
                  });
                break;
            }
          } catch (err) {
            logger.error("ws_message_error", {
              error: err instanceof Error ? err.message : String(err),
            });
            ws.send(
              JSON.stringify({
                type: "error",
                code: "INTERNAL_ERROR",
                message: "Failed to process message",
              })
            );
          }
        },

        onClose() {
          session.isActive = false;
          session.abortController?.abort();
          logger.info("ws_disconnected");
        },

        onError(err: Event) {
          logger.error("ws_error", {
            error: err instanceof Error ? err.message : "Unknown error",
          });
        },
      };
    })
  );
}
