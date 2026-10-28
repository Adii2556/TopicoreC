import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("production response headers", () => {
  it("sets the expected browser security policy", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const headers = Object.fromEntries(rules[0]!.headers.map(({ key, value }) => [key, value]));

    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
