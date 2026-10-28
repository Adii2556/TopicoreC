import { z } from "zod";

import { MONITOR_LEVELS, MONITOR_STATUSES } from "@/monitoring/types";
import { isDevMonitorEnabled, recordMonitorEvent } from "@/monitoring/server";
import { BodyTooLargeError, readLimitedText } from "@/server/read-limited-text";

export const runtime = "nodejs";

const clientEventSchema = z
  .object({
    requestId: z.string().trim().min(1).max(100),
    event: z.string().trim().min(1).max(100),
    level: z.enum(MONITOR_LEVELS),
    source: z.string().trim().min(1).max(80),
    status: z.enum(MONITOR_STATUSES),
    message: z.string().trim().min(1).max(500),
    durationMs: z.number().nonnegative().max(300_000).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function unavailable() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isDevMonitorEnabled()) return unavailable();
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return Response.json({ error: "JSON required" }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 16_384) {
    return Response.json({ error: "Event too large" }, { status: 413 });
  }

  let text: string;
  try {
    text = await readLimitedText(request.body, 16_384);
  } catch (error) {
    return Response.json(
      { error: error instanceof BodyTooLargeError ? "Event too large" : "Invalid body" },
      { status: error instanceof BodyTooLargeError ? 413 : 400 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = clientEventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid event" }, { status: 422 });

  recordMonitorEvent(parsed.data);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
