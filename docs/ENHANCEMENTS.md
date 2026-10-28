# P5 enhancement decisions

Enhancements were ranked by learning value, implementation and testing cost, and whether they keep
Topicore focused on fast practice. P5 extends the existing browser-only session model and adds no
service, dependency, account, or background process.

## Implemented

| Priority | Enhancement                        | Value and scope                                                                                      |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1        | Focused revisit review             | Reviews only incorrect, skipped, unassessed, or “needs review” questions while retaining all review. |
| 2        | Session-scoped bookmarks           | Marks questions during practice and provides a bookmark-only review from the summary.                |
| 3        | Keyboard shortcuts                 | Adds 1–4 answer selection, Enter submit, arrow navigation, hint, and bookmark shortcuts.             |
| 4        | Session restore                    | Active answers, bookmarks, review scope, and position survive same-tab refreshes.                    |
| 5        | Results breakdown and review       | Separates MCQ accuracy from written self-assessment and clearly identifies revisit work.             |
| 6        | Reuse the previous setup           | Returns to a validated, prefilled generation form without persistence.                               |
| 7        | Subject-specific topic suggestions | Native, accessible suggestions speed up common input.                                                |
| 8        | Incomplete-session confirmation    | Prevents an accidental finish while preserving an intentional exit.                                  |
| 9        | Clear empty and recovery states    | Missing or invalid sessions return the user to a useful next action.                                 |

Bookmarks intentionally live only with the current tab session. Shortcuts are visible in an
expandable help section, exposed with `aria-keyshortcuts`, and ignored while the learner types or
uses a form control. Submitted answers and self-assessments are read-only during review so a
filtered review cannot silently change its own membership.

## Deferred

- Cross-session local history: useful only after repeated-use demand is established; it needs
  retention, cleanup, schema migration, and privacy behavior beyond current-session recovery.
- Export: lower value than reliable generation and review, with unresolved privacy and format needs.
- Additional question formats: true/false is easily guessed and offers less learning value than the
  supported written mode; code execution requires a separately reviewed sandbox.
- Theme selection: the current focused dark theme is complete and accessible; another theme adds
  design and test surface without improving the core workflow.

## Rejected for the current product

Accounts, social features, leaderboards, subscriptions, dashboards, and server-side tracking do not
support the fast-practice goal and would add privacy, infrastructure, and maintenance cost.
