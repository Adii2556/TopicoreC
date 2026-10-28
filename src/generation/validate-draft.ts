import { getExpectedQuestionTypes } from "@/domain/practice/mode";
import type { GeneratePracticeSetRequest, QuestionDraft } from "@/domain/practice/schemas";
import { generatedSetDraftSchema } from "@/domain/practice/schemas";

export class DraftValidationError extends Error {
  constructor(readonly issues: string[]) {
    super("Generated questions failed validation.");
    this.name = "DraftValidationError";
  }
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(normalize(left).split(" ").filter(Boolean));
  const b = new Set(normalize(right).split(" ").filter(Boolean));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
}

function validateQuestion(question: QuestionDraft, request: GeneratePracticeSetRequest) {
  const issues: string[] = [];
  const requestedTopics = new Set(request.topics.map(normalize));
  if (!requestedTopics.has(normalize(question.topic))) issues.push("off_topic");
  if (question.difficulty !== request.difficulty) issues.push("difficulty_mismatch");
  if (question.code && question.code.language !== request.subject)
    issues.push("wrong_code_language");

  const normalizedHint = normalize(question.hint);
  if (question.type === "multiple_choice") {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== 4) issues.push("duplicate_option_id");
    if (!(["a", "b", "c", "d"] as const).every((id) => optionIds.includes(id))) {
      issues.push("missing_option_id");
    }
    const optionTexts = question.options.map((option) => normalize(option.text));
    if (new Set(optionTexts).size !== 4) issues.push("duplicate_option_text");
    if (!optionIds.includes(question.answer.optionId)) issues.push("missing_answer_option");
    const correctText = question.options.find(
      (option) => option.id === question.answer.optionId,
    )?.text;
    if (
      correctText &&
      (normalizedHint === normalize(correctText) ||
        normalizedHint.includes(`option ${question.answer.optionId}`))
    ) {
      issues.push("hint_leaks_answer");
    }
  } else {
    if (new Set(question.keyPoints.map(normalize)).size !== question.keyPoints.length) {
      issues.push("duplicate_key_point");
    }
    if (normalizedHint === normalize(question.referenceAnswer)) issues.push("hint_leaks_answer");
  }

  return issues;
}

export function parseAndValidateDraft(raw: string, request: GeneratePracticeSetRequest) {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new DraftValidationError(["invalid_json"]);
  }

  const parsed = generatedSetDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new DraftValidationError(
      parsed.error.issues.map(
        (issue) => `${issue.code}:${issue.path.length > 0 ? issue.path.join(".") : "root"}`,
      ),
    );
  }

  const issues: string[] = [];
  if (parsed.data.questions.length !== request.questionCount) issues.push("wrong_question_count");
  const expectedTypes = getExpectedQuestionTypes(request.mode, request.questionCount);
  parsed.data.questions.forEach((question, index) => {
    if (question.type !== expectedTypes[index]) issues.push("wrong_question_type_mix");
    issues.push(...validateQuestion(question, request));
  });

  for (let left = 0; left < parsed.data.questions.length; left += 1) {
    for (let right = left + 1; right < parsed.data.questions.length; right += 1) {
      const a = parsed.data.questions[left];
      const b = parsed.data.questions[right];
      if (a && b && tokenSimilarity(a.prompt, b.prompt) >= 0.8) issues.push("duplicate_question");
    }
  }

  if (issues.length > 0) throw new DraftValidationError([...new Set(issues)]);
  return parsed.data;
}
