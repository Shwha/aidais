import OpenAI, { toFile } from "openai";
import { logger } from "../middleware/logger.js";

export class TranscriptionService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl ?? "https://api.groq.com/openai/v1",
    });
    this.model = model ?? "whisper-large-v3";
    logger.info("transcription_service_initialized", {
      baseUrl: baseUrl ?? "https://api.groq.com/openai/v1",
      model: this.model,
    });
  }

  async transcribe(
    audioBase64: string,
    signal?: AbortSignal
  ): Promise<string | null> {
    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");

      // Skip tiny chunks (likely silence or recording artifacts)
      if (audioBuffer.length < 1000) {
        logger.verbose("transcription_skipped_tiny_chunk", {
          size: audioBuffer.length,
        });
        return null;
      }

      logger.verbose("transcription_request", {
        audioSize: audioBuffer.length,
        model: this.model,
      });

      const file = await toFile(audioBuffer, "segment.webm", {
        type: "audio/webm;codecs=opus",
      });

      const response = await this.client.audio.transcriptions.create(
        {
          file,
          model: this.model,
          language: "en",
        },
        { signal }
      );

      const text = response.text?.trim();

      if (!text) {
        logger.verbose("transcription_empty");
        return null;
      }

      logger.verbose("transcription_result", {
        textLength: text.length,
        textPreview: text.slice(0, 120),
      });

      return text;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return null;

      logger.error("transcription_error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
