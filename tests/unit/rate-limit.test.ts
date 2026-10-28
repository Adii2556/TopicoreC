import { beforeEach, describe, expect, it } from "vitest";

import { acquireGenerationSlot, resetRateLimitForTests } from "@/server/rate-limit";

beforeEach(() => resetRateLimitForTests());

describe("generation rate limits", () => {
  it("caps concurrent generation and releases a slot idempotently", () => {
    const first = acquireGenerationSlot("first", 1_000);
    const second = acquireGenerationSlot("second", 1_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(acquireGenerationSlot("third", 1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 10,
    });

    if (first.allowed) {
      first.release();
      first.release();
    }
    const replacement = acquireGenerationSlot("third", 1_000);
    expect(replacement.allowed).toBe(true);
  });

  it("enforces and resets the fixed request window", () => {
    for (let count = 0; count < 5; count += 1) {
      const slot = acquireGenerationSlot("learner", 1_000);
      expect(slot.allowed).toBe(true);
      if (slot.allowed) slot.release();
    }

    const limited = acquireGenerationSlot("learner", 1_000);
    expect(limited.allowed).toBe(false);
    if (!limited.allowed) expect(limited.retryAfterSeconds).toBe(600);

    expect(acquireGenerationSlot("learner", 601_000).allowed).toBe(true);
  });

  it("bounds source-cardinality growth and recovers after expiry", () => {
    for (let index = 0; index < 10_000; index += 1) {
      const slot = acquireGenerationSlot(`source-${index}`, 1_000);
      expect(slot.allowed).toBe(true);
      if (slot.allowed) slot.release();
    }

    expect(acquireGenerationSlot("overflow", 1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const afterExpiry = acquireGenerationSlot("overflow", 601_000);
    expect(afterExpiry.allowed).toBe(true);
  });
});
