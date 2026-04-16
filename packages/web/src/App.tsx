import { useCallback } from "react";
import type { PersonaId } from "@aidais/shared";
import { useSessionStore } from "./stores/session.store";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { TranscriptFeed } from "./components/TranscriptFeed";
import { Controls } from "./components/Controls";

interface ServerMsg {
  type: string;
  status?: string;
  message?: string;
  text?: string;
  isFinal?: boolean;
  timestamp?: number;
  persona?: PersonaId;
  messageId?: string;
  delta?: string;
  isComplete?: boolean;
  code?: string;
}

export function App() {
  const addTranscript = useSessionStore((s) => s.addTranscript);
  const addAgentChunk = useSessionStore((s) => s.addAgentChunk);
  const setSessionActive = useSessionStore((s) => s.setSessionActive);

  const handleServerMessage = useCallback(
    (data: unknown) => {
      const msg = data as ServerMsg;
      switch (msg.type) {
        case "session_status":
          setSessionActive(msg.status === "active");
          break;

        case "transcript":
          addTranscript({
            text: msg.text ?? "",
            isFinal: msg.isFinal ?? false,
            timestamp: msg.timestamp ?? Date.now(),
          });
          break;

        case "agent_response":
          if (msg.persona && msg.messageId) {
            addAgentChunk({
              id: msg.messageId,
              persona: msg.persona,
              text: msg.text ?? "",
              delta: msg.delta ?? "",
              isComplete: msg.isComplete ?? false,
              timestamp: msg.timestamp ?? Date.now(),
            });
          }
          break;

        case "error":
          console.error(`[AIDAIS] ${msg.code}: ${msg.message}`);
          break;
      }
    },
    [addTranscript, addAgentChunk, setSessionActive]
  );

  const { send } = useWebSocket(handleServerMessage);

  const onTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      send({
        type: "transcript",
        text,
        isFinal,
        timestamp: Date.now(),
      });
    },
    [send]
  );

  const { isListening, start: startCapture, stop: stopCapture, error } =
    useAudioCapture(onTranscript);

  const handleStart = useCallback(() => {
    send({ type: "start_session" });
    startCapture();
  }, [send, startCapture]);

  const handleStop = useCallback(() => {
    stopCapture();
    send({ type: "stop_session" });
  }, [send, stopCapture]);

  return (
    <Layout
      main={
        <>
          <Controls
            isListening={isListening}
            onStart={handleStart}
            onStop={handleStop}
            error={error}
          />
          <TranscriptFeed />
        </>
      }
      sidebar={<Sidebar />}
    />
  );
}
