# ADR 0001: Use a single full-stack Next.js application for the MVP

Date: 2026-10-27

Status: Accepted for P3

Decision owners: Topicore project

## Context

Topicore needs a responsive web interface, a server-only NVIDIA API boundary, strict runtime
validation, and a low-cost path for one developer. It does not currently need accounts, persistence,
a database, generated-code execution, or independent service scaling. The permanent project rules
prioritize simplicity, reliability, user experience, and minimal dependencies.

## Decision

Use one Next.js App Router application on the Node.js runtime with TypeScript, React, Tailwind CSS,
and Zod.

- The browser owns the active practice session through a React reducer and versioned
  `sessionStorage`.
- One stateless Next.js route owns generation, validation, semantic review, and safe error mapping.
- A narrow native-`fetch` adapter calls the NVIDIA OpenAI-compatible hosted endpoint.
- No database, authentication service, queue, vector store, separate backend, AI SDK, global state
  library, component framework, or generated-code runner is included.
- Deployment remains standard Node. Vercel is preferred if its current plan passes timeout and
  abuse-control qualification; one managed Node instance is the fallback.

## Consequences

### Positive

- One repository, language, dependency graph, deployment unit, and local workflow.
- The NVIDIA key stays server-side without CORS or a second service.
- Domain contracts can be shared between form, route, pipeline, and storage.
- The architecture matches current scope and remains inexpensive to operate.
- A future provider or persistence change is localized without a speculative plugin platform.

### Negative

- The deployment combines UI and generation release cadence.
- AI calls can approach serverless duration limits and must be qualified.
- In-memory rate limiting is only authoritative for one instance; horizontal scaling needs a
  host-level or shared limiter.
- Browser-held answers are inspectable, which is acceptable for self-practice but not competitive
  assessment.
- Written answers rely on self-assessment because arbitrary semantic grading would overstate
  certainty.

## Alternatives rejected

- **Static browser app calling NVIDIA:** exposes credentials and loses server controls.
- **Vite SPA plus Node API:** adds builds, CORS, configuration, and deployment surface without a
  current separation benefit.
- **Python/FastAPI backend plus React:** adds a second language and contract boundary; Topicore does
  not need Python AI libraries for one HTTP call.
- **Microservices and queues:** add operations and failure modes without scale evidence.
- **Database-backed sessions:** solve no launch requirement.
- **Code execution at launch:** requires a sandbox and security program disproportionate to the
  initial validated-question experience.

## Revisit when

- Measured generation traffic requires multiple independently scaled API instances.
- A real requirement introduces accounts or cross-device persistent history.
- Safe code execution becomes an approved product goal with a separate sandbox design.
- Hosting constraints prevent the two-pass pipeline from meeting latency or cost targets after model
  and prompt optimization.
- Another provider becomes a current requirement rather than a hypothetical option.
