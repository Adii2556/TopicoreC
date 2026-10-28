import { describe, expect, it } from "vitest";

import { NvidiaClient } from "@/ai/nvidia/client";
import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest } from "@/domain/practice/schemas";
import { generatePracticeSet } from "@/generation/pipeline";
import { readServerConfig } from "@/server/config";

const liveDescribe = process.env.LIVE_NVIDIA === "1" ? describe : describe.skip;

class CallTrackingModel implements QuestionModel {
  calls = 0;
  outputs: string[] = [];

  constructor(private readonly client: NvidiaClient) {}

  async complete(...args: Parameters<QuestionModel["complete"]>) {
    this.calls += 1;
    try {
      const output = await this.client.complete(...args);
      this.outputs.push(output);
      return output;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown provider error";
      throw new Error(`NVIDIA completion call ${this.calls} failed: ${detail}`, { cause: error });
    }
  }
}

const cases: Array<{ name: string; request: GeneratePracticeSetRequest }> = [
  {
    name: "SQL multiple choice",
    request: {
      subject: "sql",
      topics: ["joins"],
      difficulty: "beginner",
      questionCount: 1,
      mode: "multiple_choice",
    },
  },
  {
    name: "SQL written",
    request: {
      subject: "sql",
      topics: ["query optimization"],
      difficulty: "advanced",
      questionCount: 1,
      mode: "written",
    },
  },
  {
    name: "SQL mixed",
    request: {
      subject: "sql",
      topics: ["aggregations"],
      difficulty: "intermediate",
      questionCount: 2,
      mode: "mixed",
    },
  },
  {
    name: "Python multiple choice",
    request: {
      subject: "python",
      topics: ["generators"],
      difficulty: "advanced",
      questionCount: 1,
      mode: "multiple_choice",
    },
  },
  {
    name: "Python written",
    request: {
      subject: "python",
      topics: ["dictionaries"],
      difficulty: "beginner",
      questionCount: 1,
      mode: "written",
    },
  },
  {
    name: "Python mixed",
    request: {
      subject: "python",
      topics: ["functions"],
      difficulty: "intermediate",
      questionCount: 2,
      mode: "mixed",
    },
  },
];

liveDescribe("live NVIDIA generation", () => {
  for (const testCase of cases) {
    it(
      testCase.name,
      async () => {
        const model = new CallTrackingModel(new NvidiaClient(readServerConfig()));
        let result;
        try {
          result = await generatePracticeSet(testCase.request, model);
        } catch (error) {
          const outputShapes = model.outputs.map((output) => ({
            length: output.length,
            startsWithFence: output.trimStart().startsWith("```"),
            startsWithObject: output.trimStart().startsWith("{"),
            endsWithObject: output.trimEnd().endsWith("}"),
            parseError: (() => {
              try {
                JSON.parse(output);
                return null;
              } catch (parseError) {
                return parseError instanceof Error ? parseError.message : "unknown parse error";
              }
            })(),
          }));
          throw new Error(`Live pipeline failed; output shapes: ${JSON.stringify(outputShapes)}`, {
            cause: error,
          });
        }

        expect(result.questions).toHaveLength(testCase.request.questionCount);
        expect(model.calls).toBeGreaterThanOrEqual(2);
        expect(model.calls).toBeLessThanOrEqual(4);
      },
      180_000,
    );
  }
});
