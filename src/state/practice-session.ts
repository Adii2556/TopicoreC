import { z } from "zod";

import { PRACTICE_LIMITS } from "@/domain/practice/constants";
import { optionIdSchema, practiceSetSchema, type PracticeSet } from "@/domain/practice/schemas";

const STORAGE_KEY = "topicore.practice-session.v1";

const reviewFilterSchema = z.enum(["all", "priority", "bookmarked"]);
export type ReviewFilter = z.infer<typeof reviewFilterSchema>;

const answerStateSchema = z
  .object({
    selectedOptionId: optionIdSchema.nullable(),
    text: z.string().max(4_000),
    submitted: z.boolean(),
    selfAssessment: z.enum(["got_it", "needs_review"]).nullable(),
  })
  .strict();

export const practiceSessionStateSchema = z
  .object({
    version: z.literal(1),
    phase: z.enum(["active", "review", "complete"]),
    set: practiceSetSchema,
    currentIndex: z.number().int().nonnegative(),
    answers: z.record(z.string(), answerStateSchema),
    revealedHintIds: z.array(z.string().uuid()),
    bookmarkedQuestionIds: z.array(z.string().uuid()).default([]),
    reviewFilter: reviewFilterSchema.default("all"),
  })
  .strict()
  .superRefine((session, context) => {
    if (session.currentIndex >= session.set.questions.length) {
      context.addIssue({ code: "custom", message: "Current question is out of range." });
    }
    const questionIds = new Set(session.set.questions.map((question) => question.id));
    if (Object.keys(session.answers).some((id) => !questionIds.has(id))) {
      context.addIssue({ code: "custom", message: "Answer references an unknown question." });
    }
    if (session.set.questions.some((question) => !(question.id in session.answers))) {
      context.addIssue({ code: "custom", message: "Every question must have answer state." });
    }
    if (session.revealedHintIds.some((id) => !questionIds.has(id))) {
      context.addIssue({ code: "custom", message: "Hint references an unknown question." });
    }
    if (new Set(session.revealedHintIds).size !== session.revealedHintIds.length) {
      context.addIssue({ code: "custom", message: "Revealed hints must be unique." });
    }
    if (session.bookmarkedQuestionIds.some((id) => !questionIds.has(id))) {
      context.addIssue({ code: "custom", message: "Bookmark references an unknown question." });
    }
    if (new Set(session.bookmarkedQuestionIds).size !== session.bookmarkedQuestionIds.length) {
      context.addIssue({ code: "custom", message: "Bookmarks must be unique." });
    }
    for (const question of session.set.questions) {
      const answer = session.answers[question.id];
      if (!answer) continue;
      if (question.type === "multiple_choice") {
        if (answer.text || answer.selfAssessment !== null) {
          context.addIssue({ code: "custom", message: "MCQ answer state is inconsistent." });
        }
        if (answer.submitted && !answer.selectedOptionId) {
          context.addIssue({ code: "custom", message: "Submitted MCQ answer is missing." });
        }
      } else {
        if (answer.selectedOptionId !== null) {
          context.addIssue({ code: "custom", message: "Written answer state is inconsistent." });
        }
        if (answer.submitted && !answer.text.trim()) {
          context.addIssue({ code: "custom", message: "Submitted written answer is missing." });
        }
        if (!answer.submitted && answer.selfAssessment !== null) {
          context.addIssue({ code: "custom", message: "Unsubmitted answer cannot be assessed." });
        }
      }
    }
    if (session.phase !== "review" && session.reviewFilter !== "all") {
      context.addIssue({ code: "custom", message: "Review filter is inconsistent with phase." });
    }
    if (session.phase === "review") {
      const current = session.set.questions[session.currentIndex];
      const answer = current ? session.answers[current.id] : undefined;
      const currentMatchesFilter =
        session.reviewFilter === "all" ||
        (session.reviewFilter === "bookmarked" &&
          Boolean(current && session.bookmarkedQuestionIds.includes(current.id))) ||
        (session.reviewFilter === "priority" &&
          Boolean(
            current &&
            (current.type === "multiple_choice"
              ? !answer?.submitted || answer.selectedOptionId !== current.answer.optionId
              : !answer?.submitted || answer.selfAssessment !== "got_it"),
          ));
      if (!currentMatchesFilter) {
        context.addIssue({ code: "custom", message: "Current question is outside review scope." });
      }
    }
  });

export type PracticeSessionState = z.infer<typeof practiceSessionStateSchema>;

export type PracticeSessionAction =
  | { type: "select"; questionId: string; optionId: "a" | "b" | "c" | "d" }
  | { type: "write"; questionId: string; text: string }
  | { type: "submit"; questionId: string }
  | { type: "assess"; questionId: string; assessment: "got_it" | "needs_review" }
  | { type: "show_hint"; questionId: string }
  | { type: "toggle_bookmark"; questionId: string }
  | { type: "go_to"; index: number }
  | { type: "finish" }
  | { type: "review"; filter?: ReviewFilter }
  | { type: "resume" };

export function createPracticeSession(set: PracticeSet): PracticeSessionState {
  return {
    version: 1,
    phase: "active",
    set,
    currentIndex: 0,
    answers: Object.fromEntries(
      set.questions.map((question) => [
        question.id,
        { selectedOptionId: null, text: "", submitted: false, selfAssessment: null },
      ]),
    ),
    revealedHintIds: [],
    bookmarkedQuestionIds: [],
    reviewFilter: "all",
  };
}

