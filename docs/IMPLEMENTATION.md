# Approved reliability work

Scope: stages 1–4 only. Stage 5 is paused. Existing age, breadth, power-forward, strategy and other player-value coefficients are preserved.

## Stage 1

Four regression tests failed before fixes and passed afterward. The snake test exercises all slots in 8/10/12/14/16-team leagues across four rounds (3,040 configurations).

- Added one draft-position selector and pure mutation reducer.
- Current pick is maximum represented pick plus one, never array length.
- Removing/correcting an earlier pick preserves later pick numbers and owners.
- Risk counts opponent selections, including the current opponent when off clock. Consecutive own picks have zero risk.
- Fixed baseline JSX lint error and clarified memo dependencies without changing score coefficients.

Validation: TypeScript, ESLint, regression tests and production build passed.

Assumptions: standard snake order; when currently on the clock, urgency describes the following own selection. Gaps in observed history do not justify renumbering. An explicit undo of the highest selection may move progress back; incidental events may not.

## Stage 2

- Browser-local, versioned session store restores projections, settings and every selection after refresh. No service/database.
- Projection edits preserve picks; provisional projection IDs no longer depend on row order or number of sources.
- Manual goalie/unprojected records, history, correction by pick number, export and explicit new-draft action work outside the projection-dependent view.
- All selections retain ownership/progress. Changing the user's slot no longer resets history; changing league size with existing history is blocked.
- Corrupt saved data is not overwritten implicitly. Storage failure permits in-memory manual work with a visible warning. Stale-tab writes are rejected; use one active drafting tab.
- Added separate domain dimensions for player value, team fit, urgency and uncertainty; did not alter score terms.

Validation: 12 tests, TypeScript, lint and production build passed. The reset/identity regressions failed before their fixes. Additional persistence tests cover reload, corruption, quota failure, unavailable storage and stale tabs.

Assumptions: name-based projection identity is provisional; ambiguous identities must remain unresolved, not silently merged. Browser storage is device/browser-local, not cloud backup. Simultaneous multi-tab editing is not supported.
