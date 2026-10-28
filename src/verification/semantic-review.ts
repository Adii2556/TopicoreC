import { z } from "zod";

import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest, QuestionDraft } from "@/domain/practice/schemas";
import { buildReviewerMessages, reviewJsonSchema } from "@/generation/prompts/reviewer-v2";
import { recordMonitorEvent } from "@/monitoring/server";

const reviewIssueSchema = z.enum([
  "incorrect_answer",
  "ambiguous_prompt",
  "difficulty_mismatch",
  "explanation_conflict",
  "hint_leaks_answer",
  "off_topic",
  "unsafe_or_version_ambiguous",
]);

const reviewSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    verdicts: z.array(
      z
        .object({
          index: z.number().int().nonnegative(),
          rationale: z.string().trim().min(10).max(800),
          verdict: z.enum(["pass", "fail"]),
          issues: z.array(reviewIssueSchema),
        })
        .strict(),
    ),
  })
  .strict();

export class SemanticReviewError extends Error {
  constructor(readonly issues: string[]) {
    super("Generated questions failed semantic review.");
    this.name = "SemanticReviewError";
  }
}

export async function reviewQuestions(
  request: GeneratePracticeSetRequest,
  questions: QuestionDraft[],
  model: QuestionModel,
  signal?: AbortSignal,
  monitoring?: { requestId: string; attempt: number },
) {
  const startedAt = performance.now();
  if (monitoring) {
    recordMonitorEvent({
      requestId: monitoring.requestId,
      event: "semantic_review.started",
      level: "debug",
      source: "semantic-review",
      status: "started",
      message: "AI-assisted semantic review started.",
      details: { attempt: monitoring.attempt, questionCount: questions.length },
    });
  }
  const raw = await model.complete(
    {
      messages: buildReviewerMessages(request, questions),
      // The schema-bound rationale provides a bounded verification trace without free-form output.
      maxTokens: Math.min(1_400 + questions.length * 200, 3_200),
      reasoningBudget: 0,
      temperature: 0,
      guidedJsonSchema: reviewJsonSchema,
      ...(monitoring
        ? {
            monitoring: {
              requestId: monitoring.requestId,
              attempt: monitoring.attempt,
              operation: "semantic_review" as const,
            },
          }
        : {}),
    },
    signal,
  );

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    if (monitoring) {
      recordMonitorEvent({
        requestId: monitoring.requestId,
        event: "semantic_review.failed",
        level: "error",
        source: "semantic-review",
        status: "failed",
        message: "Semantic review returned invalid JSON.",
        durationMs: performance.now() - startedAt,
        details: { attempt: monitoring.attempt, issues: ["invalid_review_json"] },
      });
    }
    throw new SemanticReviewError(["invalid_review_json"]);
  }

  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success || parsed.data.verdicts.length !== questions.length) {
    if (monitoring) {
      recordMonitorEvent({
        requestId: monitoring.requestId,
        event: "semantic_review.failed",
        level: "error",
        source: "semantic-review",
        status: "failed",
        message: "Semantic review contract validation failed.",
        durationMs: performance.now() - startedAt,
        details: { attempt: monitoring.attempt, issues: ["invalid_review_contract"] },
      });
    }
    throw new SemanticReviewError(["invalid_review_contract"]);
  }

  const indexes = parsed.data.verdicts.map((verdict) => verdict.index);
  if (
    new Set(indexes).size !== questions.length ||
    indexes.some((index) => index >= questions.length)
  ) {
    if (monitoring) {
      recordMonitorEvent({
        requestId: monitoring.requestId,
        event: "semantic_review.failed",
        level: "error",
        source: "semantic-review",
        status: "failed",
        message: "Semantic review returned invalid question indexes.",
        durationMs: performance.now() - startedAt,
        details: { attempt: monitoring.attempt, issues: ["invalid_review_indexes"] },
      });
    }
    throw new SemanticReviewError(["invalid_review_indexes"]);
  }

  const failed = parsed.data.verdicts.filter((verdict) => verdict.verdict === "fail");
  if (failed.length > 0) {
    const issues = failed.flatMap((verdict) => verdict.issues);
    const uniqueIssues = issues.length > 0 ? [...new Set(issues)] : ["review_failed"];
    if (monitoring) {
      recordMonitorEvent({
        requestId: monitoring.requestId,
        event: "semantic_review.failed",
        level: "error",
        source: "semantic-review",
        status: "failed",
        message: "AI-assisted semantic checks rejected generated questions.",
        durationMs: performance.now() - startedAt,
        details: {
          attempt: monitoring.attempt,
          validationType: "semantic",
          issues: uniqueIssues,
          failedQuestionIndexes: failed.map((verdict) => verdict.index),
          action: "rejected",
        },
      });
    }
    throw new SemanticReviewError(uniqueIssues);
  }
  if (monitoring) {
    recordMonitorEvent({
      requestId: monitoring.requestId,
      event: "semantic_review.passed",
      level: "success",
      source: "semantic-review",
      status: "success",
      message: "AI-assisted semantic checks passed.",
      durationMs: performance.now() - startedAt,
      details: { attempt: monitoring.attempt, questionCount: questions.length },
    });
  }
}
