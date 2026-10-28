import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/dev/monitor/events/route";
import { DELETE, GET } from "@/app/api/dev/monitor/route";
import { recordMonitorEvent, resetMonitorForTests } from "@/monitoring/server";

beforeEach(() => resetMonitorForTests());
afterEach(() => {
  resetMonitorForTests();
  vi.unstubAllEnvs();
});

function enableMonitor() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ENABLE_DEV_MONITOR", "true");
}

describe("development monitor API", () => {
  it("accepts, lists, and clears sanitized development events", async () => {
    enableMonitor();
    const response = await POST(
      new Request("http://localhost/api/dev/monitor/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "req-browser",
          event: "frontend.generation.submitted",
          level: "info",
          source: "generation-form",
          status: "started",
          message: "Browser submitted generation.",
          details: { authorization: "Bearer unsafe", questionCount: 2 },
        }),
      }),
    );
    expect(response.status).toBe(204);

    const listed = await GET();
    expect(listed.status).toBe(200);
    expect(listed.headers.get("cache-control")).toBe("no-store");
    expect(await listed.json()).toMatchObject({
      events: [
        {
          event: "frontend.generation.submitted",
          details: { authorization: "[REDACTED]", questionCount: 2 },
        },
      ],
      capacity: 1_000,
    });

    expect((await DELETE()).status).toBe(204);
    expect(await (await GET()).json()).toMatchObject({ events: [] });
  });

  it("rejects malformed client events", async () => {
    enableMonitor();
    const response = await POST(
      new Request("http://localhost/api/dev/monitor/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "missing-fields" }),
      }),
    );
    expect(response.status).toBe(422);
  });

  it("returns not found in production even when the flag is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_DEV_MONITOR", "true");
    recordMonitorEvent({
      requestId: "req-test",
      event: "test.event",
      level: "info",
      source: "test",
      status: "info",
      message: "must not be stored",
    });

    expect((await GET()).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
    expect(
      (
        await POST(
          new Request("http://localhost/api/dev/monitor/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(404);
  });
});
