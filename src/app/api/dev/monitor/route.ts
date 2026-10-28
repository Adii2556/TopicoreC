import { NextResponse } from "next/server";

import { clearMonitorEvents, getMonitorSnapshot, isDevMonitorEnabled } from "@/monitoring/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  if (!isDevMonitorEnabled()) return unavailable();
  return NextResponse.json(getMonitorSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export function DELETE() {
  if (!isDevMonitorEnabled()) return unavailable();
  clearMonitorEvents();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
