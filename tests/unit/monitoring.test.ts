import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMonitorSnapshot,
  isDevMonitorEnabled,
  recordMonitorEvent,
  resetMonitorForTests,
  sanitizeMonitorDetails,
} from "@/monitoring/server";

beforeEach(() => resetMonitorForTests());
afterEach(() => {
  resetMonitorForTests();
  vi.unstubAllEnvs();
});

function enableMonitor() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ENABLE_DEV_MONITOR", "true");
}

describe("development monitoring store", () => {
  it("cannot be enabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_DEV_MONITOR", "true");
    expect(isDevMonitorEnabled()).toBe(false);
    expect(
      recordMonitorEvent({
        requestId: "req-test",
        event: "test.event",
        level: "info",
        source: "test",
        status: "info",
        message: "not stored",
      }),
    ).toBeUndefined();
    expect(getMonitorSnapshot().events).toHaveLength(0);
  });

  it("redacts credentials while retaining token-usage metadata", () => {
    const details = sanitizeMonitorDetails({
      authorization: "Bearer secret-value",
      apiKey: "unsafe",
      note: "credential nvapi-example-value",
      totalTokens: 42,
    });

    expect(details).toMatchObject({
      authorization: "[REDACTED]",
      apiKey: "[REDACTED]",
      note: "credential [REDACTED_NVIDIA_KEY]",
      totalTokens: 42,
    });
  });

  it("retains only the newest 1,000 actual events", () => {
    enableMonitor();
    for (let index = 0; index < 1_005; index += 1) {
      recordMonitorEvent({
        requestId: `req-${index}`,
        event: "test.event",
        level: "debug",
        source: "test",
        status: "info",
        message: `event ${index}`,
      });
    }

    const snapshot = getMonitorSnapshot();
    expect(snapshot.events).toHaveLength(1_000);
    expect(snapshot.capacity).toBe(1_000);
    expect(snapshot.events[0]?.message).toBe("event 5");
    expect(snapshot.events.at(-1)?.message).toBe("event 1004");
  });
});
