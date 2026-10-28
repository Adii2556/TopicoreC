import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest, PracticeSet } from "@/domain/practice/schemas";
import { recordMonitorEvent } from "@/monitoring/server";
import { SemanticReviewError, reviewQuestions } from "@/verification/semantic-review";

import {
  buildGeneratorMessages,
  generatedSetJsonSchema,
  GENERATOR_PROMPT_VERSION,
} from "./prompts/generator-v2";
import { DraftValidationError, parseAndValidateDraft } from "./validate-draft";

export interface PipelineOptions {
  sleep?: (milliseconds: number) => Promise<void>;
  monitoring?: { requestId: string };
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
  let repairIssues: string[] = [];
  const startedAt = performance.now();
  const requestId = options.monitoring?.requestId;
  if (requestId) {
    recordMonitorEvent({
      requestId,
      event: "generation.started",
      level: "info",
      source: "generation-pipeline",
      status: "started",
      message: "Question generation pipeline started.",
      details: {
        subject: request.subject,
        difficulty: request.difficulty,
        mode: request.mode,
        questionCount: request.questionCount,
        topicCount: request.topics.length,
      },
    });
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const promptStartedAt = performance.now();
      const messages = buildGeneratorMessages(request, repairIssues);
      if (requestId) {
        recordMonitorEvent({
          requestId,
          event: "prompt.created",
          level: "debug",
          source: "generation-pipeline",
          status: "success",
          message: "Versioned generation prompt metadata created.",
          durationMs: performance.now() - promptStartedAt,
          details: {
            promptVersion: GENERATOR_PROMPT_VERSION,
            messageCount: messages.length,
            attempt: attempt + 1,
            repairIssues,
          },
        });
      }
      const raw = await model.complete(
        {
          messages,
          maxTokens: Math.min(1_800 + request.questionCount * 850, 8_000),
          reasoningBudget: 0,
          temperature: 0.3,
          guidedJsonSchema: generatedSetJsonSchema,
          ...(requestId
            ? { monitoring: { requestId, attempt: attempt + 1, operation: "generation" as const } }
            : {}),
        },
        signal,
      );
      const acceptedDraft = parseAndValidateDraft(
        raw,
        request,
        requestId ? { requestId, attempt: attempt + 1 } : undefined,
      );
      await reviewQuestions(
        request,
        acceptedDraft.questions,
        model,
        signal,
        requestId ? { requestId, attempt: attempt + 1 } : undefined,
      );
      const result: PracticeSet = {
        schemaVersion: "1.0",
        sessionId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        config: request,
        questions: acceptedDraft.questions.map((question) => ({
          ...question,
          id: crypto.randomUUID(),
        })),
      };
      if (requestId) {
        recordMonitorEvent({
          requestId,
          event: "generation.completed",
          level: "success",
          source: "generation-pipeline",
          status: "success",
          message: "Validated practice set returned by the generation pipeline.",
          durationMs: performance.now() - startedAt,
          details: {
            questionCount: result.questions.length,
            requestedCount: request.questionCount,
            acceptedCount: result.questions.length,
            attempt: attempt + 1,
          },
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      const retryableProviderError =
        typeof error === "object" &&
        error !== null &&
        "retryable" in error &&
        error.retryable === true;
      const retryableValidationError =
        error instanceof DraftValidationError || error instanceof SemanticReviewError;
      if (attempt === 1 || (!retryableProviderError && !retryableValidationError)) {
        if (requestId) {
          recordMonitorEvent({
            requestId,
            event: "generation.failed",
            level: "error",
            source: "generation-pipeline",
            status: "failed",
            message: "Question generation pipeline failed.",
            durationMs: performance.now() - startedAt,
            details: {
              attempt: attempt + 1,
              errorName: error instanceof Error ? error.name : "UnknownError",
              issues:
                error instanceof DraftValidationError || error instanceof SemanticReviewError
                  ? error.issues
                  : [],
              errorCode:
                typeof error === "object" && error !== null && "code" in error
                  ? String(error.code)
                  : undefined,
            },
          });
        }
        throw error;
      }
      if (retryableValidationError) repairIssues = [...error.issues];
      if (requestId) {
        recordMonitorEvent({
          requestId,
          event: "generation.retry",
          level: "warning",
          source: "generation-pipeline",
          status: "retry",
          message: "The bounded replacement generation attempt was scheduled.",
          details: {
            completedAttempt: attempt + 1,
            nextAttempt: attempt + 2,
            reason: retryableValidationError ? "validation_or_review" : "provider_failure",
            issues: repairIssues,
          },
        });
      }
      signal?.throwIfAborted();
      await sleep(250 + Math.floor(Math.random() * 250));
      signal?.throwIfAborted();
    }
  }

  throw lastError;
}
