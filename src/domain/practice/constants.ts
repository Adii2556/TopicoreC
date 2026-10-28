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
  maxRequestBytes: 8 * 1024,
  maxProviderResponseBytes: 256 * 1024,
  maxSessionStorageBytes: 768 * 1024,
} as const;
