export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  delta: string;
  isComplete: boolean;
}

export interface LLMStreamParams {
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  streamChat(params: LLMStreamParams): AsyncIterable<StreamChunk>;
}

export interface LLMProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}
