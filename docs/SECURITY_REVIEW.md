# Security and production review

## Controls verified

- Provider credentials are read only in server modules and are never returned in errors.
- The provider base URL must use HTTPS, cannot contain URL credentials/query/fragment, and is
  restricted to `nvidia.com` or its subdomains so a configuration mistake cannot forward the bearer
  credential to an arbitrary host.
- Requests require the exact JSON media type, are stream-read only up to their byte limit, use
  strict Zod schemas, and reject cross-origin browser submissions based on the normalized request
  host.
- AI output is untrusted: it passes strict schema, deterministic, and semantic-review boundaries
  before becoming a practice set.
- React renders generated content as text. There is no raw HTML rendering, dynamic evaluation, SQL
  execution, or Python execution.
- Provider calls are non-streaming, abortable, and limited to 60 seconds. Declared and chunked
  responses stop at the 256 KiB cap instead of first buffering an unbounded body. Generation uses at
  most two complete generation-and-review attempts (four calls total).
- The route applies a small in-memory request window and concurrency cap. Expired source buckets are
  cleaned periodically, and the map has a fail-closed 10,000-source cardinality cap. Successful and
  error responses do not cache generated content.
- Global response headers set a restrictive content security policy, deny framing and unnecessary
  browser capabilities, prevent MIME sniffing, and use a strict referrer policy. Production also
  sends a two-year HSTS policy including subdomains.
- `npm audit --audit-level=high` reported zero known vulnerabilities on 2026-10-28. A clean lockfile
  install, optimized build, source/client credential scan, and 15 browser cases also passed.

## Residual risks and conditions

- LLM review reduces but cannot eliminate factual errors. The UI must retain cautious written-answer
  language and must not claim certification.
- In-memory rate limiting is per process and resets on deployment. A platform-level rate limit is
  required before meaningful public traffic or multi-instance scaling.
- `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` remain because Next.js hydration and
  intentional inline progress/color styles currently need them. No unsafe HTML API is used.
- Reverse proxies must preserve a trustworthy `Host` or `X-Forwarded-Host` header for origin checks.
- Browser session data is local to the tab and is not encrypted beyond browser storage controls. It
  contains generated questions and user answers, not account or payment data. Stored state is
  runtime-validated and limited to 768 KiB.
- The selected managed environment's injected default model returned HTTP 410 in all six P7 cases.
  An explicit qualified-model override reached the provider successfully and passed five of six
  matrix cases plus the targeted rerun. The managed/deployment model value must be corrected and
  retested before release; provider availability, quota, and behavior remain external dependencies.
- The development NVIDIA credential was previously shared through the conversation. It was not found
  in project files, but it must be rotated before production and replaced through the hosting secret
  manager.

## Verdict

Ready with conditions: automated and production-like local checks pass, but deployment is blocked
until the managed model is changed and retested, the exposed development key is rotated, the 30-case
model qualification passes, and platform-level abuse controls are configured.
