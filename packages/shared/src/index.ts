export type {
  TranscriptChunk,
  AgentMessage,
  PersonaId,
  Persona,
  SessionConfig,
  ClientMessage,
  ServerMessage,
} from "./types.js";

export type {
  ChatMessage,
  StreamChunk,
  LLMStreamParams,
  LLMProvider,
  LLMProviderConfig,
} from "./provider-types.js";

export { PERSONAS, getPersona, getActivePersonas } from "./personas.js";

export {
  TRANSCRIPT_CONTEXT_MAX_CHARS,
  AGENT_DEBOUNCE_MS,
  AGENT_MAX_TOKENS,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_RECONNECT_DELAY_MS,
  WS_MAX_MESSAGE_SIZE,
  AUDIO_CHUNK_MAX_SIZE,
  DEFAULT_PORT,
  DEFAULT_CLIENT_PORT,
  RATE_LIMIT_WS_CONNECTIONS,
  RATE_LIMIT_MESSAGES_PER_MIN,
} from "./constants.js";

export {
  clientMessageSchema,
  serverMessageSchema,
  youtubeUrlSchema,
} from "./validation.js";

export type {
  ClientMessageInput,
  ServerMessageInput,
} from "./validation.js";
