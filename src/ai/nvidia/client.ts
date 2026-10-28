import { z } from "zod";

import { PRACTICE_LIMITS } from "@/domain/practice/constants";
import { recordMonitorEvent } from "@/monitoring/server";
import type { ServerConfig } from "@/server/config";
import { BodyTooLargeError, readLimitedText } from "@/server/read-limited-text";

import { ProviderError } from "./errors";
import type { CompletionRequest, QuestionModel } from "./types";

const providerResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z
      .object({
        prompt_tokens: z.number().int().nonnegative().optional(),
        completion_tokens: z.number().int().nonnegative().optional(),
        total_tokens: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type FetchImplementation = typeof fetch;

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.ceil(seconds), 60);
  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt) && retryAt > Date.now()) {
    return Math.min(Math.max(1, Math.ceil((retryAt - Date.now()) / 1_000)), 60);
  }
  return undefined;
}

export class NvidiaClient implements QuestionModel {
  constructor(
    private readonly config: ServerConfig,
    private readonly fetchImplementation: FetchImplementation = fetch,
    private readonly timeoutMs = 60_000,
  ) {}

  async complete(request: CompletionRequest, signal?: AbortSignal) {
    const startedAt = performance.now();
    const monitoring = request.monitoring;
    if (monitoring) {
      recordMonitorEvent({
        requestId: monitoring.requestId,
        event: "api.request.started",
        level: "info",
        source: "nvidia-client",
        status: "started",
        message: "NVIDIA API request started.",
        details: {
          endpoint: "chat/completions",
          model: this.config.NVIDIA_MODEL,
          operation: monitoring.operation,
          attempt: monitoring.attempt,
        },
      });
    }

    try {
      const result = await this.performComplete(request, signal);
      if (monitoring) {
        recordMonitorEvent({
          requestId: monitoring.requestId,
          event: "api.response.received",
          level: "success",
          source: "nvidia-client",
          status: "success",
          message: "NVIDIA API response received and parsed.",
          durationMs: performance.now() - startedAt,
          details: {
            endpoint: "chat/completions",
            model: this.config.NVIDIA_MODEL,
            operation: monitoring.operation,
            attempt: monitoring.attempt,
            httpStatus: result.httpStatus,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            totalTokens: result.totalTokens,
          },
        });
      }
      return result.content;
    } catch (error) {
      if (monitoring) {
        recordMonitorEvent({
          requestId: monitoring.requestId,
          event: "api.request.failed",
          level: "error",
          source: "nvidia-client",
          status: "failed",
          message: error instanceof ProviderError ? error.message : "NVIDIA API request failed.",
          durationMs: performance.now() - startedAt,
          details: {
            endpoint: "chat/completions",
            model: this.config.NVIDIA_MODEL,
            operation: monitoring.operation,
            attempt: monitoring.attempt,
            errorCode: error instanceof ProviderError ? error.code : "REQUEST_ABORTED",
            httpStatus: error instanceof ProviderError ? error.status : undefined,
            retryable: error instanceof ProviderError ? error.retryable : false,
          },
        });
      }
      throw error;
    }
  }

  private async performComplete(request: CompletionRequest, signal?: AbortSignal) {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const body = {
      model: this.config.NVIDIA_MODEL,
      messages: request.messages,
      max_tokens: request.maxTokens,
      ...(request.reasoningBudget === undefined
        ? {}
        : { reasoning_budget: request.reasoningBudget }),
      temperature: request.temperature,
      stream: false,
      ...(this.config.NVIDIA_JSON_MODE === "guided_json" && request.guidedJsonSchema
        ? { nvext: { guided_json: request.guidedJsonSchema } }
        : {}),
    };

    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${this.config.NVIDIA_BASE_URL.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.NVIDIA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: combinedSignal,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ProviderError("PROVIDER_TIMEOUT", "The provider request timed out.", true);
      }
      if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
        throw error;
      }
      throw new ProviderError("PROVIDER_UNAVAILABLE", "The provider could not be reached.", true);
    }

    if (!response.ok) {
      const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
      if (response.status === 429) {
        throw new ProviderError(
          "PROVIDER_RATE_LIMITED",
          "The provider is currently rate limited.",
          true,
          response.status,
          retryAfterSeconds,
        );
      }
      if (response.status >= 500) {
        throw new ProviderError(
          "PROVIDER_UNAVAILABLE",
          "The provider is temporarily unavailable.",
          true,
          response.status,
        );
      }
      throw new ProviderError(
        "PROVIDER_REJECTED",
        "The provider rejected the request.",
        false,
        response.status,
      );
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > PRACTICE_LIMITS.maxProviderResponseBytes
    ) {
      throw new ProviderError(
        "INVALID_PROVIDER_RESPONSE",
        "The provider response was too large.",
        false,
      );
    }

    let text: string;
    try {
      text = await readLimitedText(response.body, PRACTICE_LIMITS.maxProviderResponseBytes);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        throw new ProviderError(
          "INVALID_PROVIDER_RESPONSE",
          "The provider response was too large.",
          false,
        );
      }
      throw new ProviderError(
        "PROVIDER_UNAVAILABLE",
        "The provider response could not be read.",
        true,
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ProviderError(
        "INVALID_PROVIDER_RESPONSE",
        "The provider returned invalid JSON.",
        false,
      );
    }

    const parsed = providerResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ProviderError(
        "INVALID_PROVIDER_RESPONSE",
        "The provider response did not match the expected contract.",
        false,
      );
    }

    const content = parsed.data.choices[0]?.message.content;
    if (!content) {
      throw new ProviderError(
        "INVALID_PROVIDER_RESPONSE",
        "The provider returned no completion content.",
        false,
      );
    }

    return {
      content,
      httpStatus: response.status,
      promptTokens: parsed.data.usage?.prompt_tokens,
      completionTokens: parsed.data.usage?.completion_tokens,
      totalTokens: parsed.data.usage?.total_tokens,
    };
  }
}
