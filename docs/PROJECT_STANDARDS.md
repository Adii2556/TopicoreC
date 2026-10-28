# Topicore Project Standards

This document defines the durable engineering, product, design, security, AI, and delivery standards
for Topicore. It is intentionally technology-light so the rules survive framework changes.
`AGENTS.md` is the concise enforcement entry point; this document provides the full conventions and
definition of done.

## 1. Normative language

- **MUST / MUST NOT** rules are mandatory.
- **SHOULD / SHOULD NOT** rules are strong defaults; document why a change departs from them.
- **MAY** rules are preferences or context-dependent options.

Exceptions to a mandatory rule require a written decision that states the need, scope, risks,
alternatives considered, mitigation, owner, and review date. “Faster to implement” is not sufficient
when the exception harms users, security, or correctness.

## 2. Product principles and constraints

### Mandatory

1. Optimize the primary journey: enter subject, topics, difficulty, question count, and mode;
   generate; practice.
2. Initially support SQL and Python on the web, with no authentication requirement.
3. Use the NVIDIA Build API through a configurable Nemotron model. Provider access remains
   server-side.
4. Prefer simplicity, reliability, and user experience over feature count.
5. Do not add a database, accounts, microservices, queues, caches, background job infrastructure, or
   other operational systems until a demonstrated requirement justifies their ownership cost.
6. Do not claim planned, mocked, disabled, or partially wired behavior is complete.
7. Do not add adjacent features merely because the architecture could support them.

### Preferences

- The application should be useful without onboarding, personalization, or saved history.
- Favor a focused practice experience over dashboards and configuration-heavy flows.
- Prefer reversible decisions while product requirements are still narrow.

## 3. Architecture

Use a small modular application rather than distributed services. The exact folders may follow the
selected framework, but dependencies MUST flow toward domain concepts instead of toward UI or
provider details.

Conceptual responsibilities:

| Area           | Owns                                                                 | Must not own                                          |
| -------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Presentation   | Forms, practice UI, interaction state, accessible feedback           | Provider calls, prompt construction, answer authority |
| Application    | Generate-practice-set use case, limits, orchestration, error mapping | Framework rendering details                           |
| Domain         | Subjects, modes, difficulty, question schema, validation rules       | HTTP, UI components, NVIDIA SDK details               |
| AI integration | Versioned prompts, provider adapter, response parsing, retry policy  | User interface behavior                               |
| Verification   | Structural and semantic checks, deterministic evaluators             | Provider credentials, visual state                    |
| Infrastructure | Server routes, configuration loading, logging, external clients      | Domain policy hidden inside transport code            |

### Mandatory

- Define stable, typed contracts at boundaries and validate runtime data once when it enters the
  trusted core.
- Keep provider code replaceable without designing a generalized multi-provider platform. One narrow
  interface around NVIDIA is enough.
- Keep side effects at the edges. Domain validation and transformations SHOULD be deterministic and
  testable without network access.
- Use explicit states and discriminated results for expected outcomes; do not use exceptions as
  routine control flow across the application.
- Configuration MUST be injected from the server environment and checked at startup or first use
  with a precise diagnostic.
- Prefer a single deployable application while the product remains at MVP scale.

### Avoid

- Repository/service/factory layers that only forward calls.
- Global mutable state, circular dependencies, hidden network calls, and business rules embedded in
  UI components.
- Generic plugin systems, event buses, or internal SDKs without multiple proven uses.
- Premature caching. Add a cache only with a measured bottleneck, bounded lifetime, invalidation
  strategy, and privacy review.

## 4. Code and engineering conventions

### Required qualities

- Code MUST be readable, strongly typed, cohesive, and unsurprising.
- Public and boundary types MUST be explicit. Avoid unbounded `any`, unchecked casts, and broad
  dictionaries when a domain type is known.
- Names MUST describe domain meaning. Avoid vague containers such as `utils`, `helpers`, or `data`
  when a precise module name is possible.
- Functions SHOULD do one coherent job, accept explicit inputs, and return explicit outputs. Prefer
  pure functions for parsing, normalization, and validation.
- Errors MUST preserve a stable internal cause while exposing a safe, actionable external message.
- Constants and enumerations MUST centralize supported subjects, modes, difficulty values, and
  limits so UI and server validation cannot drift.
- Generated files and vendored code MUST be clearly identified and not hand-edited.
- Formatting, linting, type checking, and tests SHOULD be automated and deterministic.

