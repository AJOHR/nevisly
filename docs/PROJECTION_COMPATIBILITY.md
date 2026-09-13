# Stage 4 projection compatibility correction

## Reproduced from complete supplied files

- Dom 26-27.csv: 670 data records, 606 skaters and 64 goalies. Rejected by Stage 4's blanket duplicate-header check. Its 45-column layout includes blank spacer headings and separate skater/goalie GP columns. These are not duplicate player records.
- skaters_cat_league.csv: the attached file has 578 records (not the 721 reported from an earlier upload). All 578 parse, all have only age missing, all were excluded by the all-fields blend gate. Every scoring category is supplied. The loaded-row indicator counts saved parser output; the recommendation gate counts eligible blended output. Its generic upload/weight message concealed the real failure.
- A synthetic 721-row file using the second format now provides a separate regression for the reported scale. This is not represented as the original 721-player dataset.

## Pre-Stage-4 comparison and consumer audit

The prior parser used zero fallbacks for unavailable numbers and did not impose an all-fields completeness gate; Stage 4 retained the existing numeric aliases and introduced missingFields, strict duplicate-heading rejection and an all-nine-fields rankability gate. Age absence therefore became a new fatal compatibility condition even though age only drives an optional modifier and display. GP is not consumed by the current season-total scoring code. The seven season-total categories G/A/P/PPP/SOG/HIT/BLK remain required across active sources. Missing categories do not become zero.

The Site Pos priority and nickname normalization were existing gaps exposed by these supplied formats, not removed Stage 4 aliases. Headers now match aliases without case/space/hyphen differences. Explicit Site Pos is preferred to generic Pos=F; names like Oilers, Blue Jackets and Knights normalize consistently for schedules and Yahoo matching. No alias is guessed from unrelated provider metrics such as VAR or FP. Unused ADP/VAR/salary/goalie columns are not validation requirements.

## Behavior after correction

- Read positional CSV cells so duplicate/spacer headers cannot overwrite values. Only consumed fields are compared. Repeated/aliased numeric fields can have one populated value or equal values; contradictory populated values fail explicitly. Malformed row widths, invalid scoring numbers and duplicate/conflicting player identities remain rejected atomically, preserving the prior uploaded source.
- Blank, absent and explicit unavailable markers (N/A, NA, null, undefined, unavailable, not available, dash/en dash/em dash) retain missingFields. Literal zero, fractional and non-negative values remain supplied values. Arbitrary invalid numeric text remains an actionable error.
- Age/GP absence produces an aggregated optional-data warning, not exclusion. Missing age displays a dash and omits the age adjustment. The existing age thresholds and coefficients are preserved for known ages; this is an input-availability correction, not Stage 5 retuning.
- Unknown metadata placeholders remain accompanied by missingFields through blending/persistence. An available age from another source is not diluted by missing ages.
- One valid source at 100% works: Dom produces 606 ranked skaters; the category file produces 578 with one aggregated optional-age warning. Goalies remain supported as real draft selections separately from skater projections.
- UI labels distinguish skater rows parsed from rankable players. Start messaging distinguishes no upload, nonpositive weights and unusable scoring/identity data. Manual drafting and the Yahoo bridge remain independent of ranking availability.

Regression fixtures retain the exact two header layouts with a small set of representative rows and anonymized player names. Full original projection exports are not committed to the public repository. Tests cover both layouts, 721 rows, single-source ranking, Site Pos, nickname aliases, repeated GP/spacers, conflicting consumed columns, unavailable versus zero values, persistence, optional-age blending, unchanged known-age adjustment and the Start eligibility messages. Stage 1–4 and receiver replay tests remain included.

The Firefox v0.2.2 production extension requires no change. Re-upload the original CSV after deployment to refresh imported Site Pos and team normalization; already-saved missing-age records become rankable with this release. Old imports that silently converted blanks to zero before Stage 4 still require re-upload, because original availability cannot be reconstructed.

Validation completed: TypeScript, ESLint, all 86 tests (75 existing plus 11 compatibility tests), and production build passed. Both full uploaded files were run through the parser, diagnostics and single-source blend locally with the counts above. Eight initial regression checks failed before the fixes; three additional checks cover 721-row scaling, persisted metadata and duplicate unused columns. No scoring coefficients or Stage 5 terms were retuned.
