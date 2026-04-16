import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMStreamParams, StreamChunk } from "./types.js";

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic Claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamChat(params: LLMStreamParams): AsyncIterable<StreamChunk> {
    const stream = this.client.messages.stream({
      model: params.model,
      system: params.systemPrompt,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });

    if (params.signal) {
      params.signal.addEventListener("abort", () => {
        stream.abort();
      });
    }

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { delta: event.delta.text, isComplete: false };
      }
    }

    yield { delta: "", isComplete: true };
  }
}
