"use client";

import { useEffect } from "react";

import { reportClientMonitorEvent } from "@/monitoring/client";

export function DevMonitorBridge({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const reportError = (event: ErrorEvent) => {
      reportClientMonitorEvent(true, {
        requestId: "browser",
        event: "client.error",
        level: "error",
        source: "browser",
        status: "failed",
        message: "An uncaught browser error occurred.",
        details: { errorName: event.error instanceof Error ? event.error.name : "Error" },
      });
    };
    const reportRejection = (event: PromiseRejectionEvent) => {
      reportClientMonitorEvent(true, {
        requestId: "browser",
        event: "client.unhandled_rejection",
        level: "error",
        source: "browser",
        status: "failed",
        message: "An unhandled browser promise rejection occurred.",
        details: {
          errorName: event.reason instanceof Error ? event.reason.name : "UnknownRejection",
        },
      });
    };
    window.addEventListener("error", reportError);
    window.addEventListener("unhandledrejection", reportRejection);
    return () => {
      window.removeEventListener("error", reportError);
      window.removeEventListener("unhandledrejection", reportRejection);
    };
  }, [enabled]);

  return null;
}
