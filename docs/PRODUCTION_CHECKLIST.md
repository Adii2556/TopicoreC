# Production deployment checklist

## Before deployment

- [ ] Use Node.js 24.15–24.x and install with `npm ci`.
- [ ] Supply `NVIDIA_API_KEY` through the hosting platform's secret manager.
- [ ] Use a newly rotated key that has not been exposed in chat, source, logs, or test artifacts.
- [ ] Confirm `NVIDIA_MODEL` is available to the deployment account.
- [ ] Replace the currently injected model that returned HTTP 410; rerun the live matrix without a
      command-line override.
- [ ] Confirm `NVIDIA_JSON_MODE`; retain `prompt` unless guided JSON is verified.
- [ ] Allow outbound HTTPS to `integrate.api.nvidia.com` or the configured base URL.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build`.
- [ ] Run and human-score the balanced 30-case SQL/Python model qualification; record prompt/model
      versions, structural pass rate, correctness, ambiguity, latency, and rejection rate.
- [ ] Make representative SQL, Python, MCQ, written, mixed, and all-difficulty live requests after
      deployment configuration is final.
- [ ] Confirm proxy host headers satisfy the API origin check.
- [ ] Configure platform-level request limiting, logs, and alerts without logging prompts or keys.
- [ ] Review the deployment platform's data retention and NVIDIA's current terms.
- [ ] Verify keyboard/focus behavior with a real screen reader and test target Firefox and WebKit.
- [ ] Define rollback criteria and record the last known-good artifact and environment version.

## After deployment

- [ ] Verify `/` and `/practice` over HTTPS at desktop and mobile widths.
- [ ] Verify the generation API returns 201 and `Cache-Control: no-store` for a valid request.
- [ ] Verify malformed and cross-origin requests return safe 4xx responses.
- [ ] Confirm security headers at the public edge and that framing is blocked.
- [ ] Confirm no source map, log, error response, or client bundle contains the API key.
- [ ] Monitor provider latency, 429/5xx rates, validation rejection rates, and request volume.
- [ ] Record the deployed commit and environment configuration.
- [ ] Exercise the documented rollback and confirm the last known-good version starts successfully.
