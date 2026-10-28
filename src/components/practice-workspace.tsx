"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";

import {
  clearPracticeSession,
  getReviewQuestionIndices,
  getSessionScore,
  loadPracticeSession,
  practiceSessionReducer,
  savePracticeSession,
  type PracticeSessionState,
  type ReviewFilter,
} from "@/state/practice-session";

import { Button } from "./ui/button";

function optionClasses(selected: boolean, submitted: boolean, correct: boolean, wrong: boolean) {
  if (submitted && correct) return "border-[var(--success)] bg-[rgb(113_227_176_/_0.09)]";
  if (submitted && wrong) return "border-[var(--danger)] bg-[rgb(255_143_143_/_0.08)]";
  if (selected) return "border-[var(--accent)] bg-[rgb(113_227_176_/_0.08)]";
  return "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--border-strong)]";
}

const reviewLabels: Record<ReviewFilter, string> = {
  all: "All questions",
  priority: "Questions to revisit",
  bookmarked: "Bookmarked questions",
};

const optionShortcuts = { "1": "a", "2": "b", "3": "c", "4": "d" } as const;

function Results({
  state,
  dispatch,
}: {
  state: PracticeSessionState;
  dispatch: React.Dispatch<Parameters<typeof practiceSessionReducer>[1]>;
}) {
  const router = useRouter();
  const score = getSessionScore(state);
  const priorityCount = getReviewQuestionIndices(state, "priority").length;
  const bookmarkedCount = getReviewQuestionIndices(state, "bookmarked").length;
  const metrics = [
    ...(score.objectiveTotal > 0
      ? [
          { label: "MCQ correct", value: score.correct, color: "var(--success)" },
          { label: "MCQ incorrect", value: score.incorrect, color: "var(--danger)" },
        ]
      : []),
    ...(score.writtenTotal > 0
      ? [
          { label: "Written: got it", value: score.writtenGotIt, color: "var(--success)" },
          {
            label: "Written: review",
            value: score.writtenNeedsReview + score.writtenUnassessed,
            color: "var(--warning)",
          },
        ]
      : []),
    { label: "Unanswered", value: score.unanswered, color: "var(--warning)" },
    ...(bookmarkedCount > 0
      ? [{ label: "Bookmarked", value: bookmarkedCount, color: "var(--text)" }]
      : []),
  ];

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-12"
      id="main-content"
    >
      <section className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-10">
        <p className="text-sm font-semibold text-[var(--accent)]">Session complete</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
          {score.percentage === null ? "Written review" : `${score.percentage}% MCQ score`}
        </h1>
        <p className="mt-3 text-[var(--text-muted)]">
          {score.objectiveTotal > 0
            ? `${score.correct} of ${score.objectiveTotal} multiple-choice questions were correct.`
            : "Written responses are self-assessed against the reference answers."}
        </p>
        <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, color }) => (
            <div
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-4"
              key={label}
            >
              <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold" style={{ color }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {priorityCount > 0 ? (
          <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">
            {priorityCount} {priorityCount === 1 ? "question needs" : "questions need"} another look
            because it was incorrect, skipped, or marked for review.
          </p>
        ) : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {priorityCount > 0 ? (
            <Button onClick={() => dispatch({ type: "review", filter: "priority" })}>
              Review questions to revisit ({priorityCount})
            </Button>
          ) : null}
          <Button
            onClick={() => dispatch({ type: "review", filter: "all" })}
            variant={priorityCount > 0 ? "secondary" : "primary"}
          >
            Review all questions
          </Button>
          {bookmarkedCount > 0 ? (
            <Button
              onClick={() => dispatch({ type: "review", filter: "bookmarked" })}
              variant="secondary"
            >
              Review bookmarked ({bookmarkedCount})
            </Button>
          ) : null}
          <Button
            onClick={() => {
              clearPracticeSession();
              router.push("/");
            }}
            variant="secondary"
          >
            Start a new session
          </Button>
          <Button
            onClick={() => {
              const params = new URLSearchParams({
                subject: state.set.config.subject,
                difficulty: state.set.config.difficulty,
                questionCount: String(state.set.config.questionCount),
                mode: state.set.config.mode,
              });
              for (const topic of state.set.config.topics) params.append("topic", topic);
              clearPracticeSession();
              router.push(`/?${params.toString()}`);
            }}
            variant="secondary"
          >
            Use same setup
          </Button>
        </div>
      </section>
    </main>
  );
}