### Change discipline

- Make the smallest complete change that satisfies explicit acceptance criteria.
- Keep refactors separate unless they are necessary for the requested behavior.
- Preserve public behavior during refactors and add characterization tests first when behavior is
  unclear.
- Never weaken types, validation, tests, TLS, or security controls just to make a check pass.
- Do not modify lockfiles except through the selected package manager and an intended dependency
  change.
- Delete obsolete code when its replacement is verified; do not maintain speculative parallel
  implementations.

## 5. Dependency policy

Before adding a dependency, record the capability it provides and confirm that the platform or
existing dependencies do not already provide it adequately.

A new dependency MUST:

- solve a current, non-trivial need;
- be actively maintained, appropriately licensed, documented, and compatible with the selected
  runtime;
- have acceptable security history, bundle/runtime cost, and transitive dependency impact;
- be pinned through the project lockfile; and
- be used through the smallest practical surface area.

Avoid packages for trivial formatting, small data transforms, simple fetch wrappers, one-off
styling, or functionality that is safer and clearer in a few local lines. Remove unused dependencies
promptly. Review dependency updates in small batches and run the relevant regression suite.

## 6. UI, UX, and design system

The interface should feel calm, direct, and professional, taking inspiration from focused
coding-practice tools without copying their branding or visual assets.

### Design foundations

- Define semantic design tokens for color, typography, spacing, radius, borders, elevation, motion,
  and breakpoints. Components consume semantic tokens rather than unexplained raw values.
- Use a restrained type scale, readable line lengths, and a consistent spacing rhythm. Hierarchy
  comes from position, spacing, weight, and contrast before decoration.
- Build reusable primitives only after a pattern repeats or is clearly foundational (for example
  Button, Field, Select, Card, Alert, and Dialog). Variants MUST be finite and documented.
- Reuse language, placement, status colors, icons, and interaction behavior for the same concept
  everywhere.
- Prefer content-driven responsive layouts. The full workflow MUST remain usable on small screens,
  keyboard-only input, zoomed layouts, and common desktop widths.

### Interaction requirements

- Each control MUST have a visible or programmatic label, appropriate semantics, a keyboard path,
  focus indication, and a meaningful disabled state when applicable.
- Validation errors MUST identify the field, explain the correction, and be announced to assistive
  technology. Do not rely on color alone.
- Generation MUST expose a clear pending state, prevent accidental duplicate work, and provide retry
  or recovery for recoverable failures.
- Preserve user input when generation fails. Never force users to reconstruct a form because an
  external request failed.
- Destructive or irreversible actions require clear wording and proportionate confirmation. Avoid
  confirmation for harmless, easily reversible actions.
- Empty states explain the next useful action. Loading placeholders must not suggest real content
  that does not exist.
- Honor reduced-motion settings. Motion SHOULD clarify transition or causality and MUST NOT be
  required to understand state.

### Accessibility baseline

Target WCAG 2.2 AA. At minimum, use semantic HTML, logical heading order, sufficient contrast,
visible focus, accessible names and descriptions, useful landmarks, correct form associations,
keyboard-operable overlays, and announcements for async status changes. Test at 200% zoom and ensure
touch targets are comfortably usable.

## 7. Performance and resource use

Performance work begins with a small design and measured behavior, not speculative optimization.

### Mandatory

- Keep initial client code and assets minimal. Lazy-load non-critical, substantial functionality
  only when it measurably improves the experience.
- Avoid unnecessary rendering, duplicate derived state, repeated parsing, and network calls
  triggered by render cycles.
- Submit one generation request per user action. Disable duplicate submission, abort stale requests
  when safe, and cap concurrency and output size.
- Apply server-enforced limits to question count, prompt length, response size, execution time, and
  retry count.
- Stream only when it improves perceived progress without bypassing complete JSON validation. Do not
  render unvalidated partial questions as trusted content.
- Optimize images and fonts, avoid layout shifts, and use appropriate caching for immutable static
  assets.
- Measure before adding application caches or complex memoization.

### Service objectives

On representative production devices and networks, target the “good” Core Web Vitals thresholds: LCP
at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1 at the 75th
percentile. AI generation latency is reported separately; the interface must acknowledge submission
immediately and remain responsive.

## 8. Security and privacy

### Secrets and configuration

