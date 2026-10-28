import { describe, expect, it } from "vitest";

import type { PracticeSet } from "@/domain/practice/schemas";
import {
  createPracticeSession,
  getReviewQuestionIndices,
  getSessionScore,
  loadPracticeSession,
  practiceSessionReducer,
  practiceSessionStateSchema,
  savePracticeSession,
} from "@/state/practice-session";

const set: PracticeSet = {
  schemaVersion: "1.0",
  sessionId: "34eeb774-b69a-4fec-b94e-eab78308017d",
  createdAt: "2026-10-27T10:00:00.000Z",
  config: {
    subject: "sql",
    topics: ["joins"],
    difficulty: "intermediate",
    questionCount: 2,
    mode: "multiple_choice",
  },
  questions: [
    {
      id: "f52fd3a5-df45-48dd-9d34-cd2c0e71159f",
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which join preserves every left row even when no right row matches?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "SELF JOIN" },
      ],
      answer: { optionId: "b" },
      hint: "Focus on the preserved input side.",
      explanation: "LEFT JOIN preserves each row from its left input.",
    },
    {
      id: "66c7d4b8-c26c-46a3-934c-957c1a891047",
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which join returns only rows with matching keys in both input tables?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "FULL JOIN" },
      ],
      answer: { optionId: "a" },
      hint: "Only matched rows should remain.",
      explanation: "INNER JOIN keeps rows that satisfy the join condition on both sides.",
    },
  ],
};

