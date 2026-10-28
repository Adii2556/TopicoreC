import type { GeneratePracticeSetRequest } from "./schemas";

export type StoredQuestionType = "multiple_choice" | "written";

export function getExpectedQuestionTypes(
  mode: GeneratePracticeSetRequest["mode"],
  questionCount: number,
): StoredQuestionType[] {
  if (mode === "multiple_choice") return Array.from({ length: questionCount }, () => mode);
  if (mode === "written") return Array.from({ length: questionCount }, () => mode);
  return Array.from({ length: questionCount }, (_, index) =>
    index % 2 === 0 ? "multiple_choice" : "written",
  );
}
