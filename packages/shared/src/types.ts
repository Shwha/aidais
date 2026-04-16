export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  timestamp: number;
  confidence?: number;
}

export interface AgentMessage {
  id: string;
  persona: PersonaId;
  text: string;
  delta: string;
  isComplete: boolean;
  timestamp: number;
}

export type PersonaId =
  | "fact-checker"
  | "cynical-troll"
  | "chaos-agent"
  | "joke-writer";

export type ChaosAgentMode = "chaos" | "fred-norris";

export interface Persona {
  id: PersonaId;
  name: string;
  displayName: string;
  avatar: string;
  color: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

/** Alternate persona definition for the chaos-agent slot when in sound-effects mode */
export interface PersonaAlt extends Persona {
  altMode: ChaosAgentMode;
}

export interface SessionConfig {
  llmProvider: string;
  llmModel: string;
  sttProvider: "webspeech" | "deepgram";
  activePersonas: PersonaId[];
}

// --- WebSocket Protocol ---

export type ClientMessage =
  | { type: "start_session"; config?: Partial<SessionConfig> }
  | { type: "stop_session" }
  | { type: "transcript"; text: string; isFinal: boolean; timestamp: number }
  | { type: "audio_chunk"; data: string } // base64-encoded PCM
  | { type: "set_chaos_mode"; mode: ChaosAgentMode };

export type ServerMessage =
  | { type: "session_status"; status: "active" | "stopped" | "error"; message?: string }
  | { type: "transcript"; text: string; isFinal: boolean; timestamp: number }
  | {
      type: "agent_response";
      persona: PersonaId;
      messageId: string;
      text: string;
      delta: string;
      isComplete: boolean;
      timestamp: number;
    }
  | { type: "error"; code: string; message: string };
