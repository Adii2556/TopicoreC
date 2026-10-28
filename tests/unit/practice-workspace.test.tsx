import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PracticeSet } from "@/domain/practice/schemas";
import { createPracticeSession, savePracticeSession } from "@/state/practice-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { PracticeWorkspace } from "@/components/practice-workspace";

const set: PracticeSet = {
  schemaVersion: "1.0",
  sessionId: "34eeb774-b69a-4fec-b94e-eab78308017d",
  createdAt: "2026-10-27T10:00:00.000Z",
  config: {
    subject: "sql",
    topics: ["joins"],
    difficulty: "intermediate",
    questionCount: 2,
    mode: "multiple_choice",
  },
  questions: [
    {
      id: "f52fd3a5-df45-48dd-9d34-cd2c0e71159f",
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which join preserves every left row even when no right row matches?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "SELF JOIN" },
      ],
      answer: { optionId: "b" },
      hint: "Focus on the preserved input side.",
      explanation: "LEFT JOIN preserves each row from its left input.",
    },
    {
      id: "66c7d4b8-c26c-46a3-934c-957c1a891047",
      type: "multiple_choice",
      topic: "joins",
      difficulty: "intermediate",
      prompt: "Which join returns only rows with matching keys in both input tables?",
      options: [
        { id: "a", text: "INNER JOIN" },
        { id: "b", text: "LEFT JOIN" },
        { id: "c", text: "CROSS JOIN" },
        { id: "d", text: "FULL JOIN" },
      ],
      answer: { optionId: "a" },
      hint: "Only matched rows should remain.",
      explanation: "INNER JOIN keeps rows that satisfy the join condition on both sides.",
    },
  ],
};

describe("PracticeWorkspace productivity controls", () => {
  beforeEach(() => {
    sessionStorage.clear();
    savePracticeSession(createPracticeSession(set));
  });

  it("supports discoverable shortcuts for bookmarking, answering, submitting, and navigation", () => {
    render(<PracticeWorkspace />);

    const bookmark = screen.getByRole("button", { name: "Bookmark question" });
    expect(bookmark).toHaveAttribute("aria-keyshortcuts", "B");

    fireEvent.keyDown(window, { key: "h" });
    expect(screen.getByText("Focus on the preserved input side.")).toBeVisible();

    fireEvent.keyDown(window, { key: "b" });
    expect(screen.getByRole("button", { name: "Bookmarked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(window, { key: "1" });
    expect(screen.getByRole("radio", { name: /INNER JOIN/ })).toBeChecked();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("Not quite", { exact: true })).toBeVisible();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(
      screen.getByRole("heading", {
        name: "Which join returns only rows with matching keys in both input tables?",
      }),
    ).toBeVisible();
  });

  it("leaves keyboard events on form controls to their native behavior", () => {
    render(<PracticeWorkspace />);

    const firstOption = screen.getByRole("radio", { name: /INNER JOIN/ });
    fireEvent.keyDown(firstOption, { key: "2" });

    expect(firstOption).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /LEFT JOIN/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Bookmark question" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders generated markup-like content as inert text", () => {
    const markupPrompt = '<img src=x onerror="globalThis.compromised=true"> Explain this value.';
    const inertSet: PracticeSet = {
      ...set,
      config: { ...set.config, questionCount: 1 },
      questions: [{ ...set.questions[0]!, prompt: markupPrompt }],
    };
    savePracticeSession(createPracticeSession(inertSet));

    const { container } = render(<PracticeWorkspace />);

    expect(screen.getByRole("heading", { name: markupPrompt })).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect("compromised" in globalThis).toBe(false);
  });
});
