# Topicore MVP Roadmap

Status: Sequential implementation plan for P3 and later phases

Depends on: `AGENTS.md`, `docs/PROJECT_STANDARDS.md`, and `docs/ARCHITECTURE.md`

The roadmap favors small, independently testable slices. A milestone is complete only when its
listed acceptance criteria and the project definition of done are satisfied. Do not build later
milestones speculatively inside an earlier one.

## 1. MVP scope

### Required for launch

- Responsive web generator for SQL and Python.
- Inputs: subject, one to five topics, beginner/intermediate/advanced difficulty, one to ten
  questions, and multiple-choice/written/mixed mode.
- Server-only NVIDIA Build API integration with a qualified configurable Nemotron model.
- Versioned prompts and deterministic blueprint selection.
- Strict JSON parsing, Zod validation, deterministic invariants, and independent semantic-review
  pass.
- Focused practice workflow: answer, navigate, reveal hint, submit, review, summary, repeat/restart.
- Objective MCQ scoring and explicitly labeled written self-assessment.
- Refresh recovery through validated `sessionStorage`; no account or database.
- Safe failure recovery, cancellation, rate limiting, timeouts, concurrency and size limits,
  redacted logs, secure headers, and same-origin request controls.
- Automated unit, integration, component, accessibility-oriented, and end-to-end coverage for the
  core path.
- One qualified production deployment with documented environment variables and verified
  timeout/rate-limit behavior.

### Enhancements after launch evidence

- Larger curated blueprint/reference-fact catalog.
- Optional second theme, richer topic suggestions, session export, or local history.
- Separate qualified reviewer model if it materially improves correctness or cost.
- Better deterministic validation for selected question families.
- Streaming progress events that do not expose unvalidated questions.
- Shared rate-limit store only when horizontal scaling requires it.

### Explicitly deferred

- Accounts, database-backed history, synchronization, social/sharing, gamification, payments,
  analytics dashboards, mobile apps, RAG, vector search, model fine-tuning, and multiple AI
  providers.
- Executing SQL or Python, automatic grading of arbitrary code, and a LeetCode-style editor. These
  require a separate sandbox architecture and threat review.

## 2. Sequential P3 milestones

### M0 — Provider and model qualification spike

Dependencies: an NVIDIA API key supplied securely in the development environment.

Work:

- Probe the hosted base URL and candidate Nemotron model IDs without logging secrets or response
  content.
- Test plain JSON prompting and `nvext.guided_json` against the selected model.
- Record supported request fields, practical context/output bounds, observed latency, error shapes,
  429/`Retry-After` behavior, and deployment egress needs.
- Build a 30-case balanced qualification fixture set and compare the smallest viable Nemotron
  candidate with the more capable fallback.
- Decide `NVIDIA_MODEL` default and `NVIDIA_JSON_MODE` explicitly.

Acceptance:

- A pinned model ID succeeds through the official hosted endpoint.
- The chosen JSON mode is demonstrated, not assumed.
- Structural success after the allowed retry is 100% on the fixture run; human-reviewed
  answer/explanation correctness is at least 95%, with no severe unsafe output.
- Cost and p50/p95 latency are recorded for five-question generation plus review.
- If no candidate passes, implementation stops at a documented provider blocker; the architecture is
  not weakened to publish unverified questions.

### M1 — Application scaffold and quality gates

Dependencies: M0 confirms the runtime/provider path; no live API call is needed in routine tests.

Work:

- Scaffold stable Next.js App Router, React, strict TypeScript, Tailwind CSS, and Zod using Node.js
  24 LTS and npm.
- Establish design tokens, root layout, metadata, server-only configuration parsing, `.env.example`
  names, and secure response headers.
- Add ESLint, formatting, Vitest, Testing Library, and Playwright configuration.
- Add CI commands for format check, lint, type check, tests, and production build.

Acceptance:

- Fresh install from the lockfile and production build succeed.
- No secret or provider call is needed to render the home shell or run routine tests.
- Invalid/missing server configuration produces a safe diagnostic only when the generation
  capability is invoked.
- The scaffold contains no placeholder controls or unused UI kit.

