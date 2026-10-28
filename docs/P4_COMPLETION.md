# P4 essential-feature completion

P4 is complete. The essential practice experience supports the launch modes established in the P2
architecture without adding authentication, a database, generated-code execution, or unrelated
infrastructure.

## Supported question modes

| Mode             | Generation contract                                  | Assessment                                                 |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Multiple choice  | Four unique options and one explicit correct option  | Automatically graded with correctness and explanation      |
| Written response | Reference answer and one to five distinct key points | Learner self-assessment; never presented as machine-graded |
| Mixed            | Alternating MCQ and written per exact index contract | Each question uses its own assessment behavior             |

Written response is the MVP short-answer format. True/false is deferred because it provides lower
practice value than the supported modes and was not part of the P2 launch scope.

## Verification and reliability

Every generated set passes these boundaries before it reaches the browser:

1. Strict request validation for subject, topics, difficulty, count, and mode.
2. A fixed, versioned prompt with exact per-index contracts for mixed sessions.
3. Strict JSON and Zod validation for question-specific fields and unknown properties.
4. Deterministic checks for count, type order, topic, difficulty, code language, option IDs,
   duplicate options/questions, repeated key points, and obvious hint leakage.
5. A separate all-pass semantic review for factual correctness, ambiguity, difficulty, answer and
   explanation agreement, hint leakage, relevance, and version-sensitive behavior.
6. At most one complete regenerate-and-rereview attempt. Failure remains a safe user-visible error;
   partial or unsupported questions are never published.

Provider calls are abortable, limited to 60 seconds each, non-streaming, and response-size bounded.
The API adds body limits, per-instance request and concurrency limits, request IDs, no-store
responses, origin validation, and non-sensitive problem responses.

## Practice and state behavior

- Answers persist while navigating and across a same-tab refresh using validated session storage.
- Submitted answers cannot be silently changed.
- Written answers reveal reference material and require explicit self-assessment.
- Mixed results separate objective accuracy from written self-assessment.
- Navigation, progress, hints, explanations, review, restart, and incomplete-session confirmation
  are functional at desktop and mobile widths.
- Controls use semantic elements, labels, live feedback, visible focus states, keyboard-native
  behavior, reduced-motion support, and minimum touch targets.

## Remaining limitations

- AI generation and review reduce but cannot eliminate factual errors.
- Prompt mode is used because the tested NVIDIA model rejects the mixed guided-JSON union schema;
  strict local validation remains mandatory.
- Rate limiting is in-memory and per process. Public multi-instance deployment needs edge-level
  enforcement.
- Session persistence is browser-tab local and intentionally has no account or cross-device sync.
- Generated SQL and Python are displayed as inert text and are never executed.

## Deferred beyond P4

Bookmarks, versioned local history, keyboard shortcuts, export, theme selection, and additional
question formats remain deferred. Their value and rationale are recorded in
[`ENHANCEMENTS.md`](ENHANCEMENTS.md); none is necessary for the essential launch workflow.
