# P7 final security, UX, performance, and production review

Date: 2026-10-28

## Verdict

**Ready with conditions.** The application code and built production server pass the local release
gates, and no known critical or high-severity application defect remains. Do not deploy publicly
until the managed `NVIDIA_MODEL` value is changed to a currently available, qualified model, the
credential previously shared in chat is rotated, and deployment-level abuse controls are enabled.

This verdict means the code is a credible release candidate; it does not mean the currently selected
cloud configuration is deployable unchanged.

## P7 changes

| Area               | Finding                                                                                                                                            | Resolution                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Provider boundary  | A configurable base URL could direct the server-held credential to an arbitrary host.                                                              | Configuration now requires HTTPS, rejects credentials/query/fragment, and permits only `nvidia.com` or its subdomains.                 |
| Abuse resistance   | Per-source rate buckets could grow without a bound under high-cardinality traffic.                                                                 | Expired buckets are periodically removed and the map is capped at 10,000 sources with fail-closed admission.                           |
| Cancellation       | A request aborted during retry backoff could still begin the replacement attempt.                                                                  | The pipeline now checks the abort signal immediately before and after the bounded backoff.                                             |
| Transport security | The production response lacked HSTS.                                                                                                               | Production responses now send a two-year `Strict-Transport-Security` policy with subdomains.                                           |
| Recovery UX        | Framework error and not-found states did not have Topicore-specific recovery paths.                                                                | Added generic error, root-error, and not-found experiences with working retry/home actions and no internal detail leakage.             |
| Discoverability    | Public/utility page indexing intent was incomplete.                                                                                                | Added Open Graph, Twitter, and robots metadata; the transient practice workspace is `noindex, nofollow`.                               |
| Accessibility      | Placeholder text measured approximately 4.41:1 against its field surface.                                                                          | Raised the token to approximately 4.83:1; primary, muted, action, warning, and danger text combinations also meet AA contrast targets. |
| Test coverage      | The production policy, fallback pages, base-URL boundary, limiter cardinality, retry cancellation, and 404 journey lacked direct regression tests. | Added focused unit/integration/browser coverage for each boundary.                                                                     |

No new runtime dependency was introduced.

## Executed release evidence

- A fresh `npm ci` completed using Node.js 24.19.0 and npm 11.9.0.
- Formatting, strict TypeScript, ESLint, and 96 deterministic tests passed. Six opt-in live tests
  are intentionally skipped by the default suite.
- The optimized Next.js 16.4.3 build passed.
- All 15 Playwright journeys passed in desktop, tablet, and mobile Chromium profiles, including the
  custom not-found recovery.
- `npm audit --audit-level=high` reported zero known vulnerabilities.
- The built production server returned the expected CSP, HSTS, frame denial, MIME, referrer, and
  permissions policies. The custom unknown route returned 404, and `/practice` rendered
  `noindex, nofollow`.
- A production-server request through the real API returned 201, `Cache-Control: no-store`, one
  strictly validated multiple-choice question, and completed in 2.923 seconds.
- Built static JavaScript totaled 754,346 raw bytes across chunks; the largest chunk was 235,044 raw
  bytes. This is a build diagnostic, not transferred/compressed route JavaScript or a Core Web
  Vitals measurement.
- No source maps or NVIDIA/OpenAI credential markers were found in the client static output.

## Live-provider finding

The managed environment reports current network and credential readiness, but all six cases using
its configured default model failed with NVIDIA HTTP 410. This establishes that readiness of an
injected variable does not establish continued model availability.

With an explicit `nvidia/nemotron-3.5-lightning-30b-a3b` override in prompt JSON mode, all six
balanced SQL/Python cases passed the complete generation, validation, semantic-review, and assembly
pipeline after the prompt-v2 reliability repair. The repair aligned the model JSON contract with
runtime length limits, allowed valid concise written answers, supplied trusted rejection categories
to the one replacement attempt, and required a bounded schema-validated review rationale. Strict
validation and the two-attempt ceiling remain intact. This smoke evidence is useful but does not
replace the planned 30-case human-scored qualification.

## Remaining release conditions

1. Update and review the managed/deployment `NVIDIA_MODEL` value, then repeat the live matrix with
   no command-line override. HTTP 410 from the current default is a deployment blocker.
2. Rotate the NVIDIA key previously shared in chat and update only the platform secret store.
3. Run the balanced 30-case human-scored qualification and meet the architecture's structural and
   correctness thresholds.
4. Configure public-edge rate limiting, request/concurrency controls, and privacy-safe alerts. The
   in-process limiter remains defense in depth, not a distributed control.
5. Verify the public HTTPS edge, forwarded-host behavior, and rollback on the selected host.
6. Complete real assistive-technology, keyboard/focus, Firefox, and WebKit passes. Run load and
   penetration testing against the deployed boundary and collect field Core Web Vitals.
7. Track the ESLint 9 maintenance warning. ESLint 10 cannot be adopted independently while the
   Next.js-bundled lint plugins declare support only through ESLint 9; upgrade that toolchain as a
   compatible set.

## Launch scope confirmation

The release remains deliberately small: no accounts, database, analytics, generated-code execution,
or server-side session persistence. Generated SQL and Python stay inert text. Those constraints are
security and maintenance decisions, not incomplete placeholders.
