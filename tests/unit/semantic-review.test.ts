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
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({
        schemaVersion: "1.0",
        verdicts: [
          {
            index: 0,
            rationale: "LEFT JOIN preserves every row from the left input.",
            verdict: "pass",
            issues: [],
          },
        ],
      }),
    );
    const model: QuestionModel = {
      complete,
    };
    await expect(reviewQuestions(request, questions, model)).resolves.toBeUndefined();
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      reasoningBudget: 0,
      temperature: 0,
    });
  });

  it("rejects duplicate review indexes", async () => {
    const model: QuestionModel = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          schemaVersion: "1.0",
          verdicts: [
            {
              index: 0,
              rationale: "The answer correctly identifies LEFT JOIN.",
              verdict: "pass",
              issues: [],
            },
            {
              index: 0,
              rationale: "The answer correctly identifies LEFT JOIN.",
              verdict: "pass",
              issues: [],
            },
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
        verdicts: [
          {
            index: 4,
            rationale: "The answer correctly identifies LEFT JOIN.",
            verdict: "pass",
            issues: [],
          },
        ],
      }),
    ],
    [
      "a factual failure",
      JSON.stringify({
        schemaVersion: "1.0",
        verdicts: [
          {
            index: 0,
            rationale: "The selected option does not preserve all left rows.",
            verdict: "fail",
            issues: ["incorrect_answer"],
          },
        ],
      }),
    ],
  ])("rejects %s", async (_label, response) => {
    const model: QuestionModel = { complete: vi.fn().mockResolvedValue(response) };
    await expect(reviewQuestions(request, questions, model)).rejects.toThrow("semantic review");
  });
});
