import { z } from "zod";

const nvidiaBaseUrlSchema = z.url().superRefine((value, context) => {
  const url = new URL(value);
  const nvidiaHost = url.hostname === "nvidia.com" || url.hostname.endsWith(".nvidia.com");
  if (url.protocol !== "https:" || !nvidiaHost) {
    context.addIssue({
      code: "custom",
      message: "NVIDIA_BASE_URL must use HTTPS on an NVIDIA-owned host.",
    });
  }
  if (url.username || url.password || url.search || url.hash) {
    context.addIssue({
      code: "custom",
      message: "NVIDIA_BASE_URL cannot contain credentials, a query, or a fragment.",
    });
  }
});

const serverConfigSchema = z
  .object({
    NVIDIA_API_KEY: z.string().trim().min(1),
    NVIDIA_MODEL: z.string().trim().min(1),
    NVIDIA_BASE_URL: nvidiaBaseUrlSchema.default("https://integrate.api.nvidia.com/v1"),
    NVIDIA_JSON_MODE: z.enum(["prompt", "guided_json"]).default("prompt"),
  })
  .strict();

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export class ServerConfigError extends Error {
  constructor() {
    super("Required server configuration is unavailable.");
    this.name = "ServerConfigError";
  }
}

export function readServerConfig(): ServerConfig {
  const result = serverConfigSchema.safeParse({
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
    NVIDIA_MODEL: process.env.NVIDIA_MODEL,
    NVIDIA_BASE_URL: process.env.NVIDIA_BASE_URL,
    NVIDIA_JSON_MODE: process.env.NVIDIA_JSON_MODE,
  });

  if (!result.success) {
    throw new ServerConfigError();
  }

  return result.data;
}
