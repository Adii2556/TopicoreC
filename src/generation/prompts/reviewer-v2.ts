import type { GeneratePracticeSetRequest, QuestionDraft } from "@/domain/practice/schemas";

export const REVIEWER_PROMPT_VERSION = "reviewer-v2";

export const reviewJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "verdicts"],
  properties: {
    schemaVersion: { const: "1.0" },
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "rationale", "verdict", "issues"],
        properties: {
          index: { type: "integer", minimum: 0 },
          rationale: { type: "string", minLength: 10, maxLength: 800 },
          verdict: { enum: ["pass", "fail"] },
          issues: {
            type: "array",
            items: {
              enum: [
                "incorrect_answer",
                "ambiguous_prompt",
                "difficulty_mismatch",
                "explanation_conflict",
                "hint_leaks_answer",
                "off_topic",
                "unsafe_or_version_ambiguous",
              ],
            },
          },
        },
      },
    },
  },
};

export function buildReviewerMessages(
  request: GeneratePracticeSetRequest,
  questions: QuestionDraft[],
) {
  return [
    {
      role: "system" as const,
      content: `Independently review practice questions for factual correctness and learning quality.
Return JSON only and follow the supplied schema exactly. Produce one verdict for every question index in order.
For each question, first use the rationale field to check the stated answer against the prompt and briefly justify the verdict. Keep the rationale factual and under 800 characters.
Fail a question if its stated answer or reference answer is wrong or incomplete, if the explanation conflicts with it, if multiple MCQ options are defensible, if it is off-topic or mismatched in difficulty, if the hint reveals the answer, or if behavior is unsafe or version-ambiguous.
Fail only for a specific, material defect represented by an allowed issue code. Do not fail for stylistic preference, harmless wording differences, or omission of details unrelated to the requested concept.
Do not rewrite or repair questions. Do not assume the generator was correct.`,
    },
    {
      role: "user" as const,
      content: `REQUEST\n${JSON.stringify(request)}\n\nQUESTIONS\n${JSON.stringify(questions)}\n\nOUTPUT_SCHEMA\n${JSON.stringify(reviewJsonSchema)}`,
    },
  ];
}
