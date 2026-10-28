import { afterEach, describe, expect, it, vi } from "vitest";

import { readServerConfig, ServerConfigError } from "@/server/config";

afterEach(() => vi.unstubAllEnvs());

function stubRequiredConfig() {
  vi.stubEnv("NVIDIA_API_KEY", "test-key");
  vi.stubEnv("NVIDIA_MODEL", "test-model");
  vi.stubEnv("NVIDIA_JSON_MODE", "prompt");
}

describe("readServerConfig", () => {
  it("accepts an HTTPS NVIDIA endpoint", () => {
    stubRequiredConfig();
    vi.stubEnv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");

    expect(readServerConfig()).toMatchObject({
      NVIDIA_MODEL: "test-model",
      NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    });
  });

  it.each([
    "http://integrate.api.nvidia.com/v1",
    "https://provider.example/v1",
    "https://integrate.api.nvidia.com/v1?key=unsafe",
    "https://user:password@integrate.api.nvidia.com/v1",
  ])("rejects an unsafe provider URL: %s", (baseUrl) => {
    stubRequiredConfig();
    vi.stubEnv("NVIDIA_BASE_URL", baseUrl);

    expect(() => readServerConfig()).toThrow(ServerConfigError);
  });

  it("rejects missing credentials without including configuration details", () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    vi.stubEnv("NVIDIA_MODEL", "test-model");

    expect(() => readServerConfig()).toThrow("Required server configuration is unavailable.");
  });
});
