import { NextResponse } from "next/server";

import { NvidiaClient } from "@/ai/nvidia/client";
import { ProviderError } from "@/ai/nvidia/errors";
import { PRACTICE_LIMITS } from "@/domain/practice/constants";
import { generatePracticeSetRequestSchema } from "@/domain/practice/schemas";
import { generatePracticeSet } from "@/generation/pipeline";
import { DraftValidationError } from "@/generation/validate-draft";
import { readServerConfig, ServerConfigError } from "@/server/config";
import { problemResponse } from "@/server/problem-response";
import { acquireGenerationSlot, getTrustedRequestSource } from "@/server/rate-limit";
import { BodyTooLargeError, readLimitedText } from "@/server/read-limited-text";
import { createRequestId } from "@/server/request-id";
import { SemanticReviewError } from "@/verification/semantic-review";

export const runtime = "nodejs";

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
      ?.split(",")[0]
      ?.trim()
      .toLocaleLowerCase();
    return Boolean(requestHost) && new URL(origin).host.toLocaleLowerCase() === requestHost;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!hasValidOrigin(request)) {
    return problemResponse(
      {
        code: "REQUEST_REJECTED",
        detail: "This request is not allowed.",
        retryable: false,
        status: 403,
        title: "Request rejected",
      },
      requestId,
    );
  }

  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLocaleLowerCase();
  if (mediaType !== "application/json") {
    return problemResponse(
      {
        code: "UNSUPPORTED_MEDIA_TYPE",
        detail: "Send the request as JSON.",
        retryable: false,
        status: 415,
        title: "Unsupported content type",
      },
      requestId,
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PRACTICE_LIMITS.maxRequestBytes) {
    return problemResponse(
      {
        code: "REQUEST_TOO_LARGE",
        detail: "The request is too large.",
        retryable: false,
        status: 413,
        title: "Request too large",
      },
      requestId,
    );
  }

  let text: string;
  try {
    text = await readLimitedText(request.body, PRACTICE_LIMITS.maxRequestBytes);
  } catch (error) {
    if (!(error instanceof BodyTooLargeError)) {
      return problemResponse(
        {
          code: "INVALID_REQUEST",
          detail: "The request body could not be read.",
          retryable: false,
          status: 400,
          title: "Invalid request",
        },
        requestId,
      );
    }
    return problemResponse(
      {
        code: "REQUEST_TOO_LARGE",
        detail: "The request is too large.",
        retryable: false,
        status: 413,
        title: "Request too large",
      },
      requestId,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return problemResponse(
      {
        code: "INVALID_REQUEST",
        detail: "The request body is not valid JSON.",
        retryable: false,
        status: 400,
        title: "Invalid request",
      },
      requestId,
    );
  }

  const parsedRequest = generatePracticeSetRequestSchema.safeParse(json);
  if (!parsedRequest.success) {
    return problemResponse(
      {
        code: "INVALID_REQUEST",
        detail: "Check the practice settings and try again.",
        retryable: false,
        status: 422,
        title: "Invalid practice settings",
      },
      requestId,
    );
  }

  const slot = acquireGenerationSlot(getTrustedRequestSource(request));
  if (!slot.allowed) {
    return problemResponse(
      {
        code: "RATE_LIMITED",
        detail: "Too many generation requests. Please wait before trying again.",
        retryable: true,
        retryAfterSeconds: slot.retryAfterSeconds,
        status: 429,
        title: "Generation limit reached",
      },
      requestId,
    );
  }

  try {
    const client = new NvidiaClient(readServerConfig());
    const data = await generatePracticeSet(parsedRequest.data, client, request.signal);
    return NextResponse.json(
      { data, meta: { requestId } },
      {
        status: 201,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
      },
    );
  } catch (error) {
    if (error instanceof ServerConfigError) {
      return problemResponse(
        {
          code: "SERVICE_NOT_CONFIGURED",
          detail: "Question generation is not configured yet.",
          retryable: false,
          status: 503,
          title: "Generation unavailable",
        },
        requestId,
      );
    }
    if (error instanceof DraftValidationError) {
      return problemResponse(
        {
          code: "INVALID_AI_RESPONSE",
          detail: "The generated questions could not be validated. Please try again.",
          retryable: true,
          status: 502,
          title: "Questions could not be validated",
        },
        requestId,
      );
    }
    if (error instanceof SemanticReviewError) {
      return problemResponse(
        {
          code: "QUESTION_VERIFICATION_FAILED",
          detail: "The questions did not pass the accuracy review. Please try again.",
          retryable: true,
          status: 502,
          title: "Questions could not be verified",
        },
        requestId,
      );
    }
    if (error instanceof ProviderError) {
      return problemResponse(
        {
          code: error.code,
          detail: error.retryable
            ? "The question service is temporarily unavailable. Please try again."
            : "The question service could not complete this request.",
          retryable: error.retryable,
          retryAfterSeconds: error.retryAfterSeconds,
          status: error.retryable ? 503 : 502,
          title: error.retryable ? "Question service unavailable" : "Generation failed",
        },
        requestId,
      );
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return problemResponse(
        {
          code: "REQUEST_CANCELLED",
          detail: "Generation was cancelled.",
          retryable: true,
          status: 499,
          title: "Request cancelled",
        },
        requestId,
      );
    }
    return problemResponse(
      {
        code: "INTERNAL_ERROR",
        detail: "An unexpected error prevented generation.",
        retryable: true,
        status: 500,
        title: "Unexpected error",
      },
      requestId,
    );
  } finally {
    slot.release();
  }
}
