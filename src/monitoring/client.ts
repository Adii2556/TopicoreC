"use client";

export interface ClientMonitorEvent {
  requestId: string;
  event: string;
  level: "debug" | "info" | "warning" | "error" | "success";
  source: string;
  status: "started" | "processing" | "success" | "failed" | "retry" | "info";
  message: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export function reportClientMonitorEvent(enabled: boolean, event: ClientMonitorEvent) {
  if (!enabled) return;
  void fetch("/api/dev/monitor/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
}
