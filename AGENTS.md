# Topicore Project Instructions

These instructions apply to the entire repository. They are the default rules for people and coding
agents working on Topicore. More detailed rationale and standards live in
[`docs/PROJECT_STANDARDS.md`](docs/PROJECT_STANDARDS.md).

## Rule levels

- **MUST / MUST NOT**: mandatory. A change that violates one of these rules cannot be considered
  complete unless this file is deliberately amended in the same change with a documented reason.
- **SHOULD / SHOULD NOT**: the project default. Departures require a short rationale in the pull
  request or relevant decision record.
- **MAY**: optional guidance.

When rules conflict, protect user safety and data first, then correctness, accessibility,
maintainability, performance, and visual polish, in that order.

## Product boundary

Topicore is a minimalist web application that generates and presents practice questions. The initial
supported subjects are SQL and Python. The initial product does not require accounts, persistent
user data, social features, payments, or a database.

- MUST keep the core path short: configure a practice set, generate validated questions, and begin
  practicing.
- MUST NOT add speculative features, infrastructure, authentication, persistence, analytics, or
  services without an approved, current requirement.
- MUST prioritize working behavior over decorative or novelty features.
- Every visible control MUST have a clear purpose, an accessible label, and working behavior. Do not
  ship dead controls or present placeholders as complete.

## Engineering rules

- MUST use clean, readable, modular, strongly typed code at application boundaries.
- MUST keep UI, domain logic, AI orchestration, provider integration, and validation separate.
  Provider-specific details must not leak into presentation code.
- MUST prefer the simplest implementation that meets current requirements. Avoid microservices,
  generic frameworks, speculative extension points, and abstractions with only one unclear use case.
- MUST validate all untrusted input and external output at runtime, including AI responses. Static
  types alone are not validation.
- MUST handle expected failures explicitly and show actionable, non-sensitive user messages. Never
  expose secrets, prompts containing private data, stack traces, or provider internals to users.
- MUST keep the NVIDIA Build API key and all other credentials server-side and out of source
  control, client bundles, URLs, telemetry, fixtures, and logs.
- MUST preserve working code and keep changes scoped. Do not rewrite, rename, or reformat unrelated
  code.
- SHOULD keep functions focused, make data flow explicit, and favor composition over inheritance.
  Comments should explain decisions, constraints, or non-obvious risks, not restate code.
- MUST NOT add a dependency for behavior that is small, clear, and safe to implement with the
  language or platform standard library.

## AI generation rules

- MUST use versioned, fixed prompt templates. Prompts must not be assembled through scattered ad hoc
  strings.
- MUST request a documented JSON shape and validate it against a strict runtime schema before any
  generated question reaches the practice interface.
- MUST reject unknown question modes, unsupported subjects, malformed questions, missing answers,
  inconsistent option sets, and invalid difficulty values.
- A question is not valid until its correct answer, explanation, and optional hint pass the
  applicable semantic checks. Deterministic verification is preferred whenever practical.
- MUST define finite timeouts and retry limits. Retry only transient or repairable failures, never
  loop indefinitely, and never silently replace validation with trust in model output.
- MUST keep the Nemotron model identifier configurable on the server and isolate the NVIDIA-specific
  client behind a narrow provider interface.
- If generated SQL or Python is executed, it MUST run in an isolated sandbox with strict time,
  memory, process, filesystem, and network limits. Never execute model output in the application
  server process.

## Interface rules

- MUST provide a clear visual hierarchy, consistent spacing, restrained color, and professional
  typography. Reuse named design tokens and shared components rather than one-off values and
  near-duplicates.
- MUST support keyboard use, visible focus, semantic HTML, useful labels and errors, sufficient
  color contrast, reduced motion, and responsive layouts without loss of function. WCAG 2.2 AA is
  the target.
- MUST represent loading, empty, success, validation, and recoverable error states deliberately.
  Prevent duplicate submissions and make long-running generation cancellable when practical.
- SHOULD use familiar, predictable interaction patterns. Animation must communicate state and remain
  subtle; it must not block task completion.

## Change workflow

1. Inspect the current implementation, instructions, tests, and dependency locks.
2. State the smallest complete change and its acceptance criteria.
3. Implement incrementally; do not bundle unrelated cleanup.
4. Add or update tests at the closest useful level.
5. Run the relevant checks and inspect the user-visible states affected.
6. Update documentation when behavior, configuration, architecture, or setup changes.
7. Report what was verified, what was not, and any remaining limitation accurately.

## Completion gate

A change is complete only when it meets the definition of done in
[`docs/PROJECT_STANDARDS.md`](docs/PROJECT_STANDARDS.md). At minimum, it must be functional, typed,
validated, tested in proportion to risk, accessible, secure, documented where needed, and free of
unrelated changes. Passing compilation alone is not sufficient.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
