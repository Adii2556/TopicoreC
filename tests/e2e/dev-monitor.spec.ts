import { expect, test } from "@playwright/test";

const requestId = "req_22222222-2222-4222-8222-222222222222";

test("inspects, filters, copies, pauses, and clears real monitor events", async ({
  context,
  page,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await request.delete("/api/dev/monitor");
  const events = [
    {
      event: "generation.started",
      level: "info",
      source: "generation-pipeline",
      status: "started",
      message: "Question generation pipeline started.",
      details: { questionCount: 2 },
    },
    {
      event: "api.request.started",
      level: "info",
      source: "nvidia-client",
      status: "started",
      message: "NVIDIA API request started.",
      details: {
        endpoint: "chat/completions",
        operation: "generation",
        attempt: 1,
        model: "test-model",
      },
    },
    {
      event: "api.response.received",
      level: "success",
      source: "nvidia-client",
      status: "success",
      message: "NVIDIA API response received and parsed.",
      durationMs: 125,
      details: {
        endpoint: "chat/completions",
        operation: "generation",
        attempt: 1,
        model: "test-model",
        httpStatus: 200,
        totalTokens: 30,
      },
    },
    {
      event: "validation.failed",
      level: "error",
      source: "draft-validator",
      status: "failed",
      message: "Structural schema validation rejected the AI response.",
      details: { validationType: "structural", rejectedCount: 1 },
    },
    {
      event: "generation.retry",
      level: "warning",
      source: "generation-pipeline",
      status: "retry",
      message: "The bounded replacement generation attempt was scheduled.",
      details: { nextAttempt: 2 },
    },
    {
      event: "generation.failed",
      level: "error",
      source: "generation-pipeline",
      status: "failed",
      message: "Question generation pipeline failed.",
      durationMs: 300,
      details: { errorName: "DraftValidationError" },
    },
  ];

  for (const event of events) {
    const response = await request.post("/api/dev/monitor/events", {
      data: { requestId, ...event },
    });
    expect(response.status()).toBe(204);
  }

  await page.goto("/dev/monitor");
  await expect(page.getByRole("heading", { name: "Topicore monitor" })).toBeVisible();
  await expect(page.getByText("Question generation pipeline failed.").first()).toBeVisible();
  await page.getByRole("button", { name: "Copy diagnostic report" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const apiRow = page.getByRole("row").filter({ hasText: "test-model" });
  await expect(apiRow.getByRole("cell", { name: "test-model" })).toBeVisible();
  await expect(apiRow.getByRole("cell", { name: "chat/completions" })).toBeVisible();
  await apiRow.getByRole("button", { name: "Inspect" }).click();
  await expect(apiRow.getByText(/"totalTokens": 30/)).toBeVisible();

  const logsSection = page.getByRole("heading", { name: "Console and error logs" }).locator("..");
  await logsSection.getByLabel("Search logs").fill("validation.failed");
  await expect(
    logsSection.getByText("Structural schema validation rejected the AI response.", {
      exact: true,
    }),
  ).toBeVisible();
  await logsSection.getByLabel("Filter by severity").selectOption("error");
  await logsSection.getByLabel("Filter by source").selectOption("draft-validator");
  await logsSection
    .getByText("Structural schema validation rejected the AI response.", { exact: true })
    .click();
  await logsSection.getByRole("button", { name: "Copy log entry" }).click();
  await expect(logsSection.getByRole("button", { name: "Copied" })).toBeVisible();
  await page.getByRole("button", { name: "Pause updates" }).click();
  await expect(page.getByRole("button", { name: "Resume updates" })).toBeVisible();
  await page.getByRole("button", { name: "Resume updates" }).click();
  await expect(page.getByRole("button", { name: "Pause updates" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByText("No logs match the current filters.")).toBeVisible();
});
