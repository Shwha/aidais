/** Maximum transcript context window sent to agents (characters) */
export const TRANSCRIPT_CONTEXT_MAX_CHARS = 3000;

/** Minimum interval between agent invocations (ms) */
export const AGENT_DEBOUNCE_MS = 3000;

/** Maximum tokens per agent response */
export const AGENT_MAX_TOKENS = 150;

/** WebSocket heartbeat interval (ms) */
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;

/** WebSocket reconnect delay (ms) */
export const WS_RECONNECT_DELAY_MS = 2000;

/** Maximum WebSocket message size (bytes) */
export const WS_MAX_MESSAGE_SIZE = 1_048_576; // 1MB

/** Maximum audio chunk size (bytes, base64-encoded) */
export const AUDIO_CHUNK_MAX_SIZE = 1_048_576; // 1MB

/** Server default port */
export const DEFAULT_PORT = 3001;

/** Client dev server default port */
export const DEFAULT_CLIENT_PORT = 5173;

/** Rate limit: max WebSocket connections per IP */
export const RATE_LIMIT_WS_CONNECTIONS = 5;

/** Rate limit: max messages per minute per connection */
export const RATE_LIMIT_MESSAGES_PER_MIN = 120;