### M2 — Domain contracts and deterministic validation

Dependencies: M1.

Work:

- Implement subject, difficulty, requested-mode, model-draft, practice-set, reviewer,
  problem-response, and session-storage Zod schemas.
- Centralize limits and normalized topic rules.
- Implement server ID assignment, type-mix rules, exact/near-duplicate detection, MCQ invariants,
  written-answer invariants, and hint-leak checks.
- Add adversarial and malformed fixtures for both subjects.

Acceptance:

- Unit tests cover every boundary and discriminated variant.
- Unknown keys, wrong counts, bad option IDs, duplicate prompts, answer-leaking hints, oversized
  strings, and untrusted identifiers are rejected.
- Types are inferred from schemas where practical; no duplicate handwritten contract can drift
  silently.

### M3 — NVIDIA adapter and HTTP safety layer

Dependencies: M1 and M2; uses M0 findings.

Work:

- Implement native-fetch NVIDIA adapter with server-only auth, explicit model and JSON mode, abort
  timeout, response-size cap, and safe provider error taxonomy.
- Implement request IDs, RFC 9457-style problem responses, same-origin/content-type checks, body
  limits, application token bucket, and in-flight concurrency cap.
- Stub transport in tests; keep the live smoke test opt-in.

Acceptance:

- Tests cover success, cancellation, timeout, network failure, 400/401/403/429/5xx,
  malformed/oversized bodies, retry delay bounds, and redaction.
- No API key, auth header, prompt, or completion appears in logs or client errors.
- Non-retryable errors are never retried; the total call budget is enforceable.

### M4 — Generation and review pipeline

Dependencies: M2 and M3.

Work:

- Implement deterministic blueprint mix and versioned SQL/Python generator prompt.
- Implement strict whole-document JSON parsing and full deterministic validation.
- Implement versioned isolated reviewer prompt and all-pass semantic gate.
- Implement the one-replacement-attempt generation policy and fail-closed review.
- Expose `POST /api/practice/generate` with the documented contract.

Acceptance:

- Integration tests exercise both subjects, all difficulties, all requested modes, injection
  strings, structural retry, transient retry, reviewer rejection, and safe failure mapping.
- Exactly the requested count and type mix are returned only after all gates pass.
- One action cannot exceed four provider calls and never publishes a partial set.
- Generation route responses are `no-store` and contain no internal prompt/review data.

### M5 — Generator experience

Dependencies: M1 and M4.

Work:

- Build the accessible configuration form and topic-entry behavior.
- Add inline client validation backed by the shared request schema.
- Implement submit, duplicate-submit prevention, immediate status, cancellation, and recoverable
  errors while preserving user input.
- Save a successful session and navigate to `/practice`.

Acceptance:

- Full keyboard completion, field/error association, focus behavior, live status, and 200% zoom are
  verified.
- Every visible control works; invalid input cannot call the API.
- Provider failure and cancellation preserve all form values and permit an intentional retry.
- Mobile and desktop layouts have no functional loss or unintended horizontal scroll.

### M6 — Practice, review, and session recovery

Dependencies: M2 and M5.

Work:

- Implement reducer-driven active, review, and completion phases.
- Build responsive prompt, option/written response, progress, hint, navigation, submit, review,
  self-assessment, summary, repeat, and restart behavior.
- Add versioned bounded `sessionStorage` persistence and corrupt/obsolete recovery.

Acceptance:

- MCQ scoring is deterministic and written results are never labeled automatically
  correct/incorrect.
- Answers survive navigation and refresh; invalid storage fails safely to the form.
- Answers/explanations are not visually revealed before submission.
- The complete flow works by keyboard and at mobile, desktop, and 200% zoom layouts.
- Restart and repeat behaviors match their labels and do not silently lose active work.

### M7 — Release hardening

Dependencies: M1–M6.

Work:

- Run the full unit, integration, component, Playwright, accessibility, security, and
  production-build suite.
- Add prompt-injection, inert-rendering, rate-limit, origin, body-limit, concurrency, and
  log-redaction negative tests.
- Measure bundle size, Core Web Vitals baseline, generation latency, failure rate, and per-session
  provider calls/cost.
