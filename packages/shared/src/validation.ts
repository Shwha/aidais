import { z } from "zod";
import { AUDIO_CHUNK_MAX_SIZE } from "./constants.js";

const personaIdSchema = z.enum([
  "fact-checker",
  "cynical-troll",
  "chaos-agent",
  "joke-writer",
]);

const sessionConfigSchema = z.object({
  llmProvider: z.string().min(1).max(50).optional(),
  llmModel: z.string().min(1).max(100).optional(),
  sttProvider: z.enum(["webspeech", "deepgram"]).optional(),
  activePersonas: z.array(personaIdSchema).min(1).max(4).optional(),
});

// --- Client → Server messages ---

const startSessionSchema = z.object({
  type: z.literal("start_session"),
  config: sessionConfigSchema.optional(),
});

const stopSessionSchema = z.object({
  type: z.literal("stop_session"),
});

const transcriptSchema = z.object({
  type: z.literal("transcript"),
  text: z.string().min(1).max(10_000),
  isFinal: z.boolean(),
  timestamp: z.number().int().positive(),
});

const audioChunkSchema = z.object({
  type: z.literal("audio_chunk"),
  data: z.string().max(AUDIO_CHUNK_MAX_SIZE),
});

const setChaosModeSchema = z.object({
  type: z.literal("set_chaos_mode"),
  mode: z.enum(["chaos", "fred-norris"]),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  startSessionSchema,
  stopSessionSchema,
  transcriptSchema,
  audioChunkSchema,
  setChaosModeSchema,
]);

// --- Server → Client messages ---

const sessionStatusSchema = z.object({
  type: z.literal("session_status"),
  status: z.enum(["active", "stopped", "error"]),
  message: z.string().optional(),
});

const serverTranscriptSchema = z.object({
  type: z.literal("transcript"),
  text: z.string(),
  isFinal: z.boolean(),
  timestamp: z.number(),
});

const agentResponseSchema = z.object({
  type: z.literal("agent_response"),
  persona: personaIdSchema,
  messageId: z.string(),
  text: z.string(),
  delta: z.string(),
  isComplete: z.boolean(),
  timestamp: z.number(),
});

const errorSchema = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  sessionStatusSchema,
  serverTranscriptSchema,
  agentResponseSchema,
  errorSchema,
]);

// --- YouTube URL validation ---

const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

export const youtubeUrlSchema = z
  .string()
  .url()
  .regex(YOUTUBE_URL_PATTERN, "Invalid YouTube URL format");

// --- Export types ---

export type ClientMessageInput = z.input<typeof clientMessageSchema>;
export type ServerMessageInput = z.input<typeof serverMessageSchema>;