export function getReviewQuestionIndices(
  state: PracticeSessionState,
  filter: ReviewFilter,
): number[] {
  if (filter === "all") return state.set.questions.map((_, index) => index);

  const bookmarkedIds = new Set(state.bookmarkedQuestionIds);
  return state.set.questions.flatMap((question, index) => {
    if (filter === "bookmarked") return bookmarkedIds.has(question.id) ? [index] : [];

    const answer = state.answers[question.id];
    const needsReview =
      question.type === "multiple_choice"
        ? !answer?.submitted || answer.selectedOptionId !== question.answer.optionId
        : !answer?.submitted || answer.selfAssessment !== "got_it";
    return needsReview ? [index] : [];
  });
}

export function practiceSessionReducer(
  state: PracticeSessionState,
  action: PracticeSessionAction,
): PracticeSessionState {
  switch (action.type) {
    case "select": {
      if (state.phase !== "active") return state;
      const current = state.answers[action.questionId];
      if (!current || current.submitted) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: { ...current, selectedOptionId: action.optionId },
        },
      };
    }
    case "write": {
      if (state.phase !== "active") return state;
      const current = state.answers[action.questionId];
      if (!current || current.submitted) return state;
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: { ...current, text: action.text } },
      };
    }
    case "submit": {
      if (state.phase !== "active") return state;
      const current = state.answers[action.questionId];
      const question = state.set.questions.find((item) => item.id === action.questionId);
      const hasAnswer =
        question?.type === "multiple_choice"
          ? Boolean(current?.selectedOptionId)
          : Boolean(current?.text.trim());
      if (!current || !question || !hasAnswer || current.submitted) return state;
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: { ...current, submitted: true } },
      };
    }
    case "assess": {
      if (state.phase !== "active") return state;
      const current = state.answers[action.questionId];
      const question = state.set.questions.find((item) => item.id === action.questionId);
      if (!current?.submitted || question?.type !== "written") return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: { ...current, selfAssessment: action.assessment },
        },
      };
    }
    case "show_hint":
      return state.revealedHintIds.includes(action.questionId)
        ? state
        : { ...state, revealedHintIds: [...state.revealedHintIds, action.questionId] };
    case "toggle_bookmark": {
      if (state.phase !== "active") return state;
      if (!state.set.questions.some((question) => question.id === action.questionId)) return state;
      const bookmarked = state.bookmarkedQuestionIds.includes(action.questionId);
      return {
        ...state,
        bookmarkedQuestionIds: bookmarked
          ? state.bookmarkedQuestionIds.filter((id) => id !== action.questionId)
          : [...state.bookmarkedQuestionIds, action.questionId],
      };
    }
    case "go_to":
      return action.index >= 0 &&
        action.index < state.set.questions.length &&
        (state.phase !== "review" ||
          getReviewQuestionIndices(state, state.reviewFilter).includes(action.index))
        ? { ...state, currentIndex: action.index }
        : state;
    case "finish":
      return state.phase === "active" ? { ...state, phase: "complete" } : state;
    case "review": {
      if (state.phase !== "complete") return state;
      const reviewFilter = action.filter ?? "all";
      const [currentIndex] = getReviewQuestionIndices(state, reviewFilter);
      return currentIndex === undefined
        ? state
        : { ...state, phase: "review", reviewFilter, currentIndex };
    }
    case "resume":
      return state.phase === "review"
        ? { ...state, phase: "complete", reviewFilter: "all" }
        : state;
  }
}

export function getSessionScore(state: PracticeSessionState) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let writtenGotIt = 0;
  let writtenNeedsReview = 0;
  let writtenUnassessed = 0;
  let objectiveTotal = 0;
  let writtenTotal = 0;

  for (const question of state.set.questions) {
    const answer = state.answers[question.id];
    if (question.type === "multiple_choice") {
      objectiveTotal += 1;
      if (!answer?.submitted || !answer.selectedOptionId) unanswered += 1;
      else if (answer.selectedOptionId === question.answer.optionId) correct += 1;
      else incorrect += 1;
    } else {
      writtenTotal += 1;
      if (!answer?.submitted) unanswered += 1;
      else if (answer.selfAssessment === "got_it") writtenGotIt += 1;
      else if (answer.selfAssessment === "needs_review") writtenNeedsReview += 1;
      else writtenUnassessed += 1;
    }
  }

  return {
    total: state.set.questions.length,
    objectiveTotal,
    correct,
    incorrect,
    unanswered,
    percentage: objectiveTotal === 0 ? null : Math.round((correct / objectiveTotal) * 100),
    writtenTotal,
    writtenGotIt,
    writtenNeedsReview,
    writtenUnassessed,
  };
}

export function savePracticeSession(session: PracticeSessionState) {
  try {
    const serialized = JSON.stringify(session);
    if (new TextEncoder().encode(serialized).byteLength > PRACTICE_LIMITS.maxSessionStorageBytes) {
      return false;
    }
    sessionStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadPracticeSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || new TextEncoder().encode(raw).byteLength > PRACTICE_LIMITS.maxSessionStorageBytes) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const result = practiceSessionStateSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return result.data;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable; there is nothing else to recover.
    }
    return null;
  }
}

export function clearPracticeSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // An unavailable storage API should not block navigation.
  }
}
