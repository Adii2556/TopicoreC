import { describe, expect, it } from "vitest";

import {
  generatePracticeSetRequestSchema,
  multipleChoiceDraftSchema,
  practiceSetSchema,
} from "@/domain/practice/schemas";

describe("generatePracticeSetRequestSchema", () => {
  const validRequest = {
    subject: "sql",
    topics: ["joins"],
    difficulty: "intermediate",
    questionCount: 5,
    mode: "multiple_choice",
  } as const;

  it("accepts a bounded request", () => {
    expect(generatePracticeSetRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it("rejects duplicate normalized topics and excessive counts", () => {
    const result = generatePracticeSetRequestSchema.safeParse({
      ...validRequest,
      topics: ["joins", "JOINS"],
      questionCount: 11,
    });

    expect(result.success).toBe(false);
  });

  it("normalizes Unicode topic variants and enforces topic length boundaries", () => {
    expect(
      generatePracticeSetRequestSchema.safeParse({
        ...validRequest,
        topics: ["joins", "ｊｏｉｎｓ"],
      }).success,
    ).toBe(false);
    expect(
      generatePracticeSetRequestSchema.safeParse({
        ...validRequest,
        topics: ["x".repeat(80)],
      }).success,
    ).toBe(true);
    expect(
      generatePracticeSetRequestSchema.safeParse({
        ...validRequest,
        topics: ["x".repeat(81)],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(
      generatePracticeSetRequestSchema.safeParse({ ...validRequest, role: "admin" }).success,
    ).toBe(false);
  });

  it("requires enough questions to create a genuinely mixed session", () => {
    expect(
      generatePracticeSetRequestSchema.safeParse({
        ...validRequest,
        mode: "mixed",
        questionCount: 1,
      }).success,
    ).toBe(false);
  });

  it.each([
    [1, true],
    [10, true],
    [0, false],
    [11, false],
  ])("validates the question-count boundary at %s", (questionCount, accepted) => {
    expect(
      generatePracticeSetRequestSchema.safeParse({ ...validRequest, questionCount }).success,
    ).toBe(accepted);
  });
});

describe("multipleChoiceDraftSchema", () => {
  it("rejects answer IDs outside the fixed option contract", () => {
    const result = multipleChoiceDraftSchema.safeParse({
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which join keeps all rows from the left table?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "SELF JOIN" },
      ],
      answer: { optionId: "e" },
      hint: "Think about which table is preserved.",
      explanation: "A LEFT JOIN retains every row from the left table.",
    });

    expect(result.success).toBe(false);
  });
});

describe("practiceSetSchema", () => {
  const validSet = {
    schemaVersion: "1.0",
    sessionId: "34eeb774-b69a-4fec-b94e-eab78308017d",
    createdAt: "2026-10-27T10:00:00.000Z",
    config: {
      subject: "sql",
      topics: ["joins"],
      difficulty: "intermediate",
      questionCount: 1,
      mode: "multiple_choice",
    },
    questions: [
      {
        id: "f52fd3a5-df45-48dd-9d34-cd2c0e71159f",
        type: "multiple_choice",
        topic: "joins",
        difficulty: "intermediate",
        prompt: "Which join keeps all rows from the left table?",
        options: [
          { id: "a", text: "INNER JOIN" },
          { id: "b", text: "LEFT JOIN" },
          { id: "c", text: "CROSS JOIN" },
          { id: "d", text: "SELF JOIN" },
        ],
        answer: { optionId: "b" },
        hint: "Think about which table is preserved.",
        explanation: "A LEFT JOIN retains every row from the left table.",
      },
    ],
  };

  it("accepts a set consistent with its generation configuration", () => {
    expect(practiceSetSchema.safeParse(validSet).success).toBe(true);
  });

  it.each([
    ["count", { config: { ...validSet.config, questionCount: 2 } }],
    ["mode", { config: { ...validSet.config, mode: "written" } }],
    ["topic", { questions: [{ ...validSet.questions[0], topic: "aggregations" }] }],
    ["difficulty", { questions: [{ ...validSet.questions[0], difficulty: "advanced" }] }],
    [
      "code language",
      {
        questions: [
          { ...validSet.questions[0], code: { language: "python", source: "print('x')" } },
        ],
      },
    ],
  ])("rejects a set with inconsistent %s", (_label, override) => {
    expect(practiceSetSchema.safeParse({ ...validSet, ...override }).success).toBe(false);
  });
});
