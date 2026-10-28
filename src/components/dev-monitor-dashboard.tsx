"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MonitorEvent, MonitorSnapshot, MonitorValue } from "@/monitoring/types";

function text(value: MonitorValue | undefined) {
  return typeof value === "string" ? value : value === undefined ? "—" : String(value);
}

function number(value: MonitorValue | undefined) {
  return typeof value === "number" ? value : undefined;
}

function formatDuration(value?: number) {
  if (value === undefined) return "—";
  return value >= 1_000 ? `${(value / 1_000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(new Date(value));
}

function badge(status: MonitorEvent["status"]) {
  if (status === "success") return "border-emerald-500/40 text-emerald-300";
  if (status === "failed") return "border-red-500/40 text-red-300";
  if (status === "retry") return "border-amber-500/40 text-amber-300";
  return "border-sky-500/40 text-sky-300";
}

function eventKey(event: MonitorEvent) {
  return `${event.requestId}:${text(event.details.operation)}:${text(event.details.attempt)}`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function DevMonitorDashboard({ initialSnapshot }: { initialSnapshot: MonitorSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [paused, setPaused] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState("");
  const [expandedApi, setExpandedApi] = useState("");
  const [copied, setCopied] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/dev/monitor", { cache: "no-store" });
      if (!response.ok) throw new Error(`Monitor unavailable (${response.status})`);
      const next = (await response.json()) as MonitorSnapshot;
      if (!Array.isArray(next.events)) throw new Error("Monitor returned invalid data");
      setSnapshot(next);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Monitor data is unavailable");
    }
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(timer);
  }, [paused, refresh]);

  const requestIds = useMemo(
    () =>
      [
        ...new Set(
          snapshot.events
            .filter((event) => event.requestId.startsWith("req_"))
            .map((event) => event.requestId),
        ),
      ].reverse(),
    [snapshot.events],
  );

  const effectiveSelectedRequest = requestIds.includes(selectedRequest)
    ? selectedRequest
    : (requestIds[0] ?? "");

  const metrics = useMemo(() => {
    const events = snapshot.events;
    const completed = events.filter((event) => event.event === "generation.completed");
    const durations = completed
      .map((event) => event.durationMs)
      .filter((value): value is number => value !== undefined);
    const active = new Map<string, MonitorEvent>();
    for (const event of events) {
      if (event.event.startsWith("generation.")) active.set(event.requestId, event);
    }
    const activeEvents = [...active.values()].filter(
      (event) =>
        event.status === "started" || event.status === "processing" || event.status === "retry",
    );
    const latestGeneration = [...events]
      .reverse()
      .find((event) => event.event.startsWith("generation."));
    return {
      total: events.filter((event) => event.event === "generation.started").length,
      success: completed.length,
      failed: events.filter((event) => event.event === "generation.failed").length,
      apiRequests: events.filter((event) => event.event === "api.request.started").length,
      apiFailures: events.filter((event) => event.event === "api.request.failed").length,
      averageMs: durations.length
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : undefined,
      returned: events
        .filter(
          (event) => event.event === "validation.passed" || event.event === "validation.failed",
        )
        .reduce((sum, event) => sum + (number(event.details.returnedCount) ?? 0), 0),
      accepted: completed.reduce(
        (sum, event) => sum + (number(event.details.questionCount) ?? 0),
        0,
      ),
      rejected: events
        .filter((event) => event.event === "validation.failed")
        .reduce((sum, event) => sum + (number(event.details.rejectedCount) ?? 0), 0),
      retries: events.filter((event) => event.event === "generation.retry").length,
      active: activeEvents.length,
      status: latestGeneration?.status ?? "info",
    };
  }, [snapshot.events]);

  const apiOperations = useMemo(() => {
    const operations = new Map<string, { start?: MonitorEvent; end?: MonitorEvent }>();
    for (const event of snapshot.events) {
      if (!event.event.startsWith("api.")) continue;
      const key = eventKey(event);
      const current = operations.get(key) ?? {};
      if (event.event === "api.request.started") current.start = event;
      else current.end = event;
      operations.set(key, current);
    }
    return [...operations.entries()].reverse();
  }, [snapshot.events]);

  const selectedEvents = useMemo(
    () => snapshot.events.filter((event) => event.requestId === effectiveSelectedRequest),
    [effectiveSelectedRequest, snapshot.events],
  );

  const sources = useMemo(
    () => [...new Set(snapshot.events.map((event) => event.source))].sort(),
    [snapshot.events],
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...snapshot.events]
      .reverse()
      .filter((event) => level === "all" || event.level === level)
      .filter((event) => source === "all" || event.source === source)
      .filter(
        (event) =>
          !query ||
          `${event.event} ${event.message} ${event.requestId} ${event.source}`
            .toLocaleLowerCase()
            .includes(query),
      );
  }, [level, search, snapshot.events, source]);

  const recentErrors = useMemo(
    () =>
      snapshot.events
        .filter((event) => event.level === "error")
        .slice(-5)
        .reverse(),
    [snapshot.events],
  );

  async function clearLogs() {
    if (!window.confirm("Clear all in-memory developer monitor events?")) return;
    try {
      const response = await fetch("/api/dev/monitor", { method: "DELETE" });
      if (!response.ok) throw new Error(`Could not clear monitor history (${response.status})`);
      setSnapshot((current) => ({
        ...current,
        events: [],
        generatedAt: new Date().toISOString(),
      }));
      setSelectedRequest("");
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not clear monitor history");
    }
  }

  async function copyDiagnostic() {
    const report = {
      generatedAt: new Date().toISOString(),
      requestId: effectiveSelectedRequest,
      events: selectedEvents,
    };
    if (await copyText(JSON.stringify(report, null, 2))) {
      setCopied("diagnostic");
      setLoadError("");
    } else {
      setLoadError("Clipboard access failed. Check this browser's clipboard permission.");
    }
  }

  const cards = [
    ["Generation requests", metrics.total],
    ["Successful", metrics.success],
    ["Failed", metrics.failed],
    ["Provider requests", metrics.apiRequests],
    ["Provider failures", metrics.apiFailures],
    ["Average generation", formatDuration(metrics.averageMs)],
    ["Questions returned", metrics.returned],
    ["Questions accepted", metrics.accepted],
    ["Validation rejections", metrics.rejected],
    ["Retry attempts", metrics.retries],
  ];

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-6 sm:px-6"
      id="main-content"
    >
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
            Development only
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Topicore monitor</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Bounded in-memory telemetry · polling every second · no raw prompts or responses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button-secondary" href="/">
            Open generator
          </Link>
          <button
            className="button-secondary"
            onClick={() => setPaused((value) => !value)}
            type="button"
          >
            {paused ? "Resume updates" : "Pause updates"}
          </button>
          <button className="button-secondary" onClick={() => void refresh()} type="button">
            Refresh
          </button>
          <button
            className="button-secondary text-[var(--danger)]"
            onClick={() => void clearLogs()}
            type="button"
          >
            Clear history
          </button>
        </div>
      </header>

      {loadError ? (
        <p
          className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
          role="alert"
        >
          {loadError}
        </p>
      ) : null}

      <section aria-labelledby="overview-heading" className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold" id="overview-heading">
            Overview
          </h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge(metrics.status)}`}
          >
            {metrics.active > 0
              ? `Processing (${metrics.active})`
              : metrics.status === "failed"
                ? "Failed"
                : metrics.status === "success"
                  ? "Success"
                  : "Idle"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map(([label, value]) => (
            <article
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              key={label}
            >
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold">Recent errors</h3>
          {recentErrors.length ? (
            <ul className="mt-3 grid gap-2">
              {recentErrors.map((event) => (
                <li className="text-sm text-[var(--text-muted)]" key={event.id}>
                  <span className="font-mono text-xs text-red-300">
                    {formatTime(event.timestamp)}
                  </span>{" "}
                  · {event.message} <span className="font-mono text-xs">({event.requestId})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No errors recorded.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="api-heading" className="mt-9">
        <h2 className="text-xl font-semibold" id="api-heading">
          NVIDIA API monitor
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Request</th>
                <th className="p-3">Endpoint</th>
                <th className="p-3">Operation</th>
                <th className="p-3">Model</th>
                <th className="p-3">Status</th>
                <th className="p-3">HTTP</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Tokens</th>
                <th className="p-3">Attempt</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {apiOperations.length ? (
                apiOperations.map(([key, operation]) => {
                  const event = operation.end ?? operation.start!;
                  const expanded = expandedApi === key;
                  return (
                    <tr className="border-t border-[var(--border)] align-top" key={key}>
                      <td className="p-3 font-mono text-xs">{formatTime(event.timestamp)}</td>
                      <td className="p-3 font-mono text-xs">{event.requestId}</td>
                      <td className="p-3">{text(event.details.endpoint)}</td>
                      <td className="p-3">{text(event.details.operation)}</td>
                      <td className="p-3">{text(event.details.model)}</td>
                      <td className="p-3">
                        <span className={`rounded border px-2 py-1 text-xs ${badge(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="p-3">{text(event.details.httpStatus)}</td>
                      <td className="p-3">{formatDuration(event.durationMs)}</td>
                      <td className="p-3">{text(event.details.totalTokens)}</td>
                      <td className="p-3">{text(event.details.attempt)}</td>
                      <td className="p-3">
                        <button
                          className="text-[var(--accent)] underline-offset-4 hover:underline"
                          onClick={() => setExpandedApi(expanded ? "" : key)}
                          type="button"
                        >
                          {expanded ? "Hide" : "Inspect"}
                        </button>
                        {expanded ? (
                          <pre className="mt-2 max-w-md whitespace-pre-wrap text-xs text-[var(--text-muted)]">
                            {JSON.stringify(
                              {
                                message: operation.end?.message ?? operation.start?.message,
                                start: operation.start?.details,
                                end: operation.end?.details,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 text-[var(--text-muted)]" colSpan={11}>
                    No provider requests recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="trace-heading" className="mt-9">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold" id="trace-heading">
              Generation timeline
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Inspect actual stages for one request.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Selected request"
              className="field-control min-w-64"
              onChange={(event) => setSelectedRequest(event.target.value)}
              value={effectiveSelectedRequest}
            >
              <option value="">No request selected</option>
              {requestIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button
              className="button-secondary"
              disabled={!effectiveSelectedRequest}
              onClick={() => void copyDiagnostic()}
              type="button"
            >
              {copied === "diagnostic" ? "Copied" : "Copy diagnostic report"}
            </button>
          </div>
        </div>
        <ol className="mt-4 grid gap-3">
          {selectedEvents.length ? (
            selectedEvents.map((event) => (
              <li
                className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[150px_1fr_auto]"
                key={event.id}
              >
                <div>
                  <p className="font-mono text-xs text-[var(--text-muted)]">
                    {formatTime(event.timestamp)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDuration(event.durationMs)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm text-[var(--accent)]">{event.event}</p>
                  <p className="mt-1 text-sm">{event.message}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[var(--text-muted)]">
                      Sanitized metadata
                    </summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </details>
                </div>
                <span className={`h-fit rounded border px-2 py-1 text-xs ${badge(event.status)}`}>
                  {event.status}
                </span>
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">
              No events are available for this request.
            </li>
          )}
        </ol>
      </section>

      <section aria-labelledby="logs-heading" className="mt-9 pb-12">
        <h2 className="text-xl font-semibold" id="logs-heading">
          Console and error logs
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_200px]">
          <input
            aria-label="Search logs"
            className="field-control"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search event, message, source, request…"
            type="search"
            value={search}
          />
          <select
            aria-label="Filter by severity"
            className="field-control"
            onChange={(event) => setLevel(event.target.value)}
            value={level}
          >
            <option value="all">All severities</option>
            {["debug", "info", "warning", "error", "success"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by source"
            className="field-control"
            onChange={(event) => setSource(event.target.value)}
            value={source}
          >
            <option value="all">All sources</option>
            {sources.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 grid gap-2">
          {filteredLogs.length ? (
            filteredLogs.map((event) => (
              <details
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                key={event.id}
              >
                <summary className="grid cursor-pointer gap-2 text-sm sm:grid-cols-[110px_70px_180px_1fr_auto]">
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className={
                      event.level === "error"
                        ? "text-red-300"
                        : event.level === "warning"
                          ? "text-amber-300"
                          : "text-[var(--accent)]"
                    }
                  >
                    {event.level}
                  </span>
                  <span className="font-mono text-xs">{event.source}</span>
                  <span>{event.message}</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {event.requestId}
                  </span>
                </summary>
                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-[var(--text-muted)]">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                  <button
                    className="mt-3 text-xs text-[var(--accent)]"
                    onClick={async () => {
                      if (await copyText(JSON.stringify(event, null, 2))) {
                        setCopied(event.id);
                        setLoadError("");
                      } else {
                        setLoadError(
                          "Clipboard access failed. Check this browser's clipboard permission.",
                        );
                      }
                    }}
                    type="button"
                  >
                    {copied === event.id ? "Copied" : "Copy log entry"}
                  </button>
                </div>
              </details>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">
              No logs match the current filters.
            </p>
          )}
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Retaining {snapshot.events.length} of {snapshot.capacity} maximum events. Data disappears
          on restart and is not shared across server instances.
        </p>
      </section>
    </main>
  );
}
