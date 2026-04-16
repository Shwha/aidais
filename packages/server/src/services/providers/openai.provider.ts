import OpenAI from "openai";
import type { LLMProvider, LLMStreamParams, StreamChunk } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }

  async *streamChat(params: LLMStreamParams): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create(
      {
        model: params.model,
        messages: [
          { role: "system" as const, content: params.systemPrompt },
          ...params.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: true,
      },
      { signal: params.signal }
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      const isComplete = chunk.choices[0]?.finish_reason !== null;

      if (delta || isComplete) {
        yield { delta, isComplete };
      }
    }
  }
}