- Store API keys only in server-managed environment variables or an approved secret store. Never
  prefix secrets for client exposure or serialize them into browser payloads.
- Commit a documented example of required variable names only when useful; never commit values. Fail
  safely and clearly when required configuration is absent.
- Redact credentials, authorization headers, full prompts, model output containing user content, and
  stack traces from routine logs.

### Input, output, and transport

- Treat browser input, URL state, AI output, provider errors, and generated code as untrusted.
- Validate type, length, range, enum membership, and supported combinations on the server. Client
  validation improves UX but is not a security boundary.
- Encode output for its context and rely on framework-safe rendering. Do not inject AI-generated
  HTML. Sanitize any future rich content with a proven, configured sanitizer.
- Use same-origin protections, secure headers, restrictive CORS, HTTPS, safe cookie defaults if
  cookies are introduced, and dependency vulnerability review.
- Do not expose provider details or raw error bodies to the client. Map failures to stable error
  codes and user-centered messages.
- Rate-limit and bound expensive generation endpoints before public deployment.

### Generated code execution

SQL or Python execution is a distinct high-risk capability. If introduced, isolate it from the
application and host with no secrets, no network by default, a disposable filesystem, non-privileged
identity, restricted syscalls/process creation, and hard CPU, memory, output, and wall-clock limits.
Use seeded, disposable fixtures. Treat a sandbox escape risk review and adversarial tests as release
blockers.

## 9. AI generation and verification

### Request contract

- Prompt templates MUST be fixed, versioned, centrally stored, and covered by tests.
- Separate system rules, task data, and user-provided topic text. Clearly delimit untrusted content
  and instruct the model not to treat it as policy.
- Inputs MUST use allowlisted subjects, modes, and difficulty levels with bounded topic text and
  question counts.
- The model name, endpoint, timeouts, and safe generation parameters MUST be server-configurable
  with reviewed defaults.

### Response contract

- Request JSON matching an explicit, versioned schema. Use stable identifiers and mode-specific
  discriminated variants rather than optional-field combinations.
- Parse strictly, then validate structure, allowed values, uniqueness, question count, answer shape,
  explanation presence, hint rules, and internal consistency.
- Reject extra or malformed data when accepting it could hide model mistakes.
- Never place raw model output directly into executable code, HTML, or a trusted UI state.

### Answer authority

- A model assertion is not verification. Use deterministic checks where feasible: execute SQL
  against controlled fixtures; evaluate Python against bounded tests in an approved sandbox; verify
  multiple-choice answers reference exactly one valid option; and verify expected-output questions
  against a reference evaluator.
- Where deterministic proof is not feasible, label the limitation internally, apply independent
  consistency checks, and do not overstate correctness to users.
- Explanations and hints MUST agree with the verified answer and must not reveal a hidden answer
  when the active mode requires progressive disclosure.

### Failure and retry policy

- Set explicit connection and request timeouts.
- Retry only transient provider failures with bounded backoff, or perform a single schema-repair
  attempt when the failure is demonstrably repairable. The application default MUST never exceed two
  additional provider calls per user generation action without a documented decision.
- Revalidate every retry from scratch. Do not merge untrusted fragments from failed responses.
- On exhaustion, return a recoverable error, preserve user inputs, and offer an intentional retry.
  Log a correlation ID and safe failure category, not sensitive payloads.

## 10. Error handling and observability

Define a small error taxonomy, such as invalid request, unsupported configuration, provider
unavailable, provider rejected, invalid AI response, verification failed, rate limited, and internal
failure.

- User messages state what happened in plain language and the next available action.
- Internal logs include time, severity, stable error code, correlation ID, duration, attempt count,
  and provider status category where safe.
- Logs MUST NOT include secrets or unnecessary user/model content.
- Do not swallow errors. Handle, translate, or deliberately propagate them.
- Monitoring MUST remain proportionate to a solo, low-budget project. Prefer provider and hosting
  capabilities before adding an observability platform.

## 11. Testing requirements

Tests are part of implementation, not a later phase. Each phase MUST leave the repository runnable
and its completed behavior verifiable.

