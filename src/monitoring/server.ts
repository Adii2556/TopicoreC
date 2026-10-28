import type { MonitorEvent, MonitorEventInput, MonitorSnapshot, MonitorValue } from "./types";

const MONITOR_CAPACITY = 1_000;
const MAX_STRING_LENGTH = 2_000;
const MAX_ARRAY_LENGTH = 30;
const MAX_DEPTH = 5;

interface MonitorStoreState {
  events: MonitorEvent[];
}

declare global {
  var __topicoreDevMonitorStore: MonitorStoreState | undefined;
}

function getStore() {
  globalThis.__topicoreDevMonitorStore ??= { events: [] };
  return globalThis.__topicoreDevMonitorStore;
}

const sensitiveKeys = new Set([
  "authorization",
  "api_key",
  "apikey",
  "nvidia_api_key",
  "password",
  "secret",
  "access_token",
  "refresh_token",
  "cookie",
  "set-cookie",
  "rawprompt",
  "rawresponse",
  "requestbody",
  "responsebody",
]);

function sanitizeString(value: string) {
  return value
    .slice(0, MAX_STRING_LENGTH)
    .replace(/nvapi-[A-Za-z0-9_-]+/g, "[REDACTED_NVIDIA_KEY]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]");
}

function sanitizeValue(value: unknown, depth: number): MonitorValue {
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const sanitized: Record<string, MonitorValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_ARRAY_LENGTH)) {
      sanitized[key] = sensitiveKeys.has(key.toLocaleLowerCase())
        ? "[REDACTED]"
        : sanitizeValue(item, depth + 1);
    }
    return sanitized;
  }
  return String(value);
}

export function isDevMonitorEnabled() {
  return process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_MONITOR === "true";
}

export function sanitizeMonitorDetails(details: Record<string, unknown> = {}) {
  return sanitizeValue(details, 0) as Record<string, MonitorValue>;
}

export function recordMonitorEvent(input: MonitorEventInput) {
  if (!isDevMonitorEnabled()) return undefined;
  const event: MonitorEvent = {
    id: `evt_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    requestId: sanitizeString(input.requestId),
    event: sanitizeString(input.event),
    level: input.level,
    source: sanitizeString(input.source),
    status: input.status,
    message: sanitizeString(input.message),
    ...(input.durationMs === undefined
      ? {}
      : { durationMs: Math.max(0, Math.round(input.durationMs * 100) / 100) }),
    details: sanitizeMonitorDetails(input.details),
  };
  const store = getStore();
  store.events.push(event);
  if (store.events.length > MONITOR_CAPACITY) {
    store.events.splice(0, store.events.length - MONITOR_CAPACITY);
  }
  return event;
}

export function getMonitorSnapshot(): MonitorSnapshot {
  return {
    events: [...getStore().events],
    generatedAt: new Date().toISOString(),
    capacity: MONITOR_CAPACITY,
  };
}

export function clearMonitorEvents() {
  getStore().events.length = 0;
}

export function resetMonitorForTests() {
  clearMonitorEvents();
}
