# Verification record

Date: 2026-10-28

## Automated checks

- TypeScript: passed with `tsc --noEmit`.
- ESLint: passed with the Next.js and TypeScript rules enabled.
- Unit and integration tests: 105 passed across 16 files; the 6 live-provider cases are skipped by
  default.
- End-to-end: 18 passed across desktop, 820px tablet, and Pixel 7 Chromium projects.
- Production build: passed with Next.js 16.4.3.
- Clean install: `npm ci` passed with Node.js 24.19.0 and npm 11.9.0.
- Dependency audit: zero known vulnerabilities at the configured high-severity gate.

The browser journeys cover MCQ-only, written-only, and mixed generation; answer and grading states;
incomplete-finish confirmation; refresh recovery; completion and filtered review; bookmarks; all
results actions; safe error recovery and intentional retry; empty-session recovery; custom 404
recovery; and horizontal overflow checks at all three viewport sizes.

The temporary developer monitor tests cover bounded and restart-ephemeral storage, credential
redaction, browser/server request-ID correlation, successful provider metadata and token usage,
invalid JSON, validation retry and exhaustion, production 404 enforcement, filtering, expansion,
pause/resume, clearing, and responsive behavior. A live monitored generation returned 201 and
produced 16 correlated events without storing the raw question or a credential pattern. The monitor
page and all monitor APIs returned 404 from a production build even when `ENABLE_DEV_MONITOR=true`.

## Functional checks

- Invalid content type, malformed JSON, cross-origin requests, invalid settings, and absent server
  configuration return safe structured errors.
- Generation retry exhaustion and semantic-review rejection are covered with controlled model
  doubles.
- Session reducer and component tests cover navigation, answer immutability after submission, MCQ
  scoring, skipped answers, written self-assessment, bookmarks, review filters, storage defaults,
  corrupt/oversized storage, shortcuts, inert rendering, and non-interference with focused form
  controls.
- Prompt and draft tests cover strict output, duplicate options, mixed ordering, and written output.
- Latest live NVIDIA matrix with an explicit `nvidia/nemotron-3.5-lightning-30b-a3b` override in
  prompt mode: all 6 balanced subject/mode/difficulty cases passed. Each exercised generation,
  deterministic validation, schema-bound review rationale, semantic review, and trusted practice-set
  assembly. The run completed in 51.23 seconds; individual cases ranged from 3.76 to 15.57 seconds.
- The managed environment's configured default model returned HTTP 410 for all 6 cases despite
  current credential/runtime-variable readiness. Deployment configuration must be updated and
  retested without a command-line model override.
- NVIDIA guided JSON rejected the mixed union schema, so the verified configuration intentionally
  uses prompt mode plus strict local validation. Internal reasoning is disabled for structured calls
  to keep JSON in the content channel.
- Provider tests cover timeout, disconnect, 429 numeric and date retry hints, 5xx, rejection,
  cancellation, malformed envelopes, stream failure, and declared/chunked response limits.
- Route tests cover media type, malformed and oversized bodies, origin handling, request validation,
  safe provider errors, rate limits, no-store success, and the complete generated-set contract.
- Production smoke: `/` returned 200 with CSP, HSTS, frame denial, MIME, referrer, and permissions
  headers; the custom unknown route returned 404; and `/practice` rendered `noindex, nofollow`. A
  real built-server API request returned 201, no-store, and one validated MCQ in 2.923s.
- Built static JavaScript totaled 754,346 raw bytes, with a largest raw chunk of 235,044 bytes. No
  source maps or credential markers were present in the client output. These are build diagnostics,
  not compressed route-transfer or field Core Web Vitals measurements.
- `npm audit --audit-level=high` reported zero known vulnerabilities. A bounded project scan found
  no NVIDIA/OpenAI key pattern or public credential variable.

## Not executed

- No screen-reader product was available. Semantic labels, live regions, keyboard-native controls,
  focus styles, and responsive browser flows were inspected and covered where automation permits.
- Firefox, WebKit, load, penetration, and public-edge tests were not run in this Chromium-only local
  environment. The MVP has no target traffic profile or deployed edge configuration yet.
- The planned 30-case, human-scored model qualification was not run. The live smoke cases and model
  reviewer do not eliminate factual-error risk.
- No field Core Web Vitals or assistive-technology measurements exist before deployment.