describe("practiceSessionReducer", () => {
  it("preserves submitted answers across navigation and prevents modification", () => {
    const initial = createPracticeSession(set);
    const firstId = set.questions[0]!.id;
    const selected = practiceSessionReducer(initial, {
      type: "select",
      questionId: firstId,
      optionId: "b",
    });
    const submitted = practiceSessionReducer(selected, { type: "submit", questionId: firstId });
    const moved = practiceSessionReducer(submitted, { type: "go_to", index: 1 });
    const attemptedChange = practiceSessionReducer(moved, {
      type: "select",
      questionId: firstId,
      optionId: "a",
    });

    expect(attemptedChange.answers[firstId]).toEqual({
      selectedOptionId: "b",
      text: "",
      submitted: true,
      selfAssessment: null,
    });
    expect(attemptedChange.currentIndex).toBe(1);
  });

  it("scores submitted answers and keeps skipped questions unanswered", () => {
    const initial = createPracticeSession(set);
    const firstId = set.questions[0]!.id;
    const selected = practiceSessionReducer(initial, {
      type: "select",
      questionId: firstId,
      optionId: "b",
    });
    const submitted = practiceSessionReducer(selected, { type: "submit", questionId: firstId });

    expect(getSessionScore(submitted)).toEqual({
      total: 2,
      objectiveTotal: 2,
      correct: 1,
      incorrect: 0,
      unanswered: 1,
      percentage: 50,
      writtenTotal: 0,
      writtenGotIt: 0,
      writtenNeedsReview: 0,
      writtenUnassessed: 0,
    });
  });

  it("ignores navigation outside the available questions", () => {
    const initial = createPracticeSession(set);
    expect(practiceSessionReducer(initial, { type: "go_to", index: 2 })).toBe(initial);
  });

  it("toggles session bookmarks and limits bookmarked review to marked questions", () => {
    const initial = createPracticeSession(set);
    const secondId = set.questions[1]!.id;
    const bookmarked = practiceSessionReducer(initial, {
      type: "toggle_bookmark",
      questionId: secondId,
    });

    expect(bookmarked.bookmarkedQuestionIds).toEqual([secondId]);
    expect(getReviewQuestionIndices(bookmarked, "bookmarked")).toEqual([1]);

    const complete = practiceSessionReducer(bookmarked, { type: "finish" });
    const reviewing = practiceSessionReducer(complete, {
      type: "review",
      filter: "bookmarked",
    });
    expect(reviewing).toMatchObject({ phase: "review", currentIndex: 1 });
    expect(practiceSessionReducer(reviewing, { type: "go_to", index: 0 })).toBe(reviewing);
  });

  it("focuses review on incorrect and skipped questions", () => {
    const initial = createPracticeSession(set);
    const firstId = set.questions[0]!.id;
    const selected = practiceSessionReducer(initial, {
      type: "select",
      questionId: firstId,
      optionId: "b",
    });
    const submitted = practiceSessionReducer(selected, { type: "submit", questionId: firstId });

    expect(getReviewQuestionIndices(submitted, "priority")).toEqual([1]);

    const complete = practiceSessionReducer(submitted, { type: "finish" });
    expect(practiceSessionReducer(complete, { type: "review", filter: "priority" })).toMatchObject({
      phase: "review",
      currentIndex: 1,
      reviewFilter: "priority",
    });
  });

  it("restores older version-one sessions with safe enhancement defaults", () => {
    const session = createPracticeSession(set);
    const olderSession = {
      version: session.version,
      phase: session.phase,
      set: session.set,
      currentIndex: session.currentIndex,
      answers: session.answers,
      revealedHintIds: session.revealedHintIds,
    };

    expect(practiceSessionStateSchema.parse(olderSession)).toMatchObject({
      bookmarkedQuestionIds: [],
      reviewFilter: "all",
    });
  });

  it("rejects inconsistent stored answers and filtered review positions", () => {
    const session = createPracticeSession(set);
    const firstId = set.questions[0]!.id;
    const missingAnswer = Object.fromEntries(
      Object.entries(session.answers).filter(([questionId]) => questionId !== firstId),
    );

    expect(
      practiceSessionStateSchema.safeParse({ ...session, answers: missingAnswer }).success,
    ).toBe(false);
    expect(
      practiceSessionStateSchema.safeParse({
        ...session,
        phase: "review",
        reviewFilter: "bookmarked",
      }).success,
    ).toBe(false);
    expect(
      practiceSessionStateSchema.safeParse({
        ...session,
        answers: {
          ...session.answers,
          [firstId]: { ...session.answers[firstId], submitted: true, selectedOptionId: null },
        },
      }).success,
    ).toBe(false);
  });

  it("removes corrupt browser sessions and bounds serialized storage", () => {
    sessionStorage.setItem("topicore.practice-session.v1", "not-json");
    expect(loadPracticeSession()).toBeNull();
    expect(sessionStorage.getItem("topicore.practice-session.v1")).toBeNull();

    const oversized = createPracticeSession(set);
    oversized.answers[set.questions[0]!.id]!.text = "x".repeat(800 * 1024);
    expect(savePracticeSession(oversized)).toBe(false);
  });

  it("keeps written grading as explicit self-assessment", () => {
    const writtenSet: PracticeSet = {
      ...set,
      config: { ...set.config, questionCount: 1, mode: "written" },
      questions: [
        {
          id: "76c7d4b8-c26c-46a3-934c-957c1a891048",
          type: "written",
          topic: "joins",
          difficulty: "intermediate",
          prompt: "Explain why a LEFT JOIN may return NULL values from the right table.",
          referenceAnswer:
            "Rows without a matching right-side row are preserved and right-side columns become NULL.",
          keyPoints: ["Left rows are preserved", "Unmatched right columns are NULL"],
          hint: "Consider what represents a missing right-side match.",
          explanation: "The NULL values represent the absent matching right-side row.",
        },
      ],
    };
    const id = writtenSet.questions[0]!.id;
    const initial = createPracticeSession(writtenSet);
    const written = practiceSessionReducer(initial, {
      type: "write",
      questionId: id,
      text: "The right side had no match.",
    });
    const submitted = practiceSessionReducer(written, { type: "submit", questionId: id });
    const assessed = practiceSessionReducer(submitted, {
      type: "assess",
      questionId: id,
      assessment: "needs_review",
    });

    expect(getSessionScore(assessed)).toMatchObject({
      percentage: null,
      writtenTotal: 1,
      writtenNeedsReview: 1,
      correct: 0,
    });
  });
});
