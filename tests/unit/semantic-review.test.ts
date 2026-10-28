import { describe, expect, it, vi } from "vitest";

import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest, QuestionDraft } from "@/domain/practice/schemas";
import { reviewQuestions } from "@/verification/semantic-review";

const request: GeneratePracticeSetRequest = {
  subject: "sql",
  topics: ["joins"],
  difficulty: "intermediate",
  questionCount: 1,
  mode: "multiple_choice",
};

const questions: QuestionDraft[] = [
  {
    type: "multiple_choice",
    topic: "joins",
    difficulty: "intermediate",
    prompt: "Which join keeps every row from its left input table?",
    options: [
      { id: "a", text: "INNER JOIN" },
      { id: "b", text: "LEFT JOIN" },
      { id: "c", text: "CROSS JOIN" },
      { id: "d", text: "SELF JOIN" },
    ],
    answer: { optionId: "b" },
    hint: "Consider the preserved side.",
    explanation: "LEFT JOIN preserves all rows from the left input.",
  },
];

describe("reviewQuestions", () => {
  it("accepts exactly one passing verdict per question", async () => {
    const model: QuestionModel = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          schemaVersion: "1.0",
          verdicts: [{ index: 0, verdict: "pass", issues: [] }],
        }),
      ),
    };
    await expect(reviewQuestions(request, questions, model)).resolves.toBeUndefined();
  });

  it("rejects duplicate review indexes", async () => {
    const model: QuestionModel = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          schemaVersion: "1.0",
          verdicts: [
            { index: 0, verdict: "pass", issues: [] },
            { index: 0, verdict: "pass", issues: [] },
          ],
        }),
      ),
    };
    await expect(reviewQuestions(request, [...questions, ...questions], model)).rejects.toThrow(
      "semantic review",
    );
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["an incomplete contract", JSON.stringify({ schemaVersion: "1.0", verdicts: [] })],
    [
      "an out-of-range index",
      JSON.stringify({
        schemaVersion: "1.0",
        verdicts: [{ index: 4, verdict: "pass", issues: [] }],
      }),
    ],
    [
      "a factual failure",
      JSON.stringify({
        schemaVersion: "1.0",
        verdicts: [{ index: 0, verdict: "fail", issues: ["incorrect_answer"] }],
      }),
    ],
  ])("rejects %s", async (_label, response) => {
    const model: QuestionModel = { complete: vi.fn().mockResolvedValue(response) };
    await expect(reviewQuestions(request, questions, model)).rejects.toThrow("semantic review");
  });
});