- Complete content review of qualified fixture outputs across both subjects.

Acceptance:

- All required automated checks pass with non-zero executed tests.
- No high-severity accessibility or security issue remains.
- The UI remains responsive throughout generation; no uncontrolled request/render or material bundle
  regression exists.
- Known limitations are documented honestly and do not invalidate launch claims.

### M8 — Deployment qualification and launch

Dependencies: M7.

Work:

- Compare current Vercel plan capabilities with a single managed Node service using measured
  duration, cost, egress, logging, and rate-limit needs.
- Deploy the simplest qualifying option with HTTPS and server-managed secrets.
- Verify `integrate.api.nvidia.com` egress, function/request duration, secure headers, origin
  behavior, host or instance rate limit, concurrency cap, and redacted logs.
- Run a budget-bounded production smoke session for SQL and Python.

Acceptance:

- No secret reaches client assets, responses, source maps, or logs.
- Public generation has effective abuse controls in the actual deployment topology.
- Both production smoke sessions generate, complete, review, and restart successfully.
- Deployment and rollback steps, environment variable names, and observed limitations are
  documented; secret values are not.

## 3. Prioritized backlog

### P0 — Launch blockers

1. Qualify NVIDIA model and structured-output mode.
2. Scaffold reproducible application and CI quality gates.
3. Implement shared contracts and deterministic validation.
4. Implement safe provider adapter, bounded retries, and abuse controls.
5. Implement semantic-review pipeline and generation API.
6. Deliver accessible generator and complete practice/review workflow.
7. Validate security, accessibility, performance, cost, and production deployment.

### P1 — First post-launch improvements

1. Expand curated blueprints based on generation failures and user value, not volume.
2. Evaluate a smaller independent reviewer model against the qualification set.
3. Add optional tab-local recent-session recovery only if users lose useful work.
4. Add a second visual theme only after the launch theme and accessibility remain fully covered.
5. Improve topic suggestions using a static curated list; no database required.

### P2 — Requires evidence and a new design decision

1. Arbitrary SQL execution with disposable fixtures and a hardened sandbox.
2. Arbitrary Python execution and automatic code grading in an isolated runner.
3. Accounts and persistent history.
4. Sharing, social features, or competitive scoring.
5. Multi-provider routing, RAG, fine-tuning, or a question content database.

## 4. MVP acceptance criteria

The MVP is launch-ready only when all statements are true:

1. A user can create a valid SQL or Python request with every documented input and receives exactly
   the requested number and mode mix or a safe recoverable error.
2. No question reaches practice until strict parsing, schema validation, deterministic invariants,
   and all-pass semantic review complete.
3. A user can answer, navigate, reveal hints, submit, review explanations, self-assess written
   answers, see a truthful summary, repeat, and restart.
4. Objective and self-assessed results are clearly separated.
5. Refresh recovery works within the current tab and corrupt storage cannot break the application.
6. The complete workflow is responsive, keyboard operable, usable at 200% zoom, and has no known
   WCAG 2.2 AA blocker.
7. API keys remain server-side; AI output is inert text; size, timeout, retry, rate, concurrency,
   origin, and error-disclosure controls are verified.
8. The selected Nemotron model passes the qualification threshold and production endpoint smoke
   tests within the recorded latency and cost budget.
9. Format, lint, type check, unit/integration/component tests, production build, and core Playwright
   flows pass.
10. Setup, configuration names, deployment, rollback, verification evidence, and limitations are
    current and contain no secret values.

## 5. Actionable P3 starting sequence

1. Obtain the NVIDIA key through secure environment configuration and run M0 only.
2. Record the qualified model and JSON mode in a short follow-up decision note.
3. Scaffold M1 with the current stable compatible packages and commit the lockfile.
4. Complete M2 before writing prompts or UI so every boundary has one contract.
5. Complete M3 and M4 against fixtures before connecting the form.
6. Build M5 and M6 as vertical user-visible slices.
7. Treat M7 and M8 as release work, not optional cleanup.

The first P3 implementation task should therefore be **M0 provider/model qualification**, followed
by **M1 application scaffold** only after the provider path is proven.
