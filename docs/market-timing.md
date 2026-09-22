# Yahoo market timing (PR #14 follow-up)

## Cause and scope

PR #9 removed opponents' selections in descending Nevisly VOR. Its urgency labels
used the same value ordering. A league-specific market bargain could consequently
appear falsely urgent. The live engine now supplies Yahoo average-pick order to
that same bounded two-selection planner. No raw projection, normalization,
replacement, category utility, allocation, schedule or Team Fit formula changed.

## Snapshot

`src/lib/model/yahoo-adp.json`: Yahoo Sports Fantasy Hockey Draft Analysis,
https://hockey.fantasysports.yahoo.com/hockey/draftanalysis, standard-scoring ADP.
Source date requested: 2026-09-21. Actual retrieval: 2026-09-22 UTC (September 21
in Pacific time), recorded without backdating. Season 2026, game 477. Public page
bootstrap identified `publicDraftAnalysis`, sorted by `average_pick`; the public
resource returned HTTP 200. Of 1,587 returned players, 263 had positive numeric ADP
(263 in the first 1,000, zero in the remaining 587). Dash/absent values were omitted.
No Diamond, last-seven-day, expert-rank, Dom or Category League ADP is substituted.

Unique accent/punctuation-normalized full names match across team changes. A
trailing Jr/Sr/II/III/IV is normalized; any resulting collision on either side is
UNKNOWN. No fuzzy surname or initial guessing. Drafted market players are removed
by linked projection, explicit Yahoo ID, or unique full selection name. Yahoo-listed
goalies and unprojected players consume simulated opponent picks, not skater value.
Unidentified actual selections still consume their authoritative snake ordinals;
without an identity, their market entry cannot safely be removed.

## Decision and limitations

Opponents take the first N remaining Yahoo-market entries, excluding our current
candidate. Surviving *projected* alternatives are shortlisted by Nevisly immediate
score: top two per starter role, maximum eight distinct evaluations. The unchanged
callback measures feasible incremental roster gain retaining the first pick.
The best second gain minus a common next-pick baseline is the single timing term.
No separate ADP/gone-risk bonus. Only on clock; no final-pick plan or back-to-back
adjustment. This is a deterministic scenario, not an expected-value probability
model or completed-draft optimization guarantee.

Labels use remaining Yahoo order: first N = RISKY, next N = POSSIBLE, outside 2N
= SAFE; zero opponents = SAFE for matched players. These preserve the existing
qualitative window widths, now using independent market demand. SAFE never means
guaranteed survival. Unknown ADP always displays UNKNOWN, including zero wait.
Absolute ADP appears for context, never as a value coefficient. As earlier market
entries are drafted a player's remaining order rises; merely changing a pick
counter without identifying selected players cannot supply that information.

Unmatched projections are conservatively excluded as future targets, not invented
as market-safe survivors or assigned fake ADP. They remain valid current candidates
with unchanged immediate value and can still be paired with matched future targets.
With no matched future targets the common baseline and future gain are both zero.
Partial coverage can understate future opportunity; it is not calibrated certainty.
Actual opponent choices, positional runs and changing markets can differ from ADP.

Synthetic example: pick 5, next 16, ten opponents. Early has immediate utility 8.2,
Later 8.8. Yahoo order puts Early inside the removal window and Later outside it.
Take Early: second gain 8.8; take Later: second gain 2.0. With common baseline 8.8,
scores are 8.2 and 2.0 respectively (pair totals 17.0 and 10.8). The baseline cancels
in comparison. A sufficiently better immediate/feasible pair can still justify a
reach. These numbers illustrate a synthetic scenario, not real-player forecasts.

## Refresh without changing projections

The bundled JSON is loaded synchronously, with zero ranking-path network requests.
Yahoo market timing settings accept a replacement JSON and cache it separately in
browser local storage (`nevisly.yahoo-adp.v1`). Invalid uploads retain the active
snapshot; storage failure keeps the new data for the tab and warns. Settings show
actual retrieval date and permit reverting to bundled data. Exported draft-session
files do not include this separate cache: verify the market date on another device.

For preparation outside the draft, run:

`node scripts/refresh-yahoo-adp.mjs /path/to/new-yahoo-adp.json`

Then upload the JSON in Yahoo market timing settings; recommendations recompute.
The script reads the page's game ID, retrieves public paginated data, and refuses
to overwrite an existing file or save incomplete results. Future season snapshots
require a deliberate season update; wrong-season imports are rejected. Source
metadata is asserted by the file, not cryptographically authenticated.
