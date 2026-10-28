export type ProviderErrorCode =
  | "PROVIDER_REJECTED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_PROVIDER_RESPONSE";

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
