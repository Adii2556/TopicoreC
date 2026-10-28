const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_IN_FLIGHT = 2;
const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let inFlight = 0;
let nextCleanupAt = 0;

export type LimitResult =
  { allowed: true; release: () => void } | { allowed: false; retryAfterSeconds: number };

export function acquireGenerationSlot(source: string, now = Date.now()): LimitResult {
  if (inFlight >= MAX_IN_FLIGHT) {
    return { allowed: false, retryAfterSeconds: 10 };
  }

  if (now >= nextCleanupAt) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    nextCleanupAt = now + CLEANUP_INTERVAL_MS;
  }

  const existing = buckets.get(source);
  if (!existing && buckets.size >= MAX_BUCKETS) {
    return { allowed: false, retryAfterSeconds: 60 };
  }
  const bucket =
    !existing || existing.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : existing;

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }

  bucket.count += 1;
  buckets.set(source, bucket);
  inFlight += 1;

  let released = false;
  return {
    allowed: true,
    release() {
      if (!released) {
        released = true;
        inFlight = Math.max(0, inFlight - 1);
      }
    },
  };
}

export function getTrustedRequestSource(request: Request) {
  if (process.env.VERCEL === "1") {
    return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
  return "single-instance";
}

export function resetRateLimitForTests() {
  buckets.clear();
  inFlight = 0;
  nextCleanupAt = 0;
}
