import { create } from "zustand";
import type { PersonaId, AgentMessage } from "@aidais/shared";

interface TranscriptEntry {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface SessionStore {
  // Connection
  isConnected: boolean;
  isSessionActive: boolean;
  setConnected: (connected: boolean) => void;
  setSessionActive: (active: boolean) => void;

  // Transcript
  transcriptEntries: TranscriptEntry[];
  addTranscript: (entry: TranscriptEntry) => void;
  clearTranscript: () => void;

  // Agent messages
  agentMessages: Record<PersonaId, AgentMessage[]>;
  streamingMessages: Record<PersonaId, AgentMessage | null>;
  addAgentChunk: (msg: AgentMessage) => void;
  clearAgentMessages: () => void;
}

const emptyAgentMessages: Record<PersonaId, AgentMessage[]> = {
  "fact-checker": [],
  "cynical-troll": [],
  "chaos-agent": [],
  "joke-writer": [],
};

const emptyStreaming: Record<PersonaId, AgentMessage | null> = {
  "fact-checker": null,
  "cynical-troll": null,
  "chaos-agent": null,
  "joke-writer": null,
};

export const useSessionStore = create<SessionStore>((set) => ({
  isConnected: false,
  isSessionActive: false,
  setConnected: (connected) => set({ isConnected: connected }),
  setSessionActive: (active) => set({ isSessionActive: active }),

  transcriptEntries: [],
  addTranscript: (entry) =>
    set((state) => ({
      transcriptEntries: [...state.transcriptEntries.slice(-100), entry],
    })),
  clearTranscript: () => set({ transcriptEntries: [] }),

  agentMessages: { ...emptyAgentMessages },
  streamingMessages: { ...emptyStreaming },

  addAgentChunk: (msg) =>
    set((state) => {
      if (msg.isComplete) {
        // Move completed message to history, clear streaming
        const skipPass =
          msg.text.trim() === "[PASS]" || msg.text.trim() === "PASS";
        return {
          streamingMessages: {
            ...state.streamingMessages,
            [msg.persona]: null,
          },
          agentMessages: skipPass
            ? state.agentMessages
            : {
                ...state.agentMessages,
                [msg.persona]: [
                  ...state.agentMessages[msg.persona].slice(-10),
                  msg,
                ],
              },
        };
      }
      // Update streaming state
      return {
        streamingMessages: {
          ...state.streamingMessages,
          [msg.persona]: msg,
        },
      };
    }),

  clearAgentMessages: () =>
    set({
      agentMessages: { ...emptyAgentMessages },
      streamingMessages: { ...emptyStreaming },
    }),
}));
