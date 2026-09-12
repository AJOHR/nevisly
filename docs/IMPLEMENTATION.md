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
