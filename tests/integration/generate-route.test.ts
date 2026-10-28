import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/practice/generate/route";
import { PRACTICE_LIMITS } from "@/domain/practice/constants";
import { getMonitorSnapshot, resetMonitorForTests } from "@/monitoring/server";
import { resetRateLimitForTests } from "@/server/rate-limit";

const url = "http://localhost/api/practice/generate";

beforeEach(() => {
  resetRateLimitForTests();
  resetMonitorForTests();
});
afterEach(() => {
  resetMonitorForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const validRequest = {
  subject: "sql",
  topics: ["joins"],
  difficulty: "intermediate",
  questionCount: 1,
  mode: "multiple_choice",
};

const validGeneration = JSON.stringify({
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
      hint: "Consider which input side is preserved.",
      explanation: "LEFT JOIN preserves every left-side row even when no match exists.",
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

function jsonRequest(body: unknown = validRequest) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: "localhost" },
    body: JSON.stringify(body),
  });
}

function configuredRequest(body: unknown = validRequest) {
  vi.stubEnv("NVIDIA_API_KEY", "test-key");
  vi.stubEnv("NVIDIA_MODEL", "test-model");
  vi.stubEnv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
  vi.stubEnv("NVIDIA_JSON_MODE", "prompt");
  return jsonRequest(body);
}

describe("POST /api/practice/generate", () => {
  it("rejects non-JSON requests", async () => {
    const response = await POST(new Request(url, { method: "POST", body: "hello" }));
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    const misleadingType = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/jsonp" },
        body: "{}",
      }),
    );
    expect(misleadingType.status).toBe(415);
  });

  it("rejects malformed JSON without contacting the provider", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{broken",
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("rejects an invalid cross-origin request", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: "localhost",
          Origin: "https://attacker.example",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("accepts a case-insensitive same-origin host behind a forwarded proxy", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Host: "internal:3000",
          Origin: "https://TOPICORE.EXAMPLE",
          "X-Forwarded-Host": "topicore.example, internal:3000",
        },
        body: JSON.stringify(validRequest),
      }),
    );
    expect(response.status).toBe(503);
  });

  it("returns a safe configuration error when the server key is absent", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequest),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SERVICE_NOT_CONFIGURED" });
  });

  it("rejects invalid settings and both declared and streamed oversized bodies", async () => {
    const invalid = await POST(configuredRequest({ ...validRequest, questionCount: 0 }));
    expect(invalid.status).toBe(422);

    const declared = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(PRACTICE_LIMITS.maxRequestBytes + 1),
        },
        body: "{}",
      }),
    );
    expect(declared.status).toBe(413);

    const streamed = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padding: "x".repeat(PRACTICE_LIMITS.maxRequestBytes) }),
      }),
    );
    expect(streamed.status).toBe(413);
  });

  it("returns a validated no-store set through the complete route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: validGeneration } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: validReview } }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(configuredRequest());
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(payload.data).toMatchObject({ config: validRequest });
    expect(payload.data.questions[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records one correlated request lifecycle without raw AI content", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_MONITOR", "true");
    vi.stubEnv("NVIDIA_API_KEY", "test-key");
    vi.stubEnv("NVIDIA_MODEL", "test-model");
    vi.stubEnv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
    vi.stubEnv("NVIDIA_JSON_MODE", "prompt");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: validGeneration } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: validReview } }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const requestId = "req_11111111-1111-4111-8111-111111111111";
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: "localhost",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify(validRequest),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe(requestId);
    const events = getMonitorSnapshot().events.filter((event) => event.requestId === requestId);
    expect(events.map((event) => event.event)).toEqual(
      expect.arrayContaining([
        "http.request.received",
        "input.validated",
        "generation.started",
        "prompt.created",
        "api.request.started",
        "api.response.received",
        "json.parse.completed",
        "validation.passed",
        "semantic_review.passed",
        "generation.completed",
        "http.request.completed",
      ]),
    );
    expect(events.find((event) => event.event === "api.response.received")?.details).toMatchObject({
      totalTokens: 30,
    });
    expect(JSON.stringify(events)).not.toContain(validGeneration);
    expect(JSON.stringify(events)).not.toContain("test-key");
  });

  it("records parse failures, a retry, and retry exhaustion", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_MONITOR", "true");
    vi.stubEnv("NVIDIA_API_KEY", "test-key");
    vi.stubEnv("NVIDIA_MODEL", "test-model");
    vi.stubEnv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
    vi.stubEnv("NVIDIA_JSON_MODE", "prompt");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), {
            status: 200,
          }),
      ),
    );

    const response = await POST(configuredRequest());
    expect(response.status).toBe(502);
    const events = getMonitorSnapshot().events;
    expect(events.filter((event) => event.event === "json.parse.failed")).toHaveLength(2);
    expect(events.map((event) => event.event)).toEqual(
      expect.arrayContaining(["generation.retry", "generation.failed", "http.request.failed"]),
    );
  });

  it("maps provider rejection to a safe response without leaking credentials or provider data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("sensitive provider diagnostic", { status: 401 })),
    );

    const response = await POST(configuredRequest());
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toContain("PROVIDER_REJECTED");
    expect(body).not.toContain("test-key");
    expect(body).not.toContain("sensitive provider diagnostic");
  });

  it("enforces the per-instance request window with a retry hint", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    for (let index = 0; index < 5; index += 1) {
      expect((await POST(jsonRequest())).status).toBe(503);
    }

    const limited = await POST(jsonRequest());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ code: "RATE_LIMITED", retryable: true });
  });
});