| Change                       | Minimum required evidence                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Domain rule or validator     | Unit tests for success, boundaries, and malformed input                                                    |
| Prompt or AI schema          | Contract tests with valid, truncated, extra-field, wrong-mode, and inconsistent fixtures                   |
| Provider integration         | Mocked adapter tests for success, timeout, rate limit, malformed response, retry exhaustion, and redaction |
| API endpoint                 | Integration tests for validation, safe errors, configuration failure, limits, and successful mapping       |
| UI component                 | Behavior tests for user actions, keyboard use, labels, focus/error states, and async states                |
| Core user journey            | End-to-end happy path plus generation failure and recovery                                                 |
| SQL/Python execution         | Isolation, resource-limit, malicious-input, timeout, output-cap, and deterministic correctness tests       |
| Performance-sensitive change | Before/after measurement using the same scenario                                                           |
| Security-sensitive change    | Threat-focused negative tests and documented review of trust boundaries                                    |

Tests MUST be deterministic by default. Automated tests must not call a paid live AI API unless they
are explicitly separated, opt-in, budget-bounded integration checks. Use representative fixtures
captured without secrets. A test that executes zero cases, relies only on snapshots for behavior, or
disables the relevant assertion is not evidence.

Before merging a normal change, run the repository’s formatter/check, linter, type checker, relevant
tests, and production build. Run the core end-to-end path for changes that affect it. Document any
skipped check and why it could not run.

## 12. Documentation requirements

- Keep the root README focused on purpose, prerequisites, local setup, required environment variable
  names, development commands, tests, and deployment basics.
- Document public contracts, configuration, non-obvious security constraints, prompt schema
  versions, and operational limits near the owning code or in focused docs.
- Add a short architecture decision record for choices that are expensive to reverse, introduce
  infrastructure, change trust boundaries, or establish a project-wide convention. Do not create
  decision records for routine implementation details.
- Update documentation in the same change that alters behavior or configuration.
- Never document an untested command as known working. Distinguish required steps, optional tools,
  and future ideas.
- Comments and docs MUST describe current reality. Remove stale guidance promptly.

Each development phase should state its scope, explicit non-goals, acceptance criteria, risks, test
evidence, configuration changes, and known limitations. Future work belongs in an issue or roadmap,
not disguised as completed behavior.

## 13. Git and review conventions

- Keep commits and reviews small enough to understand and revert.
- Use imperative, descriptive commit subjects and explain the reason for non-obvious changes in the
  body.
- Do not commit credentials, local environment files, generated caches, build output, or editor
  state.
- Review diffs for accidental formatting, lockfile churn, debug output, commented-out code, and
  unrelated changes.
- Do not rewrite shared history or discard another contributor’s work to simplify a change.

## 14. Definition of done

A feature, fix, refactor, or project phase is done only when all applicable items are true:

### Scope and behavior

- The requested acceptance criteria work end to end; visible controls perform their stated actions.
- Explicit non-goals remain out of scope, and no speculative functionality was added.
- Loading, empty, success, invalid-input, provider-failure, and retry-exhaustion states are handled
  where applicable.
- There are no knowingly misleading placeholders, silent failures, or dead controls.

### Code and architecture

- Code is readable, strongly typed, modular, and follows the established dependency boundaries
  without unnecessary abstraction.
- Runtime validation exists at every untrusted boundary.
- Dependencies are justified, locked, and limited; obsolete code and dependencies are removed.
- The diff contains no unrelated rewrites or formatting churn.

### AI, security, and reliability

- Prompt and response contracts are versioned and schema-validated.
- Answers, explanations, and hints receive the applicable verification and consistency checks before
  display.
- Timeouts, finite retries, limits, safe errors, and recovery behavior are present.
- Secrets remain server-side; logs and client responses contain no sensitive data.
- New trust boundaries or code execution paths received a threat-focused review.

### Experience and performance

- The change is responsive, keyboard usable, semantically structured, visibly focusable, and checked
  for contrast and assistive feedback.
- Interface patterns and design tokens are reused consistently.
- The change does not introduce unnecessary requests, renders, blocking assets, or uncontrolled
  resource consumption; significant regressions are measured.

### Verification and handoff

- Relevant automated tests cover normal, boundary, and failure behavior and pass.
- Formatting, linting, type checking, production build, and applicable end-to-end checks pass.
- Documentation, setup instructions, schemas, and configuration examples reflect the implemented
  behavior.
- Verification performed, checks skipped, residual risks, and known limitations are reported
  accurately.

If an applicable item is not satisfied, the work is not done. Record it as a known limitation only
when the product can safely and honestly ship without it; otherwise, it remains a blocker.
