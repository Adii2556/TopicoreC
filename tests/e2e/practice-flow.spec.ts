import { expect, test, type Page } from "@playwright/test";

const generatedSet = {
  schemaVersion: "1.0",
  sessionId: "34eeb774-b69a-4fec-b94e-eab78308017d",
  createdAt: "2026-10-27T10:00:00.000Z",
  config: {
    subject: "sql",
    topics: ["joins"],
    difficulty: "intermediate",
    questionCount: 2,
    mode: "mixed",
  },
  questions: [
    {
      id: "f52fd3a5-df45-48dd-9d34-cd2c0e71159f",
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which join preserves every row from the left input table?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "SELF JOIN" },
      ],
      answer: { optionId: "b" },
      hint: "Consider which input side is preserved.",
      explanation: "LEFT JOIN preserves every row from its left input.",
    },
    {
      id: "76c7d4b8-c26c-46a3-934c-957c1a891048",
      type: "written",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Explain why a LEFT JOIN may produce NULL values from the right table.",
      referenceAnswer:
        "When a left-side row has no matching right-side row, the right-side columns are represented as NULL.",
      keyPoints: ["The left row is preserved", "Missing right-side values become NULL"],
      hint: "Think about how a missing match is represented.",
      explanation: "The NULL values indicate that no matching row existed on the right side.",
    },
  ],
};

const multipleChoiceSet = {
  ...generatedSet,
  sessionId: "44eeb774-b69a-4fec-b94e-eab78308017d",
  config: { ...generatedSet.config, questionCount: 1, mode: "multiple_choice" },
  questions: [generatedSet.questions[0]],
};

const writtenSet = {
  ...generatedSet,
  sessionId: "54eeb774-b69a-4fec-b94e-eab78308017d",
  config: { ...generatedSet.config, questionCount: 1, mode: "written" },
  questions: [generatedSet.questions[1]],
};

async function mockGeneratedSet(page: Page, set: typeof generatedSet) {
  await page.route("**/api/practice/generate", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: set, meta: { requestId: "e2e-request" } }),
    }),
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test("generates, completes, and reviews a mixed practice session", async ({ page }) => {
  await page.route("**/api/practice/generate", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toMatchObject({ mode: "mixed", questionCount: 2 });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: generatedSet, meta: { requestId: "e2e-request" } }),
    });
  });

  await page.goto("/");
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("Mode").selectOption("mixed");
  await page.getByLabel("Questions").fill("2");
  await page.getByRole("button", { name: "Generate practice set" }).click();

  await expect(page).toHaveURL(/\/practice$/);
  await page.getByRole("button", { name: "Bookmark question" }).click();
  await expect(page.getByRole("button", { name: "Bookmarked", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("radio", { name: /LEFT JOIN/ }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByLabel("Your written answer").fill("There was no matching right row.");
  await page.getByRole("button", { name: "Compare with reference" }).click();
  await expect(page.getByText("Reference answer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Needs review" }).click();
  await page.getByRole("button", { name: "Finish session" }).click();

  await expect(page.getByRole("heading", { name: "100% MCQ score" })).toBeVisible();
  await expect(page.getByText("Written: review")).toBeVisible();
  await page.getByRole("button", { name: "Review questions to revisit (1)" }).click();
  await expect(page.getByText("Review 1 of 1 · Question 2")).toBeVisible();
  await expect(page.getByRole("button", { name: /Go to question 1/ })).toHaveCount(0);
  await expect(page.getByText("Reference answer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to results" }).click();
  await page.getByRole("button", { name: "Review bookmarked (1)" }).click();
  await expect(page.getByText("Review 1 of 1 · Question 1")).toBeVisible();
  await page.getByRole("button", { name: "Back to results" }).click();
  await page.getByRole("button", { name: "Use same setup" }).click();
  await expect(page).toHaveURL(/subject=sql/);
  await expect(page.getByLabel("Mode")).toHaveValue("mixed");
  await expect(page.getByLabel("Questions")).toHaveValue("2");
  await expect(page.getByRole("combobox", { name: "Topics" })).toHaveValue("joins");
});

test("restores and completes a multiple-choice session", async ({ page }) => {
  await mockGeneratedSet(page, multipleChoiceSet as typeof generatedSet);
  await page.goto("/");
  await page.getByLabel("Questions").fill("1");
  await page.getByRole("button", { name: "Generate practice set" }).click();

  await page.getByRole("radio", { name: /LEFT JOIN/ }).check();
  await page.waitForFunction(() =>
    sessionStorage.getItem("topicore.practice-session.v1")?.includes('"selectedOptionId":"b"'),
  );
  await page.reload();
  await expect(page.getByRole("radio", { name: /LEFT JOIN/ })).toBeChecked();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByRole("heading", { name: "100% MCQ score" })).toBeVisible();
  await page.getByRole("button", { name: "Review all questions" }).click();
  await expect(page.getByText("All questions")).toBeVisible();
  await page.getByRole("button", { name: "Back to results" }).click();
  await page.getByRole("button", { name: "Start a new session" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Generate a practice set first." })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("handles incomplete completion and written self-assessment", async ({ page }) => {
  await mockGeneratedSet(page, writtenSet as typeof generatedSet);
  await page.goto("/");
  await page.getByLabel("Mode").selectOption("written");
  await page.getByLabel("Questions").fill("1");
  await page.getByRole("button", { name: "Generate practice set" }).click();

  await page.getByLabel("Your written answer").fill("There was no matching right row.");
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByRole("button", { name: "Finish with 1 unanswered" })).toBeVisible();
  await expect(page.getByText(/Select Finish again to confirm/)).toBeVisible();

  await page.getByRole("button", { name: "Compare with reference" }).click();
  await expect(page.getByRole("button", { name: "Finish session" })).toBeVisible();
  await expect(page.getByText(/Select Finish again to confirm/)).toHaveCount(0);
  await page.getByRole("button", { name: "Needs review" }).click();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByRole("heading", { name: "Written review" })).toBeVisible();
  await expect(page.getByText("Written: review")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("shows a safe generation error and recovers on intentional retry", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/practice/generate", (route) => {
    attempt += 1;
    if (attempt === 1) {
      return route.fulfill({
        status: 503,
        contentType: "application/problem+json",
        body: JSON.stringify({
          status: 503,
          code: "SERVICE_NOT_CONFIGURED",
          detail: "Question generation is not configured yet.",
          retryable: false,
        }),
      });
    }
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: multipleChoiceSet, meta: { requestId: "e2e-retry" } }),
    });
  });
  await page.goto("/");
  await page.getByLabel("Questions").fill("1");
  await page.getByRole("combobox", { name: "Topics" }).fill("joins, outer joins");
  await page.getByRole("button", { name: "Generate practice set" }).click();
  await expect(page.getByText("Question generation is not configured yet.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Topics" })).toHaveValue("joins, outer joins");

  await page.getByRole("combobox", { name: "Topics" }).fill("joins");
  await page.getByRole("button", { name: "Generate practice set" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  expect(attempt).toBe(2);
});

test("provides a useful not-found recovery", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page does not exist." })).toBeVisible();
  await page.getByRole("link", { name: "Return to generator" }).click();
  await expect(
    page.getByRole("heading", { name: "Practice the topics that matter." }),
  ).toBeVisible();
});
