# Topicore

Topicore is a minimalist AI-powered practice application for SQL and Python. A user chooses topics,
difficulty, question count, and a mode, then moves directly into a responsive practice session with
hints, explanations, review, and an honest completion summary.

## Current capabilities

- Multiple-choice, written-response, and alternating mixed sessions.
- Server-only NVIDIA Build API integration with a configurable Nemotron model.
- Versioned prompts, strict Zod schemas, deterministic consistency checks, one bounded generation
  retry, and a separate semantic review call.
- MCQ auto-grading and written-answer self-assessment against a reference answer and key points.
- Session restoration in `sessionStorage`, session bookmarks, focused revisit review, keyboard
  shortcuts, incomplete-session confirmation, and reuse of the prior setup.
- Request-size, concurrency, and per-instance rate limits; safe problem responses; provider timeout
  handling; and production security headers.

Topicore does not execute generated SQL or Python. It has no database, accounts, analytics, or
server-side session persistence.

## Local setup

Requirements: Node.js 24.15–24.x and npm 11 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Add `NVIDIA_API_KEY` to `.env.local` to enable live generation. Keep
the key server-side; variables prefixed with `NEXT_PUBLIC_` are intentionally not used for provider
configuration.

The tested model is `nvidia/nemotron-3.5-lightning-30b-a3b`. Model access and structured-output
support can vary by NVIDIA account, so confirm the configured model before deployment. Set
`NVIDIA_JSON_MODE=guided_json` only after confirming that the selected endpoint supports NVIDIA's
guided JSON extension; `prompt` is the conservative default.

## Commands

| Command                | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Start the development server               |
| `npm run build`        | Create the optimized production build      |
| `npm start`            | Run the production build                   |
| `npm run typecheck`    | Check TypeScript                           |
| `npm run lint`         | Run ESLint                                 |
| `npm test`             | Run unit and integration tests             |
| `npm run test:e2e`     | Run desktop and mobile Playwright journeys |
| `npm run format:check` | Verify formatting without changing files   |

Playwright normally uses its managed Chromium. In an environment with a system Chromium, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to that executable before running the E2E suite.

## Temporary developer monitor

For local troubleshooting, set `ENABLE_DEV_MONITOR=true` in `.env.local`, restart `npm run dev`, and
open `http://localhost:3000/dev/monitor`. The panel shows only measured in-memory events from the
browser, generation route, NVIDIA adapter, validators, reviewer, and retry pipeline. It is disabled
with a server-side 404 outside development, even if the flag is set. Do not use it as a production
admin system. See [`docs/DEV_MONITOR.md`](docs/DEV_MONITOR.md) for captured events, limitations, and
removal instructions.

## Generation flow

1. The API validates media type, body size, origin, request shape, rate, and concurrency.
2. A versioned system prompt treats user topics as data and requests one strict JSON document.
3. The response is parsed and validated for count, type sequence, topics, difficulty, option IDs,
   duplicate content, code language, and obvious hint leakage.
4. A bounded model call independently reviews correctness, ambiguity, difficulty, answer and
   explanation alignment, topic relevance, and unsafe or version-dependent behavior.
5. One complete regenerate-and-rereview attempt is allowed for retryable provider, invalid-output,
   or semantic-review failures.
6. Only a fully passing set receives trusted server-generated IDs and reaches the browser.

## Documentation

- [`AGENTS.md`](AGENTS.md): mandatory repository-wide working rules.
- [`docs/PROJECT_STANDARDS.md`](docs/PROJECT_STANDARDS.md): engineering, UX, AI, testing, and
  definition-of-done standards.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): architecture, contracts, data flow, and risks.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): implementation milestones and launch acceptance criteria.
- [`docs/P4_COMPLETION.md`](docs/P4_COMPLETION.md): essential-feature scope and verification report.
- [`docs/P5_COMPLETION.md`](docs/P5_COMPLETION.md): implemented productivity enhancements and
  non-goals.
- [`docs/P6_COMPLETION.md`](docs/P6_COMPLETION.md): comprehensive test matrix, repaired defects, and
  remaining release conditions.
- [`docs/P7_FINAL_REVIEW.md`](docs/P7_FINAL_REVIEW.md): final audit, executed release evidence,
  deployment blockers, and verdict.
- [`docs/ENHANCEMENTS.md`](docs/ENHANCEMENTS.md): P5 prioritization and scope decisions.
- [`docs/DEV_MONITOR.md`](docs/DEV_MONITOR.md): temporary local monitoring setup, event coverage,
  security boundaries, and removal instructions.
- [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md): security and production audit.
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md): executed checks and known test limitations.
- [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md): deployment checklist.
