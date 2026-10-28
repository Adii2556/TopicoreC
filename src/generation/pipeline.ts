import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest, PracticeSet } from "@/domain/practice/schemas";
import { SemanticReviewError, reviewQuestions } from "@/verification/semantic-review";

import { buildGeneratorMessages, generatedSetJsonSchema } from "./prompts/generator-v1";
import { DraftValidationError, parseAndValidateDraft } from "./validate-draft";

export interface PipelineOptions {
  sleep?: (milliseconds: number) => Promise<void>;
}

export async function generatePracticeSet(
  request: GeneratePracticeSetRequest,
  model: QuestionModel,
  signal?: AbortSignal,
  options: PipelineOptions = {},
): Promise<PracticeSet> {
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await model.complete(
        {
          messages: buildGeneratorMessages(request),
          maxTokens: Math.min(1_800 + request.questionCount * 850, 8_000),
          reasoningBudget: 0,
          temperature: 0.3,
          guidedJsonSchema: generatedSetJsonSchema,
        },
        signal,
      );
      const acceptedDraft = parseAndValidateDraft(raw, request);
      await reviewQuestions(request, acceptedDraft.questions, model, signal);
      return {
        schemaVersion: "1.0",
        sessionId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        config: request,
        questions: acceptedDraft.questions.map((question) => ({
          ...question,
          id: crypto.randomUUID(),
        })),
      };
    } catch (error) {
      lastError = error;
      const retryableProviderError =
        typeof error === "object" &&
        error !== null &&
        "retryable" in error &&
        error.retryable === true;
      const retryableValidationError =
        error instanceof DraftValidationError || error instanceof SemanticReviewError;
      if (attempt === 1 || (!retryableProviderError && !retryableValidationError)) throw error;
      signal?.throwIfAborted();
      await sleep(250 + Math.floor(Math.random() * 250));
      signal?.throwIfAborted();
    }
  }

  throw lastError;
}
