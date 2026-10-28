import { describe, expect, it, vi } from "vitest";

import { ProviderError } from "@/ai/nvidia/errors";
import type { QuestionModel } from "@/ai/nvidia/types";
import type { GeneratePracticeSetRequest } from "@/domain/practice/schemas";
import { generatePracticeSet } from "@/generation/pipeline";

const request: GeneratePracticeSetRequest = {
  subject: "sql",
  topics: ["joins"],
  difficulty: "intermediate",
  questionCount: 1,
  mode: "multiple_choice",
};

const validResponse = JSON.stringify({
  schemaVersion: "1.0",
  questions: [
    {
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which SQL join preserves every row from the left input table?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "SELF JOIN" },
      ],
      answer: { optionId: "b" },
      hint: "Think about which input side is retained.",
      explanation: "LEFT JOIN retains every left-side row even when the right side has no match.",
    },
  ],
});

const validReview = JSON.stringify({
  schemaVersion: "1.0",
  verdicts: [
    {
      index: 0,
      rationale: "LEFT JOIN preserves every row from the left input.",
      verdict: "pass",
      issues: [],
    },
  ],
});

describe("generatePracticeSet", () => {
  it("assigns trusted IDs after validating model output", async () => {
    const model: QuestionModel = {
      complete: vi.fn().mockResolvedValueOnce(validResponse).mockResolvedValueOnce(validReview),
    };
    const set = await generatePracticeSet(request, model);

    expect(set.questions).toHaveLength(1);
    expect(set.questions[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(model.complete).toHaveBeenCalledTimes(2);
  });

  it("retries one structurally invalid response and revalidates the replacement", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(validResponse)
      .mockResolvedValueOnce(validReview);
    const model: QuestionModel = { complete };
    const set = await generatePracticeSet(request, model, undefined, { sleep: async () => {} });

    expect(set.questions).toHaveLength(1);
    expect(model.complete).toHaveBeenCalledTimes(3);
    expect(complete.mock.calls[1]?.[0].messages[0]?.content).toContain('["invalid_json"]');
  });

  it("stops after retry exhaustion", async () => {
    const model: QuestionModel = { complete: vi.fn().mockResolvedValue("not json") };
    await expect(
      generatePracticeSet(request, model, undefined, { sleep: async () => {} }),
    ).rejects.toThrow("Generated questions failed validation");
    expect(model.complete).toHaveBeenCalledTimes(2);
  });

  it("regenerates once after a failed semantic review", async () => {
    const failedReview = JSON.stringify({
      schemaVersion: "1.0",
      verdicts: [
        {
          index: 0,
          rationale: "The selected option is not correct for the stated prompt.",
          verdict: "fail",
          issues: ["incorrect_answer"],
        },
      ],
    });
    const complete = vi
      .fn()
      .mockResolvedValueOnce(validResponse)
      .mockResolvedValueOnce(failedReview)
      .mockResolvedValueOnce(validResponse)
      .mockResolvedValueOnce(validReview);
    const model: QuestionModel = { complete };

    await expect(
      generatePracticeSet(request, model, undefined, { sleep: async () => {} }),
    ).resolves.toMatchObject({ questions: [{ type: "multiple_choice" }] });
    expect(model.complete).toHaveBeenCalledTimes(4);
    expect(complete.mock.calls[2]?.[0].messages[0]?.content).toContain('["incorrect_answer"]');
  });

  it("rejects questions after semantic review retry exhaustion", async () => {
    const failedReview = JSON.stringify({
      schemaVersion: "1.0",
      verdicts: [
        {
          index: 0,
          rationale: "The selected option is not correct for the stated prompt.",
          verdict: "fail",
          issues: ["incorrect_answer"],
        },
      ],
    });
    const model: QuestionModel = {
      complete: vi
        .fn()
        .mockResolvedValueOnce(validResponse)
        .mockResolvedValueOnce(failedReview)
        .mockResolvedValueOnce(validResponse)
        .mockResolvedValueOnce(failedReview),
    };

    await expect(
      generatePracticeSet(request, model, undefined, { sleep: async () => {} }),
    ).rejects.toThrow("Generated questions failed semantic review");
    expect(model.complete).toHaveBeenCalledTimes(4);
  });

  it("retries one transient provider outage", async () => {
    const model: QuestionModel = {
      complete: vi
        .fn()
        .mockRejectedValueOnce(new ProviderError("PROVIDER_UNAVAILABLE", "temporary", true, 503))
        .mockResolvedValueOnce(validResponse)
        .mockResolvedValueOnce(validReview),
    };

    await expect(
      generatePracticeSet(request, model, undefined, { sleep: async () => {} }),
    ).resolves.toMatchObject({ questions: [{ type: "multiple_choice" }] });
    expect(model.complete).toHaveBeenCalledTimes(3);
  });

  it("does not retry provider rejection or caller cancellation", async () => {
    const rejectedModel: QuestionModel = {
      complete: vi
        .fn()
        .mockRejectedValue(new ProviderError("PROVIDER_REJECTED", "rejected", false, 400)),
    };
    await expect(
      generatePracticeSet(request, rejectedModel, undefined, { sleep: async () => {} }),
    ).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });
    expect(rejectedModel.complete).toHaveBeenCalledTimes(1);

    const cancelledModel: QuestionModel = {
      complete: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    };
    await expect(
      generatePracticeSet(request, cancelledModel, undefined, { sleep: async () => {} }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelledModel.complete).toHaveBeenCalledTimes(1);
  });

  it("stops before a retry when cancellation occurs during backoff", async () => {
    const controller = new AbortController();
    const model: QuestionModel = {
      complete: vi
        .fn()
        .mockRejectedValue(new ProviderError("PROVIDER_UNAVAILABLE", "temporary", true, 503)),
    };

    await expect(
      generatePracticeSet(request, model, controller.signal, {
        sleep: async () => controller.abort(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(model.complete).toHaveBeenCalledTimes(1);
  });
});
