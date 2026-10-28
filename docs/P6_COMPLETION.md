# P6 comprehensive testing and repair report

P6 is complete with no known critical functional defect in the primary workflow. Testing covered the
local application, mocked failure boundaries, production build/runtime, and three opt-in live NVIDIA
generation paths. Remaining release conditions are listed below rather than represented as
completed.

## Defects repaired

| Severity | Root cause                                                                                                                                 | Repair and regression evidence                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| High     | Chunked request and provider bodies were checked only after full buffering.                                                                | Added shared bounded stream reading; route and provider tests exceed the cap without `Content-Length`. |
| High     | The browser trusted structurally valid practice sets whose questions could disagree with count, mode, topic, difficulty, or code language. | Added cross-field set validation and negative tests for every mismatch.                                |
| Medium   | Storage denial could navigate from a successful generation to an empty practice page.                                                      | Navigation now requires a successful bounded session write and shows an actionable error otherwise.    |
| Medium   | Session restoration accepted missing/inconsistent answers or an impossible filtered-review position.                                       | Added session invariants, corrupt-state rejection, bounded UTF-8 storage, and compatibility defaults.  |
| Medium   | Cancelling/unmounting the generator did not guarantee the browser request was aborted.                                                     | Added unmount cleanup plus cancellation and duplicate-submission regression tests.                     |
| Medium   | Incomplete-finish confirmation could display “0 unanswered” after the final response was submitted.                                        | Confirmation now derives from the live unanswered count; written-mode E2E covers the repair.           |
| Medium   | ASCII-only normalization falsely merged multilingual options and prompts.                                                                  | Unicode letter/number normalization and multilingual validator coverage were added.                    |
| Low      | `application/jsonp` passed the JSON prefix check and forwarded hosts were compared without normalization.                                  | Exact media-type parsing and normalized first-forwarded-host comparison are route-tested.              |
| Low      | Browser parse/network failures could expose technical exception text.                                                                      | Added stable recovery messages for malformed service data and network failures.                        |
| Low      | Standard HTTP-date `Retry-After` values were ignored.                                                                                      | Numeric and date forms are parsed, rounded, and capped at 60 seconds with tests.                       |

No dependency was added for these repairs.

## Executed test matrix

- **Static/default suite:** formatting, strict TypeScript, ESLint, 82 unit/integration/component
  tests, dependency audit, production build, and source credential-pattern scan.
- **API and AI boundaries:** valid/invalid requests, exact content type, malformed and oversized
  streams, cross-origin rejection, schema inconsistency, provider rejection/timeout/rate limit/5xx,
  network and stream failure, retry exhaustion, semantic rejection, cancellation, and safe errors.
- **Browser journeys:** 12 Playwright cases across desktop, tablet, and mobile Chromium covering all
  three modes, refresh restore, navigation, grading, written self-assessment, unfinished completion,
  results actions, filtered review, empty recovery, preserved retry input, and no horizontal
  overflow.
- **Live model:** SQL MCQ, Python written, and Python mixed sets passed generation, deterministic
  validation, semantic review, and trusted assembly using the configured Nemotron model.
- **Production smoke:** secure headers, 200 home response, safe 400 problem response, and local
  transfer diagnostics were inspected. Desktop and mobile home/practice screenshots were visually
  checked for clipping, overlap, spacing, hierarchy, and responsive loss.

## Remaining issue log and release conditions

1. AI review cannot prove factual correctness. Run the planned 30-case balanced, human-scored model
   qualification before describing the model as launch-qualified.
2. Run a real screen-reader pass and keyboard/focus review in target desktop browsers; automation
   covers semantics and core keyboard behavior but is not an assistive-technology substitute.
3. Firefox, WebKit, load, penetration, public HTTPS edge, and field Core Web Vitals testing require
   the eventual deployment environment.
4. In-memory rate and concurrency limits are per process. Configure and verify platform-level abuse
   controls before public or multi-instance traffic.
5. The live Python mixed smoke took 29.7 seconds in this run. It stayed within configured request
   limits, but production latency and cost must be measured over a larger qualification sample.
6. Rotate the NVIDIA credential that was previously shared through the conversation before any
   production deployment, then update the managed secret without committing its value.

These are documented conditions, not hidden test passes. None is a broken local primary interaction,
but items 1–4 and 6 remain release gates under the existing roadmap.
