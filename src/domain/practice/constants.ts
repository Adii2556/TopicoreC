export const SUBJECTS = ["sql", "python"] as const;
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const QUESTION_MODES = ["multiple_choice", "written", "mixed"] as const;

export const PRACTICE_LIMITS = {
  minTopics: 1,
  maxTopics: 5,
  minTopicLength: 2,
  maxTopicLength: 80,
  minQuestions: 1,
  maxQuestions: 10,
  minQuestionPromptLength: 10,
  maxQuestionPromptLength: 1_200,
  minCodeSourceLength: 1,
  maxCodeSourceLength: 2_000,
  optionCount: 4,
  minOptionTextLength: 1,
  maxOptionTextLength: 500,
  minReferenceAnswerLength: 1,
  maxReferenceAnswerLength: 1_500,
  minKeyPoints: 1,
  maxKeyPoints: 5,
  minKeyPointLength: 2,
  maxKeyPointLength: 300,
  minHintLength: 1,
  maxHintLength: 500,
  minExplanationLength: 10,
  maxExplanationLength: 1_500,
  maxRequestBytes: 8 * 1024,
  maxProviderResponseBytes: 256 * 1024,
  maxSessionStorageBytes: 768 * 1024,
} as const;
