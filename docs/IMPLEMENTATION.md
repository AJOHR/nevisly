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

## Stage 3

- Replaced both event handlers with a tested, runtime-validated Yahoo reconciliation boundary using current session state.
- Legacy events merge without deleting picks. Versioned snapshots carry a draft-session ID, monotonic sequence and completeness declaration; stale snapshots/events cannot roll back newer state. Rollbacks require an explicit newer correction.
- Unknown, ambiguous and goalie selections retain Yahoo identity, ownership and pick numbers. Exact names precede unique initial matches; ambiguous matches require manual resolution, which survives subsequent snapshots.
- Added sync health, reconciliation requests and persisted sequence barriers. Gone Risk displays heuristic bands; H2H comparison rates are explicitly uncalibrated.
- Documented the bridge contract in YAHOO_BRIDGE.md. The extension is outside this repository and was not modified or end-to-end tested.

Validation: six regression cases failed before fixes; all 28 tests, TypeScript, ESLint and production build passed afterward.

Assumptions: versioned sequence numbers persist for the lifetime of a Yahoo draft. Legacy events cannot prove completeness. The 30-second stale indicator reflects event recency, not proof that Yahoo changed. Explicit normalized fantasy-team IDs override snake inference.

### Stage 3 identity follow-up

Final review found that one Yahoo player ID could appear under a changed name at a different pick. A regression reproduced it; incremental and snapshot validation now compare Yahoo IDs as well as resolved projection IDs. This follow-up is committed separately.

## Stage 4

Eight correctness regressions failed before changes: absent values versus zero, invalid numbers, duplicate weighting, conflicting identities, duplicate CSV rows, per-field blending, incomplete score inputs and malformed CSV structure. They now pass.

- CSV imports reject malformed rows, invalid/negative numbers, missing names/positions and duplicate identities atomically, with actionable errors; the previous source remains intact.
- Missing numeric values carry explicit `missingFields` metadata. Their numeric placeholders are excluded from every blend. A legitimate zero participates normally.
- Weights renormalize separately per available field. Partial source records remain saved; the recommendation pool requires age, GP and all seven categories supplied across active sources. This prevents missing age from masquerading as youth or missing categories as zero production.
- Defensive blending counts identical legacy rows once and excludes conflicting identities within a provider. Diagnostics count distinct rows, expose conflicts/missing fields and flag NHL-team disagreements across providers.
- Agreement remains the existing point-spread heuristic, using providers with points present; the UI correctly names its statistic standard deviation. No scoring coefficients or agreement thresholds were retuned.
- Saved sessions validate missing-field metadata and unique source IDs.

Validation: final 43 tests, TypeScript, ESLint and production build passed. Each earlier stage also passed these gates independently. Additional tests cover zero GP, negative input, absent-provider normalization, metadata reload, duplicate source IDs and diagnostics.

Assumptions/limits: all existing numeric score inputs are required before ranking, including age and GP. Correct duplicate rows in the CSV before uploading. Names remain provisional cross-provider identities; team disagreement may represent a trade and is flagged for review. Older imports cannot reveal which zeroes originally came from blanks; re-upload those files. No live Firefox/Yahoo end-to-end test was possible from this repository. Stage 5 decomposition, scenario comparisons and coefficient recommendations have not begun.

## Yahoo receiver follow-up — extension evidence gate

Implemented receiver fixes before extension work: stable local selectionId separate from projectionId; metadata-free ordinal records; collision-safe projection linkage; conservative legacy enrichment; equal-revision fingerprint checking and snapshot preservation; final represented-slot checks. Projection uploads relink Yahoo selections without requiring another event. Local persistence validates replay evidence and migrates old selection identities. Manual correction retains selection identity and later authoritative numbers.

The UI separates recent message receipt, extraction/coverage status and projection matching. Legacy/v1 cannot establish independently verified coverage and no longer reports LIVE. Source ownership inference is explicitly labeled in the domain record. The compatibility playerId view key remains for existing recommendation consumers; no scoring terms changed.

Validation: nine new regression cases failed before their fixes, plus a projection-refresh regression before its implementation. All 58 tests (43 existing + 15 new), TypeScript, ESLint and production build passed. Deterministic replay covers all 24 orderings of four observations, duplicating each delivery and reloading persisted state between deliveries. Added checks also cover manual correction, Yahoo owner retention, projection removal/restoration and corrupted replay evidence.

Not complete: v2 runtime, extension changes, ready/ACK/replay/request routing, verified sender/session binding, DOM extraction, independently verified complete coverage, extension fixtures, and actual Firefox end-to-end tests. YAHOO_BRIDGE_V2_DRAFT.md is a versioned design document, not an activated protocol. YAHOO_CAPTURE_REQUEST.md specifies the actual evidence needed. Stop at this evidence gate as requested; Stage 5 remains paused.

## Yahoo v2 from the supplied DOM fixture

Implemented the captured history extractor in a separate Firefox source tree/archive, v2 receiver and explicit connection UI, source/destination isolation, browser-document validation, persistent capture replay, readiness/ACK/request routing, partial versus header-cross-checked coverage, owner-label mapping and Yahoo eligibility. No Stage 5 coefficient changes. No Yahoo owner key, server revision or reset identity is fabricated. See YAHOO_CAPTURE_EVIDENCE.md for verified evidence versus live-verification limits.

Validation: TypeScript, ESLint, all 75 Nevisly tests and production build passed. Seventeen separate extension fixture/transport tests passed with JavaScript syntax validation. The integration tests execute the real extractor, Yahoo content script, background relay, destination content script and actual Nevisly reducer under a mocked browser; they do not claim actual Firefox execution. A synthetic 192-pick replay covers unknowns, goalies, snake rounds, repeated delivery, stale observations and persistence. The original capture is not committed; the retained fixture removes private owner labels and scripts/resources.

Manual acceptance remains: load v2 in Firefox with the matching Nevisly branch; verify documentId availability, live roster/owner mapping, history updates across rounds, refresh/reload, manual fallback, correction review, and final draft screen. One captured layout does not establish support for other Yahoo rooms/layouts or reset lifecycle. Stage 5 remains paused.
