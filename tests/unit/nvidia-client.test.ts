import { afterEach, describe, expect, it, vi } from "vitest";

import { NvidiaClient } from "@/ai/nvidia/client";
import { ProviderError } from "@/ai/nvidia/errors";
import { PRACTICE_LIMITS } from "@/domain/practice/constants";
import { getMonitorSnapshot, resetMonitorForTests } from "@/monitoring/server";

const config = {
  NVIDIA_API_KEY: "test-key",
  NVIDIA_MODEL: "test-model",
  NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
  NVIDIA_JSON_MODE: "prompt",
} as const;

const completionRequest = {
  messages: [{ role: "user" as const, content: "Return JSON" }],
  maxTokens: 100,
  reasoningBudget: 32,
  temperature: 0,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetMonitorForTests();
});

describe("NvidiaClient", () => {
  it("returns completion text without exposing transport details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new NvidiaClient(config, fetchMock);

    await expect(client.complete(completionRequest)).resolves.toBe('{"ok":true}');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(init.body))).toMatchObject({ reasoning_budget: 32 });
  });

  it("maps rate limits to a retryable typed error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("busy", { status: 429, headers: { "Retry-After": "3" } }));
    const client = new NvidiaClient(config, fetchMock);

    await expect(client.complete(completionRequest)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 3,
    });
  });

  it("supports HTTP-date retry hints and caps excessive delays", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("busy", {
        status: 429,
        headers: { "Retry-After": "Tue, 27 Oct 2026 10:05:00 GMT" },
      }),
    );
    const client = new NvidiaClient(config, fetchMock);

    await expect(client.complete(completionRequest)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_RATE_LIMITED",
      retryAfterSeconds: 60,
    });
  });

  it("maps timeout, network, and server failures without leaking transport errors", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_MONITOR", "true");
    const timeoutClient = new NvidiaClient(
      config,
      vi.fn().mockRejectedValue(new DOMException("secret timeout detail", "TimeoutError")),
    );
    await expect(
      timeoutClient.complete({
        ...completionRequest,
        monitoring: { requestId: "req-timeout", operation: "generation", attempt: 1 },
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      retryable: true,
      message: "The provider request timed out.",
    });

    const timeoutEvents = getMonitorSnapshot().events;
    expect(timeoutEvents.map((event) => event.event)).toEqual([
      "api.request.started",
      "api.request.failed",
    ]);
    expect(timeoutEvents[1]).toMatchObject({
      requestId: "req-timeout",
      status: "failed",
      details: { errorCode: "PROVIDER_TIMEOUT", retryable: true },
    });
    expect(JSON.stringify(timeoutEvents)).not.toContain("secret timeout detail");
    expect(JSON.stringify(timeoutEvents)).not.toContain(config.NVIDIA_API_KEY);

    const networkClient = new NvidiaClient(config, vi.fn().mockRejectedValue(new Error("dns")));
    await expect(networkClient.complete(completionRequest)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });

    const serverClient = new NvidiaClient(
      config,
      vi.fn().mockResolvedValue(new Response("internal", { status: 503 })),
    );
    await expect(serverClient.complete(completionRequest)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
      status: 503,
    });
  });

  it("preserves caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const client = new NvidiaClient(
      config,
      vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    );

    await expect(client.complete(completionRequest, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("stops reading a chunked provider response at the byte cap", async () => {
    const oversizedEnvelope = JSON.stringify({
      choices: [{ message: { content: "x".repeat(PRACTICE_LIMITS.maxProviderResponseBytes) } }],
    });
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(oversizedEnvelope));
          controller.close();
        },
      }),
      { status: 200 },
    );
    const client = new NvidiaClient(config, vi.fn().mockResolvedValue(response));

    await expect(client.complete(completionRequest)).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE",
      retryable: false,
    });
  });

  it("maps a provider response stream failure to a retryable outage", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("stream reset"));
        },
      }),
      { status: 200 },
    );
    const client = new NvidiaClient(config, vi.fn().mockResolvedValue(response));

    await expect(client.complete(completionRequest)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });

  it("rejects malformed provider envelopes", async () => {
    const client = new NvidiaClient(
      config,
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );
    await expect(client.complete(completionRequest)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "INVALID_PROVIDER_RESPONSE",
    });
  });
});