export function PracticeWorkspace() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center px-5" id="main-content">
        <p aria-live="polite" className="text-[var(--text-muted)]" role="status">
          Loading your practice session…
        </p>
      </main>
    );
  }
  return <PracticeSessionLoader />;
}

function PracticeSessionLoader() {
  const [initial] = useState<PracticeSessionState | null>(() => loadPracticeSession());
  if (!initial) {
    return (
      <main className="grid min-h-screen place-items-center px-5" id="main-content">
        <section className="max-w-md text-center">
          <p className="text-sm font-semibold text-[var(--accent)]">No active session</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            Generate a practice set first.
          </h1>
          <p className="mt-4 leading-7 text-[var(--text-muted)]">
            Your session may have ended or could not be restored safely.
          </p>
          <Link
            className="mt-7 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 font-semibold text-[var(--accent-ink)]"
            href="/"
          >
            Return to generator
          </Link>
        </section>
      </main>
    );
  }
  return <LoadedPracticeWorkspace initial={initial} />;
}

function LoadedPracticeWorkspace({ initial }: { initial: PracticeSessionState }) {
  const [state, dispatch] = useReducer(practiceSessionReducer, initial);
  const [finishPending, setFinishPending] = useState(false);
  const reviewing = state.phase === "review";
  const visibleQuestionIndices = reviewing
    ? getReviewQuestionIndices(state, state.reviewFilter)
    : state.set.questions.map((_, index) => index);
  const visiblePosition = visibleQuestionIndices.indexOf(state.currentIndex);

  useEffect(() => {
    savePracticeSession(state);
  }, [state]);

  useEffect(() => {
    if (state.phase === "complete") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      const tagName = target instanceof HTMLElement ? target.tagName : "";
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "A"].includes(tagName))
      ) {
        return;
      }
      if (tagName === "BUTTON" && (event.key === "Enter" || event.key === " ")) return;
      if (event.repeat && !["ArrowLeft", "ArrowRight"].includes(event.key)) return;

      const currentQuestion = state.set.questions[state.currentIndex];
      if (!currentQuestion) return;
      const currentAnswer = state.answers[currentQuestion.id];
      const indices =
        state.phase === "review"
          ? getReviewQuestionIndices(state, state.reviewFilter)
          : state.set.questions.map((_, index) => index);
      const position = indices.indexOf(state.currentIndex);
      const key = event.key.toLocaleLowerCase();

      if (event.key === "ArrowLeft" && position > 0) {
        event.preventDefault();
        setFinishPending(false);
        dispatch({ type: "go_to", index: indices[position - 1]! });
        return;
      }
      if (event.key === "ArrowRight" && position >= 0 && position < indices.length - 1) {
        event.preventDefault();
        setFinishPending(false);
        dispatch({ type: "go_to", index: indices[position + 1]! });
        return;
      }
      if (key === "h" && !state.revealedHintIds.includes(currentQuestion.id)) {
        event.preventDefault();
        dispatch({ type: "show_hint", questionId: currentQuestion.id });
        return;
      }
      if (key === "b" && state.phase === "active") {
        event.preventDefault();
        dispatch({ type: "toggle_bookmark", questionId: currentQuestion.id });
        return;
      }
      if (event.key === "Enter" && state.phase === "active" && !currentAnswer?.submitted) {
        const hasAnswer =
          currentQuestion.type === "multiple_choice"
            ? Boolean(currentAnswer?.selectedOptionId)
            : Boolean(currentAnswer?.text.trim());
        if (hasAnswer) {
          event.preventDefault();
          dispatch({ type: "submit", questionId: currentQuestion.id });
        }
        return;
      }

      const optionId = optionShortcuts[event.key as keyof typeof optionShortcuts];
      if (
        optionId &&
        state.phase === "active" &&
        currentQuestion.type === "multiple_choice" &&
        !currentAnswer?.submitted
      ) {
        event.preventDefault();
        dispatch({ type: "select", questionId: currentQuestion.id, optionId });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state]);

  if (state.phase === "complete") return <Results dispatch={dispatch} state={state} />;

  const question = state.set.questions[state.currentIndex];
  if (!question) return null;
  const answer = state.answers[question.id] ?? {
    selectedOptionId: null,
    text: "",
    submitted: false,
    selfAssessment: null,
  };
  const reveal = answer.submitted || reviewing;
  const isCorrect =
    question.type === "multiple_choice" && answer.selectedOptionId === question.answer.optionId;
  const answeredCount = Object.values(state.answers).filter((item) => item.submitted).length;
  const unansweredCount = state.set.questions.length - answeredCount;
  const confirmationPending = finishPending && unansweredCount > 0;
  const previousIndex =
    visiblePosition > 0 ? visibleQuestionIndices[visiblePosition - 1] : undefined;
  const nextIndex =
    visiblePosition >= 0 && visiblePosition < visibleQuestionIndices.length - 1
      ? visibleQuestionIndices[visiblePosition + 1]
      : undefined;
  const bookmarked = state.bookmarkedQuestionIds.includes(question.id);
  const priorityQuestionIndices = new Set(getReviewQuestionIndices(state, "priority"));

  function finishSession() {
    if (unansweredCount > 0 && !finishPending) {
      setFinishPending(true);
      return;
    }
    dispatch({ type: "finish" });
  }

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-7"
      id="main-content"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <Link className="text-xl font-semibold tracking-[-0.03em]" href="/">
            Topicore
          </Link>
          <p className="mt-1 text-xs font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
            {state.set.config.subject} · {state.set.config.difficulty}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-[var(--text-muted)]">
            {reviewing
              ? reviewLabels[state.reviewFilter]
              : `${answeredCount}/${state.set.questions.length} submitted`}
          </span>
          {reviewing ? (
            <Button onClick={() => dispatch({ type: "resume" })} variant="secondary">
              Back to results
            </Button>
          ) : (
            <Button onClick={finishSession} variant={confirmationPending ? "danger" : "secondary"}>
              {confirmationPending ? `Finish with ${unansweredCount} unanswered` : "Finish session"}
            </Button>
          )}
        </div>
      </header>
      {confirmationPending ? (
        <p className="mb-4 text-right text-sm text-[var(--warning)]" role="status">
          Select Finish again to confirm, or answer the remaining questions.
        </p>
      ) : null}

      <div
        aria-label="Question progress"
        aria-valuemax={state.set.questions.length}
        aria-valuemin={1}
        aria-valuenow={state.currentIndex + 1}
        className="mb-5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width]"
          style={{ width: `${((state.currentIndex + 1) / state.set.questions.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section
          aria-labelledby="question-title"
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--accent)]">
              {reviewing
                ? `Review ${visiblePosition + 1} of ${visibleQuestionIndices.length} · Question ${state.currentIndex + 1}`
                : `Question ${state.currentIndex + 1} of ${state.set.questions.length}`}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {reviewing ? (
                bookmarked ? (
                  <span className="rounded-full border border-[var(--warning)] px-3 py-1 text-xs text-[var(--warning)]">
                    Bookmarked
                  </span>
                ) : null
              ) : (
                <button
                  aria-keyshortcuts="B"
                  aria-pressed={bookmarked}
                  className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors ${bookmarked ? "border-[var(--warning)] text-[var(--warning)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"}`}
                  onClick={() => dispatch({ type: "toggle_bookmark", questionId: question.id })}
                  type="button"
                >
                  {bookmarked ? "Bookmarked" : "Bookmark question"}
                </button>
              )}
              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">
                {question.topic}
              </span>
            </div>
          </div>
          <h1 className="mt-6 text-xl leading-8 font-semibold sm:text-2xl" id="question-title">
            {question.prompt}
          </h1>
          {question.code ? (
            <pre className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[#080c12] p-4 text-sm leading-6">
              <code>{question.code.source}</code>
            </pre>
          ) : null}
          <div className="mt-7">
            {state.revealedHintIds.includes(question.id) || reveal ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--warning)] uppercase">
                  Hint
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{question.hint}</p>
              </div>
            ) : (
              <Button
                aria-keyshortcuts="H"
                onClick={() => dispatch({ type: "show_hint", questionId: question.id })}
                variant="quiet"
              >
                Reveal hint
              </Button>
            )}
          </div>
        </section>

        <section
          aria-labelledby="answer-title"
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
        >
          <h2
            className="text-sm font-semibold tracking-[0.12em] text-[var(--text-muted)] uppercase"
            id="answer-title"
          >
            {question.type === "multiple_choice" ? "Choose one answer" : "Write your answer"}
          </h2>
          {question.type === "multiple_choice" ? (
            <>
              <fieldset className="mt-5 grid gap-3">
                <legend className="sr-only">Answer options</legend>
                {question.options.map((option, index) => {
                  const selected = answer.selectedOptionId === option.id;
                  const correct = reveal && option.id === question.answer.optionId;
                  const wrong = reveal && selected && !correct;
                  return (
                    <label
                      className={`flex min-h-14 items-start gap-3 rounded-[var(--radius-md)] border p-4 transition-colors ${optionClasses(selected, reveal, correct, wrong)} ${reveal ? "cursor-default" : "cursor-pointer"}`}
                      key={option.id}
                    >
                      <input
                        aria-keyshortcuts={String(index + 1)}
                        checked={selected}
                        className="mt-1 accent-[var(--accent)]"
                        disabled={reveal}
                        name={`answer-${question.id}`}
                        onChange={() =>
                          dispatch({ type: "select", questionId: question.id, optionId: option.id })
                        }
                        type="radio"
                      />
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs font-bold text-[var(--text-muted)]"
                      >
                        {option.id.toUpperCase()}
                      </span>
                      <span className="text-sm leading-6">{option.text}</span>
                    </label>
                  );
                })}
              </fieldset>
              {!reveal ? (
                <Button
                  aria-keyshortcuts="Enter"
                  className="mt-5 w-full"
                  disabled={!answer.selectedOptionId}
                  onClick={() => dispatch({ type: "submit", questionId: question.id })}
                >
                  Submit answer
                </Button>
              ) : (
                <div
                  className={`mt-5 rounded-[var(--radius-md)] border p-4 ${isCorrect ? "border-[var(--success)]" : "border-[var(--border)]"}`}
                  role="status"
                >
                  <p
                    className={`font-semibold ${isCorrect ? "text-[var(--success)]" : answer.submitted ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
                  >
                    {isCorrect ? "Correct" : answer.submitted ? "Not quite" : "Unanswered"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    {question.explanation}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <label className="sr-only" htmlFor={`written-${question.id}`}>
                Your written answer
              </label>
              <textarea
                className="field-control mt-5 min-h-44 resize-y"
                disabled={reveal}
                id={`written-${question.id}`}
                maxLength={4_000}
                onChange={(event) =>
                  dispatch({ type: "write", questionId: question.id, text: event.target.value })
                }
                placeholder="Explain your reasoning in your own words…"
                value={answer.text}
              />
              {!reveal ? (
                <Button
                  aria-keyshortcuts="Enter"
                  className="mt-5 w-full"
                  disabled={!answer.text.trim()}
                  onClick={() => dispatch({ type: "submit", questionId: question.id })}
                >
                  Compare with reference
                </Button>
              ) : (
                <div className="mt-5 grid gap-4" role="status">
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                    <p className="font-semibold text-[var(--accent)]">Reference answer</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {question.referenceAnswer}
                    </p>
                    <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-[var(--text-muted)] uppercase">
                      Key points
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                      {question.keyPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">
                    {question.explanation}
                  </p>
                  {answer.submitted ? (
                    reviewing ? (
                      <p className="text-sm font-semibold text-[var(--text)]">
                        Self-assessment:{" "}
                        {answer.selfAssessment === "got_it"
                          ? "Got it"
                          : answer.selfAssessment === "needs_review"
                            ? "Needs review"
                            : "Not assessed"}
                      </p>
                    ) : (
                      <fieldset>
                        <legend className="text-sm font-semibold">
                          How did your answer compare?
                        </legend>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <Button
                            aria-pressed={answer.selfAssessment === "got_it"}
                            className="flex-1"
                            onClick={() =>
                              dispatch({
                                type: "assess",
                                questionId: question.id,
                                assessment: "got_it",
                              })
                            }
                            variant={answer.selfAssessment === "got_it" ? "primary" : "secondary"}
                          >
                            I got it
                          </Button>
                          <Button
                            aria-pressed={answer.selfAssessment === "needs_review"}
                            className="flex-1"
                            onClick={() =>
                              dispatch({
                                type: "assess",
                                questionId: question.id,
                                assessment: "needs_review",
                              })
                            }
                            variant={
                              answer.selfAssessment === "needs_review" ? "primary" : "secondary"
                            }
                          >
                            Needs review
                          </Button>
                        </div>
                      </fieldset>
                    )
                  ) : null}
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex gap-3 border-t border-[var(--border)] pt-5">
            <Button
              aria-keyshortcuts="ArrowLeft"
              className="flex-1"
              disabled={previousIndex === undefined}
              onClick={() => {
                setFinishPending(false);
                if (previousIndex !== undefined) dispatch({ type: "go_to", index: previousIndex });
              }}
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              aria-keyshortcuts="ArrowRight"
              className="flex-1"
              disabled={nextIndex === undefined}
              onClick={() => {
                setFinishPending(false);
                if (nextIndex !== undefined) dispatch({ type: "go_to", index: nextIndex });
              }}
              variant="secondary"
            >
              Next
            </Button>
          </div>
          <nav aria-label="Question navigation" className="mt-5 flex flex-wrap gap-2">
            {visibleQuestionIndices.map((index) => {
              const item = state.set.questions[index]!;
              const itemAnswer = state.answers[item.id];
              const itemBookmarked = state.bookmarkedQuestionIds.includes(item.id);
              const status = !itemAnswer?.submitted
                ? "unanswered"
                : item.type === "multiple_choice"
                  ? itemAnswer.selectedOptionId === item.answer.optionId
                    ? "correct"
                    : "incorrect"
                  : itemAnswer.selfAssessment === "got_it"
                    ? "self-assessed as understood"
                    : itemAnswer.selfAssessment === "needs_review"
                      ? "marked for review"
                      : "not self-assessed";
              const needsReview = priorityQuestionIndices.has(index);
              return (
                <button
                  aria-current={index === state.currentIndex ? "step" : undefined}
                  aria-label={`Go to question ${index + 1}, ${status}${itemBookmarked ? ", bookmarked" : ""}`}
                  className={`size-10 rounded-[var(--radius-sm)] border text-sm font-semibold ${index === state.currentIndex ? "border-[var(--accent)] text-[var(--accent)]" : needsReview ? "border-[var(--warning)] text-[var(--warning)]" : "border-[var(--border-strong)] text-[var(--text)]"}`}
                  key={item.id}
                  onClick={() => {
                    setFinishPending(false);
                    dispatch({ type: "go_to", index });
                  }}
                  type="button"
                >
                  {index + 1}
                </button>
              );
            })}
          </nav>
          <details className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-[var(--text-muted)]">
            <summary className="cursor-pointer font-semibold text-[var(--text)]">
              Keyboard shortcuts
            </summary>
            <p className="mt-3 leading-6">
              1–4 choose an option · Enter submits · ←/→ navigate · H reveals the hint · B bookmarks
              during practice. Shortcuts pause while you type or use a form control.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
