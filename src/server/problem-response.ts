import { NextResponse } from "next/server";

export interface ProblemDetails {
  code: string;
  detail: string;
  retryAfterSeconds?: number;
  retryable: boolean;
  status: number;
  title: string;
}

export function problemResponse(problem: ProblemDetails, requestId: string) {
  const response = NextResponse.json(
    {
      type: `https://topicore.app/problems/${problem.code.toLocaleLowerCase().replaceAll("_", "-")}`,
      title: problem.title,
      status: problem.status,
      code: problem.code,
      detail: problem.detail,
      requestId,
      retryable: problem.retryable,
      ...(problem.retryAfterSeconds ? { retryAfterSeconds: problem.retryAfterSeconds } : {}),
    },
    {
      status: problem.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...(problem.retryAfterSeconds ? { "Retry-After": String(problem.retryAfterSeconds) } : {}),
      },
    },
  );

  response.headers.set("Content-Type", "application/problem+json");
  return response;
}
