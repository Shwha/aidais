import type { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { clientMessageSchema } from "@aidais/shared";
import { logger } from "../middleware/logger.js";
import type { AgentService } from "../services/agent.service.js";
import type { AppConfig } from "../config.js";

interface SessionState {
  isActive: boolean;
  transcriptBuffer: string;
  lastAgentInvocation: number;
  abortController: AbortController | null;
}

export function registerWebSocket(
  app: Hono,
  upgradeWebSocket: (handler: (c: any) => any) => any,
  config: AppConfig,
  agentService: AgentService
) {
  app.get(
    "/ws",
    upgradeWebSocket(() => {
      const session: SessionState = {
        isActive: false,
        transcriptBuffer: "",
        lastAgentInvocation: 0,
        abortController: null,
      };

      return {
        onOpen(_evt: Event, ws: WSContext) {
          logger.info("ws_connected");
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
            const raw =
              typeof evt.data === "string" ? evt.data : evt.data.toString();
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
                ws.send(
                  JSON.stringify({
                    type: "session_status",
                    status: "active",
                    message: "Session started",
                  })
                );
                break;

              case "stop_session":
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
                if (!session.isActive) return;

                // Only buffer final results to avoid duplication
                if (msg.isFinal) {
                  session.transcriptBuffer += " " + msg.text;

                  // Trim to context window
                  if (session.transcriptBuffer.length > 3000) {
                    session.transcriptBuffer =
                      session.transcriptBuffer.slice(-3000);
                  }
                }

                // Debounce agent invocations
                if (msg.isFinal) {
                  const now = Date.now();
                  if (now - session.lastAgentInvocation >= 3000) {
                    session.lastAgentInvocation = now;
                    session.abortController?.abort();
                    session.abortController = new AbortController();

                    agentService
                      .processTranscript(
                        session.transcriptBuffer.trim(),
                        ws,
                        session.abortController.signal
                      )
                      .catch((err) => {
                        if (err instanceof Error && err.name === "AbortError")
                          return;
                        logger.error("agent_error", {
                          error: err instanceof Error ? err.message : String(err),
                        });
                      });
                  }
                }
                break;

              case "audio_chunk":
                // Reserved for Deepgram integration
                if (!session.isActive) return;
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
