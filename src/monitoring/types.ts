export const MONITOR_LEVELS = ["debug", "info", "warning", "error", "success"] as const;
export type MonitorLevel = (typeof MONITOR_LEVELS)[number];

export const MONITOR_STATUSES = [
  "started",
  "processing",
  "success",
  "failed",
  "retry",
  "info",
] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export type MonitorValue =
  string | number | boolean | null | MonitorValue[] | { [key: string]: MonitorValue };

export interface MonitorEvent {
  id: string;
  timestamp: string;
  requestId: string;
  event: string;
  level: MonitorLevel;
  source: string;
  status: MonitorStatus;
  message: string;
  durationMs?: number;
  details: Record<string, MonitorValue>;
}

export interface MonitorEventInput {
  requestId: string;
  event: string;
  level: MonitorLevel;
  source: string;
  status: MonitorStatus;
  message: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export interface MonitorSnapshot {
  events: MonitorEvent[];
  generatedAt: string;
  capacity: number;
}

export interface CompletionMonitoringContext {
  requestId: string;
  attempt: number;
  operation: "generation" | "semantic_review";
}
