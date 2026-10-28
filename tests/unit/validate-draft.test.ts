import { describe, expect, it } from "vitest";

import type { GeneratePracticeSetRequest } from "@/domain/practice/schemas";
import { DraftValidationError, parseAndValidateDraft } from "@/generation/validate-draft";

const request: GeneratePracticeSetRequest = {
  subject: "sql",
  topics: ["joins"],
  difficulty: "intermediate",
  questionCount: 1,
  mode: "multiple_choice",
};

const validQuestion = {
  type: "multiple_choice",
  topic: "joins",
  difficulty: "intermediate",
  prompt: "Which SQL join retains every row from the left table?",
  options: [
    { id: "a", text: "INNER JOIN" },
    { id: "b", text: "LEFT JOIN" },
    { id: "c", text: "CROSS JOIN" },
    { id: "d", text: "SELF JOIN" },
  ],
  answer: { optionId: "b" },
  hint: "Consider which side must be preserved even without a match.",
  explanation: "LEFT JOIN preserves all rows from its left input and adds matching right rows.",
};

describe("parseAndValidateDraft", () => {
  it("accepts a complete structurally consistent set", () => {
    const result = parseAndValidateDraft(
      JSON.stringify({ schemaVersion: "1.0", questions: [validQuestion] }),
      request,
    );
    expect(result.questions).toHaveLength(1);
  });

  it("rejects Markdown-wrapped JSON", () => {
    expect(() =>
      parseAndValidateDraft(
        `\`\`\`json\n${JSON.stringify({ schemaVersion: "1.0", questions: [validQuestion] })}\n\`\`\``,
        request,
      ),
    ).toThrow("Generated questions failed validation");
  });

  it("rejects duplicated option text", () => {
    const invalid = {
      ...validQuestion,
      options: validQuestion.options.map((option) => ({ ...option, text: "Same answer" })),
    };
    expect(() =>
      parseAndValidateDraft(
        JSON.stringify({ schemaVersion: "1.0", questions: [invalid] }),
        request,
      ),
    ).toThrow("Generated questions failed validation");
  });

  it.each([
    ["unknown fields", { ...validQuestion, unexpected: true }, "unrecognized_keys"],
    ["wrong topic", { ...validQuestion, topic: "aggregations" }, "off_topic"],
    ["wrong difficulty", { ...validQuestion, difficulty: "advanced" }, "difficulty_mismatch"],
    [
      "wrong code language",
      { ...validQuestion, code: { language: "python", source: "print('x')" } },
      "wrong_code_language",
    ],
    [
      "answer-leaking hint",
      { ...validQuestion, hint: "Option b is the answer." },
      "hint_leaks_answer",
    ],
  ])("rejects %s", (_label, question, expectedIssue) => {
    try {
      parseAndValidateDraft(
        JSON.stringify({ schemaVersion: "1.0", questions: [question] }),
        request,
      );
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(DraftValidationError);
      expect((error as DraftValidationError).issues.join(" ")).toContain(expectedIssue);
    }
  });

  it("rejects substantially duplicated questions", () => {
    const twoQuestionRequest: GeneratePracticeSetRequest = {
      ...request,
      questionCount: 2,
    };
    expect(() =>
      parseAndValidateDraft(
        JSON.stringify({ schemaVersion: "1.0", questions: [validQuestion, validQuestion] }),
        twoQuestionRequest,
      ),
    ).toThrow("Generated questions failed validation");
  });

  it("preserves Unicode letters when checking uniqueness", () => {
    const unicodeRequest: GeneratePracticeSetRequest = {
      subject: "python",
      topics: ["字典"],
      difficulty: "intermediate",
      questionCount: 1,
      mode: "multiple_choice",
    };
    const unicodeQuestion = {
      type: "multiple_choice",
      topic: "字典",
      difficulty: "intermediate",
      prompt: "在 Python 中，哪种方式可以安全地读取可能不存在的字典键？",
      options: [
        { id: "a", text: "使用 get 方法" },
        { id: "b", text: "直接使用方括号" },
        { id: "c", text: "删除这个键" },
        { id: "d", text: "把字典转换为列表" },
      ],
      answer: { optionId: "a" },
      hint: "考虑可以提供默认值的方法。",
      explanation: "get 方法在键不存在时可以返回默认值，而不会抛出 KeyError。",
    };

    expect(
      parseAndValidateDraft(
        JSON.stringify({ schemaVersion: "1.0", questions: [unicodeQuestion] }),
        unicodeRequest,
      ).questions,
    ).toHaveLength(1);
  });

  it("accepts a written response with a reference and distinct key points", () => {
    const writtenRequest: GeneratePracticeSetRequest = {
      ...request,
      subject: "python",
      topics: ["dictionaries"],
      mode: "written",
    };
    const writtenQuestion = {
      type: "written",
      topic: "dictionaries",
      difficulty: "intermediate",
      prompt: "Explain when a Python dictionary lookup can raise a KeyError.",
      referenceAnswer:
        "Indexing with a key that is absent raises KeyError; get() can supply a fallback instead.",
      keyPoints: ["Missing indexed key raises KeyError", "get() supports a fallback"],
      hint: "Compare square-bracket lookup with the get method.",
      explanation:
        "Dictionary indexing requires the key to exist, while get returns None or a supplied default.",
    };

    const result = parseAndValidateDraft(
      JSON.stringify({ schemaVersion: "1.0", questions: [writtenQuestion] }),
      writtenRequest,
    );

    expect(result.questions[0]?.type).toBe("written");
  });

  it("rejects a mixed response with question types in the wrong order", () => {
    const mixedRequest: GeneratePracticeSetRequest = {
      ...request,
      questionCount: 2,
      mode: "mixed",
    };
    expect(() =>
      parseAndValidateDraft(
        JSON.stringify({ schemaVersion: "1.0", questions: [validQuestion, validQuestion] }),
        mixedRequest,
      ),
    ).toThrow("Generated questions failed validation");
  });
});
