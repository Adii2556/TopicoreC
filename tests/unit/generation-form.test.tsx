import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

import { GenerationForm } from "@/components/generation-form";
import type { GeneratePracticeSetRequest } from "@/domain/practice/schemas";

const generatedConfig: GeneratePracticeSetRequest = {
  subject: "sql",
  topics: ["joins"],
  difficulty: "intermediate",
  questionCount: 1,
  mode: "multiple_choice",
};

const generatedSet = {
  schemaVersion: "1.0",
  sessionId: "34eeb774-b69a-4fec-b94e-eab78308017d",
  createdAt: "2026-10-27T10:00:00.000Z",
  config: generatedConfig,
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
  ],
};

beforeEach(() => {
  sessionStorage.clear();
  routerPush.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GenerationForm", () => {
  it("provides accessible defaults and an active generation action", () => {
    render(<GenerationForm />);

    expect(screen.getByRole("radio", { name: "SQL" })).toBeChecked();
    expect(screen.getByLabelText("Difficulty")).toHaveValue("intermediate");
    expect(screen.getByRole("button", { name: "Generate practice set" })).toBeEnabled();
  });

  it("reports an empty topic on blur", async () => {
    const user = userEvent.setup();
    render(<GenerationForm />);

    const topics = screen.getByLabelText("Topics");
    await user.clear(topics);
    await user.tab();

    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one topic");
    expect(topics).toHaveAttribute("aria-invalid", "true");
  });

  it("stores a validated response and navigates once", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: generatedSet }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<GenerationForm initialConfig={generatedConfig} />);

    await user.click(screen.getByRole("button", { name: "Generate practice set" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/practice"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(generatedSet.config);
  });

  it("does not navigate when browser session storage is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: generatedSet }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<GenerationForm initialConfig={generatedConfig} />);

    await user.click(screen.getByRole("button", { name: "Generate practice set" }));

    expect(await screen.findByText(/this browser could not save the session/i)).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("cancels an in-flight request and prevents duplicate submission", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Cancelled", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<GenerationForm />);

    await user.click(screen.getByRole("button", { name: "Generate practice set" }));
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancel generation" }));
    expect(await screen.findByText(/generation cancelled/i)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts generation when the form unmounts", async () => {
    const user = userEvent.setup();
    const requestSignals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.signal) requestSignals.push(init.signal);
        return new Promise<Response>(() => {});
      }),
    );
    const view = render(<GenerationForm />);

    await user.click(screen.getByRole("button", { name: "Generate practice set" }));
    view.unmount();

    expect(requestSignals[0]?.aborted).toBe(true);
  });

  it.each([
    [
      "malformed service data",
      () => Promise.resolve(new Response("not-json", { status: 502 })),
      /returned an invalid response/i,
    ],
    [
      "a network failure",
      () => Promise.reject(new TypeError("internal network detail")),
      /could not be reached/i,
    ],
  ])("shows a safe recovery message for %s", async (_label, response, expectedMessage) => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(response));
    render(<GenerationForm />);

    await user.click(screen.getByRole("button", { name: "Generate practice set" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
    expect(screen.queryByText(/internal network detail/i)).not.toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
