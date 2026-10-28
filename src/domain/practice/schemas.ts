import { z } from "zod";

import { DIFFICULTIES, PRACTICE_LIMITS, QUESTION_MODES, SUBJECTS } from "./constants";
import { getExpectedQuestionTypes } from "./mode";

export const subjectSchema = z.enum(SUBJECTS);
export const difficultySchema = z.enum(DIFFICULTIES);
export const questionModeSchema = z.enum(QUESTION_MODES);

const topicSchema = z
  .string()
  .trim()
  .min(PRACTICE_LIMITS.minTopicLength, "Use at least 2 characters per topic.")
  .max(PRACTICE_LIMITS.maxTopicLength, "Keep each topic under 80 characters.");

function normalizeTopic(topic: string) {
  return topic.normalize("NFKC").toLocaleLowerCase();
}

export const generatePracticeSetRequestSchema = z
  .object({
    subject: subjectSchema,
    topics: z
      .array(topicSchema)
      .min(PRACTICE_LIMITS.minTopics, "Add at least one topic.")
      .max(PRACTICE_LIMITS.maxTopics, "Use no more than five topics.")
      .refine(
        (topics) => new Set(topics.map(normalizeTopic)).size === topics.length,
        "Remove duplicate topics.",
      ),
    difficulty: difficultySchema,
    questionCount: z
      .number()
      .int()
      .min(PRACTICE_LIMITS.minQuestions)
      .max(PRACTICE_LIMITS.maxQuestions),
    mode: questionModeSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.mode === "mixed" && request.questionCount < 2) {
      context.addIssue({
        code: "custom",
        message: "Mixed sessions need at least two questions.",
        path: ["questionCount"],
      });
    }
  });

export const optionIdSchema = z.enum(["a", "b", "c", "d"]);

export const multipleChoiceDraftSchema = z
  .object({
    type: z.literal("multiple_choice"),
    topic: topicSchema,
    difficulty: difficultySchema,
    prompt: z
      .string()
      .trim()
      .min(PRACTICE_LIMITS.minQuestionPromptLength)
      .max(PRACTICE_LIMITS.maxQuestionPromptLength),
    code: z
      .object({
        language: subjectSchema,
        source: z
          .string()
          .min(PRACTICE_LIMITS.minCodeSourceLength)
          .max(PRACTICE_LIMITS.maxCodeSourceLength),
      })
      .strict()
      .optional(),
    options: z
      .array(
        z
          .object({
            id: optionIdSchema,
            text: z
              .string()
              .trim()
              .min(PRACTICE_LIMITS.minOptionTextLength)
              .max(PRACTICE_LIMITS.maxOptionTextLength),
          })
          .strict(),
      )
      .length(PRACTICE_LIMITS.optionCount),
    answer: z.object({ optionId: optionIdSchema }).strict(),
    hint: z.string().trim().min(PRACTICE_LIMITS.minHintLength).max(PRACTICE_LIMITS.maxHintLength),
    explanation: z
      .string()
      .trim()
      .min(PRACTICE_LIMITS.minExplanationLength)
      .max(PRACTICE_LIMITS.maxExplanationLength),
  })
  .strict();

export const writtenDraftSchema = z
  .object({
    type: z.literal("written"),
    topic: topicSchema,
    difficulty: difficultySchema,
    prompt: z
      .string()
      .trim()
      .min(PRACTICE_LIMITS.minQuestionPromptLength)
      .max(PRACTICE_LIMITS.maxQuestionPromptLength),
    code: z
      .object({
        language: subjectSchema,
        source: z
          .string()
          .min(PRACTICE_LIMITS.minCodeSourceLength)
          .max(PRACTICE_LIMITS.maxCodeSourceLength),
      })
      .strict()
      .optional(),
    referenceAnswer: z
      .string()
      .trim()
      .min(PRACTICE_LIMITS.minReferenceAnswerLength)
      .max(PRACTICE_LIMITS.maxReferenceAnswerLength),
    keyPoints: z
      .array(
        z
          .string()
          .trim()
          .min(PRACTICE_LIMITS.minKeyPointLength)
          .max(PRACTICE_LIMITS.maxKeyPointLength),
      )
      .min(PRACTICE_LIMITS.minKeyPoints)
      .max(PRACTICE_LIMITS.maxKeyPoints),
    hint: z.string().trim().min(PRACTICE_LIMITS.minHintLength).max(PRACTICE_LIMITS.maxHintLength),
    explanation: z
      .string()
      .trim()
      .min(PRACTICE_LIMITS.minExplanationLength)
      .max(PRACTICE_LIMITS.maxExplanationLength),
  })
  .strict();

export const questionDraftSchema = z.discriminatedUnion("type", [
  multipleChoiceDraftSchema,
  writtenDraftSchema,
]);

export const generatedSetDraftSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    questions: z.array(questionDraftSchema).min(1).max(PRACTICE_LIMITS.maxQuestions),
  })
  .strict();

export const multipleChoiceQuestionSchema = multipleChoiceDraftSchema.extend({
  id: z.string().uuid(),
});

export const writtenQuestionSchema = writtenDraftSchema.extend({
  id: z.string().uuid(),
});

export const practiceQuestionSchema = z.discriminatedUnion("type", [
  multipleChoiceQuestionSchema,
  writtenQuestionSchema,
]);

export const practiceSetSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    sessionId: z.string().uuid(),
    createdAt: z.string().datetime(),
    config: generatePracticeSetRequestSchema,
    questions: z.array(practiceQuestionSchema).min(1).max(PRACTICE_LIMITS.maxQuestions),
  })
  .strict()
  .superRefine((set, context) => {
    if (set.questions.length !== set.config.questionCount) {
      context.addIssue({ code: "custom", message: "Question count does not match the request." });
    }
    const expectedTypes = getExpectedQuestionTypes(set.config.mode, set.config.questionCount);
    const topics = new Set(set.config.topics.map(normalizeTopic));
    set.questions.forEach((question, index) => {
      if (question.type !== expectedTypes[index]) {
        context.addIssue({
          code: "custom",
          message: "Question type does not match the requested mode.",
          path: ["questions", index, "type"],
        });
      }
      if (!topics.has(normalizeTopic(question.topic))) {
        context.addIssue({
          code: "custom",
          message: "Question topic does not match the request.",
          path: ["questions", index, "topic"],
        });
      }
      if (question.difficulty !== set.config.difficulty) {
        context.addIssue({
          code: "custom",
          message: "Question difficulty does not match the request.",
          path: ["questions", index, "difficulty"],
        });
      }
      if (question.code && question.code.language !== set.config.subject) {
        context.addIssue({
          code: "custom",
          message: "Question code language does not match the subject.",
          path: ["questions", index, "code", "language"],
        });
      }
    });
  });

export type GeneratePracticeSetRequest = z.infer<typeof generatePracticeSetRequestSchema>;
export type MultipleChoiceDraft = z.infer<typeof multipleChoiceDraftSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
export type WrittenDraft = z.infer<typeof writtenDraftSchema>;
export type WrittenQuestion = z.infer<typeof writtenQuestionSchema>;
export type QuestionDraft = z.infer<typeof questionDraftSchema>;
export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;
export type PracticeSet = z.infer<typeof practiceSetSchema>;
