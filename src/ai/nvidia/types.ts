export interface ChatMessage {
  content: string;
  role: "system" | "user";
}

export interface CompletionRequest {
  guidedJsonSchema?: Record<string, unknown>;
  maxTokens: number;
  messages: ChatMessage[];
  reasoningBudget?: number;
  temperature: number;
}

export interface QuestionModel {
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<string>;
}
