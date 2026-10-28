import { z } from "zod";

import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest, QuestionDraft } from "@/domain/practice/schemas";
import { buildReviewerMessages, reviewJsonSchema } from "@/generation/prompts/reviewer-v2";

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
) {
  const raw = await model.complete(
    {
      messages: buildReviewerMessages(request, questions),
      // The schema-bound rationale provides a bounded verification trace without free-form output.
      maxTokens: Math.min(1_400 + questions.length * 200, 3_200),
      reasoningBudget: 0,
      temperature: 0,
      guidedJsonSchema: reviewJsonSchema,
    },
    signal,
  );

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new SemanticReviewError(["invalid_review_json"]);
  }

  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success || parsed.data.verdicts.length !== questions.length) {
    throw new SemanticReviewError(["invalid_review_contract"]);
  }

  const indexes = parsed.data.verdicts.map((verdict) => verdict.index);
  if (
    new Set(indexes).size !== questions.length ||
    indexes.some((index) => index >= questions.length)
  ) {
    throw new SemanticReviewError(["invalid_review_indexes"]);
  }

  const failed = parsed.data.verdicts.filter((verdict) => verdict.verdict === "fail");
  if (failed.length > 0) {
    const issues = failed.flatMap((verdict) => verdict.issues);
    throw new SemanticReviewError(issues.length > 0 ? [...new Set(issues)] : ["review_failed"]);
  }
}
