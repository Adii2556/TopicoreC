"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  generatePracticeSetRequestSchema,
  practiceSetSchema,
  type GeneratePracticeSetRequest,
} from "@/domain/practice/schemas";
import { createPracticeSession, savePracticeSession } from "@/state/practice-session";

import { Button } from "./ui/button";
import { Field } from "./ui/field";

type FormErrors = Partial<Record<"topics" | "questionCount", string>>;

const defaults: GeneratePracticeSetRequest = {
  subject: "sql",
  topics: ["joins"],
  difficulty: "intermediate",
  questionCount: 5,
  mode: "multiple_choice",
};

export function GenerationForm({
  initialConfig = defaults,
}: {
  initialConfig?: GeneratePracticeSetRequest;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<GeneratePracticeSetRequest["subject"]>(
    initialConfig.subject,
  );
  const [topicsText, setTopicsText] = useState(initialConfig.topics.join(", "));
  const [difficulty, setDifficulty] = useState<GeneratePracticeSetRequest["difficulty"]>(
    initialConfig.difficulty,
  );
  const [questionCount, setQuestionCount] = useState(String(initialConfig.questionCount));
  const [mode, setMode] = useState<GeneratePracticeSetRequest["mode"]>(initialConfig.mode);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  const topics = useMemo(
    () =>
      topicsText
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    [topicsText],
  );

  function getValidatedRequest() {
    const result = generatePracticeSetRequestSchema.safeParse({
      subject,
      topics,
      difficulty,
      questionCount: Number(questionCount),
      mode,
    });

    if (result.success) {
      setErrors({});
      return result.data;
    }

    const nextErrors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if ((field === "topics" || field === "questionCount") && !nextErrors[field]) {
        nextErrors[field] = issue.message;
      }
    }
    setErrors(nextErrors);
    return null;
  }

  async function submit() {
    const request = getValidatedRequest();
    if (!request || status === "submitting") return;

    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus("submitting");
    setMessage("Creating and validating your practice set…");

    try {
      const response = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The question service returned an invalid response. Please try again.");
      }
      if (!response.ok) {
        const detail =
          typeof payload === "object" &&
          payload &&
          "detail" in payload &&
          typeof payload.detail === "string"
            ? payload.detail
            : "Question generation failed. Please try again.";
        throw new Error(detail);
      }

      const result = practiceSetSchema.safeParse(
        typeof payload === "object" && payload && "data" in payload ? payload.data : undefined,
      );
      if (!result.success) throw new Error("The generated practice set was not valid.");

      if (!savePracticeSession(createPracticeSession(result.data))) {
        throw new Error(
          "The questions were created, but this browser could not save the session. Enable site storage and try again.",
        );
      }
      setStatus("success");
      setMessage(`${result.data.questions.length} validated questions are ready.`);
      router.push("/practice");
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("idle");
        setMessage("Generation cancelled. Your settings are unchanged.");
      } else {
        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "The question service could not be reached. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Question generation failed.",
        );
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-[var(--text)]">Subject</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["sql", "python"] as const).map((value) => (
            <label
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-4 text-sm font-semibold transition-colors ${
                subject === value
                  ? "border-[var(--accent)] bg-[rgb(113_227_176_/_0.1)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
              }`}
              key={value}
            >
              <input
                checked={subject === value}
                className="sr-only"
                name="subject"
                onChange={() => setSubject(value)}
                type="radio"
                value={value}
              />
              {value === "sql" ? "SQL" : "Python"}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        description="Separate up to five focused topics with commas."
        error={errors.topics}
        id="topics"
        label="Topics"
      >
        <input
          aria-describedby={errors.topics ? "topics-error" : "topics-description"}
          aria-invalid={Boolean(errors.topics)}
          className="field-control"
          id="topics"
          list="topic-suggestions"
          maxLength={404}
          onBlur={getValidatedRequest}
          onChange={(event) => setTopicsText(event.target.value)}
          placeholder={subject === "sql" ? "joins, group by" : "functions, dictionaries"}
          type="text"
          value={topicsText}
        />
        <datalist id="topic-suggestions">
          {(subject === "sql"
            ? ["joins", "aggregations", "window functions", "subqueries", "CTEs"]
            : ["functions", "dictionaries", "list comprehensions", "classes", "exceptions"]
          ).map((topic) => (
            <option key={topic} value={topic} />
          ))}
        </datalist>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="difficulty" label="Difficulty">
          <select
            className="field-control"
            id="difficulty"
            onChange={(event) =>
              setDifficulty(event.target.value as GeneratePracticeSetRequest["difficulty"])
            }
            value={difficulty}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>

        <Field error={errors.questionCount} id="question-count" label="Questions">
          <input
            aria-describedby={errors.questionCount ? "question-count-error" : undefined}
            aria-invalid={Boolean(errors.questionCount)}
            className="field-control"
            id="question-count"
            inputMode="numeric"
            max={10}
            min={1}
            onBlur={getValidatedRequest}
            onChange={(event) => setQuestionCount(event.target.value)}
            type="number"
            value={questionCount}
          />
        </Field>
      </div>

      <Field
        description={
          mode === "written"
            ? "Written responses use a reference answer and honest self-assessment."
            : mode === "mixed"
              ? "Alternates multiple-choice and written questions."
              : "Multiple-choice answers are scored automatically."
        }
        id="mode"
        label="Mode"
      >
        <select
          className="field-control"
          id="mode"
          onChange={(event) => setMode(event.target.value as GeneratePracticeSetRequest["mode"])}
          value={mode}
        >
          <option value="multiple_choice">Multiple choice</option>
          <option value="written">Written response</option>
          <option value="mixed">Mixed</option>
        </select>
      </Field>

      <Button disabled={status === "submitting"} type="submit">
        {status === "submitting" ? "Generating…" : "Generate practice set"}
      </Button>
      {status === "submitting" ? (
        <Button onClick={() => activeRequest.current?.abort()} type="button" variant="quiet">
          Cancel generation
        </Button>
      ) : null}
      {message ? (
        <p
          aria-live="polite"
          className={`text-center text-sm leading-6 ${status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
