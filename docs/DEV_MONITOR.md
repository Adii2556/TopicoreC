# Temporary developer monitor

The Topicore developer monitor is a local, temporary troubleshooting tool at `/dev/monitor`. It uses
explicit structured events from real application operations; it does not generate placeholder
statistics or intercept global console methods.

## Enable and access

Add this only to `.env.local`:

```env
ENABLE_DEV_MONITOR=true
```

Start the development server with `npm run dev`, generate a practice set, and open
`http://localhost:3000/dev/monitor`. The page and both monitoring APIs return 404 unless
`NODE_ENV=development` and the flag is exactly `true`. The flag cannot enable monitoring in a
production build.

## Inspect one request

1. Clear history if a clean trace is useful.
2. Generate a practice set from the home page.
3. Select the newest `req_…` identifier in **Generation timeline**.
4. Expand each event's sanitized metadata to follow the request from browser submission through
   input validation, prompt construction, provider calls, parsing, deterministic validation,
   semantic review, retry, and final response.
5. Use **Copy diagnostic report** to copy only that request's sanitized events.

The browser creates the request ID and sends it in `X-Request-Id`. The server accepts only the
expected UUID-shaped identifier and generates its own identifier otherwise.

## Captured events

- Browser: `frontend.generation.submitted`, `frontend.response.received`,
  `frontend.generation.failed`, `client.error`, and `client.unhandled_rejection`.
- HTTP/input: `http.request.received`, `input.validation.started`, `input.validated`,
  `input.validation.failed`, `http.request.completed`, and `http.request.failed`.
- Pipeline: `generation.started`, `prompt.created`, `generation.retry`, `generation.completed`, and
  `generation.failed`.
- Provider: `api.request.started`, `api.response.received`, and `api.request.failed`, including
  model, endpoint identifier, attempt, duration, HTTP status, and token counts when NVIDIA supplies
  them.
- Validation: `json.parse.completed`, `json.parse.failed`, `validation.started`,
  `validation.passed`, `validation.failed`, `semantic_review.started`, `semantic_review.passed`, and
  `semantic_review.failed`.

Structural and deterministic validation remain distinct from AI-assisted semantic review in event
metadata and dashboard labels.

## Security and data handling

- NVIDIA credentials, authorization headers, raw prompts, raw model responses, and request/response
  bodies are not recorded.
- The store applies a second recursive redaction pass to event details and known credential
  patterns.
- Browser events are size- and schema-bounded before storage.
- The in-memory store retains only the newest 1,000 events and is cleared on process restart.
- No monitor data is stored in browser storage or a database.
- The dashboard provides no environment inspection, file access, or command execution.

## Known limitations

- Polling is near-real-time at one-second intervals, not streaming.
- In-memory data is process-local, disappears on restart, and is not shared across serverless or
  multi-instance deployments.
- Token counts appear only when the provider includes usage metadata.
- Browser instrumentation captures explicit generation events plus uncaught errors/rejections; it
  does not mirror every browser console message.
- Full prompts, raw responses, arbitrary server stack traces, and sensitive actual values are
  intentionally unavailable.
- A deployed staging monitor would require separate server authentication; this implementation
  deliberately refuses to run in production.

## Disable or remove

To disable it, remove `ENABLE_DEV_MONITOR` from `.env.local` or set it to `false`, then restart the
development server.

To remove the feature entirely, delete `src/app/dev/monitor`, `src/app/api/dev/monitor`,
`src/components/dev-monitor-dashboard.tsx`, `src/components/dev-monitor-bridge.tsx`, and
`src/monitoring`; then remove the explicit instrumentation calls, the layout/form bridge props, the
flag from `.env.example`, and the monitor tests. No database or migration cleanup is required.
