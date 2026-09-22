# Stage 5 model and validation

## Position-neutral intrinsic value and goalie sidecar

Live 10-team mocks after the three-pick/schedule release still showed a specific
early-round failure: with an empty or lightly formed roster, high-end defensemen
could rank as if the eventual D40 fringe were already the relevant alternative.
The planner itself often labeled those defensemen SAFE, yet the fixed positional
premium embedded in Player Value was large enough to dominate elite forwards.

Player Value is now position-neutral. It uses the same bounded seven-category
utility against the overall league starter cutoff, not the eventual feasible
positional fringe. Feasible positional replacement is still computed and exposed,
but positional scarcity enters Team Fit progressively through the existing roster
evidence confidence:

`own known skaters / (own known skaters + own prior slots + unresolved prior slots)`.

An empty roster therefore receives zero fixed positional scarcity premium. As the
actual roster develops, feasible positional replacement matters more; once a player
does not improve any starter, the existing starter-vacancy/bench protections still
apply. Yahoo ADP and bounded three-own-pick planning continue to model market
availability separately. This removes the fixed 55/45 replacement coefficient rather
than retuning it to particular player names.

On the user's five-source 10-team blend, a local diagnostic of the new intrinsic
layer placed Makar and Bouchard in the elite mix while moving Seider, Dahlin,
Werenski and Quinn Hughes behind the top forward tier. This is a mechanism check,
not a claim that those exact ranks must survive Team Fit, playoff schedule and
on-clock Yahoo timing.

Goalies remain a separate model. One goalie CSV can be persisted with PLAYER, TEAM,
GP, W, SV% and SO. Goalie Value uses exactly W, SV% and SO with equal bounded
standardized utility. GP is not a fourth scoring category; it only informs the
projection-based role label. A clear STARTER requires a projected team lead and a
material No. 1 workload; close splits are labeled TANDEM and smaller workloads
BACKUP. The goalie tab defaults to clear starters because the configured roster
requires two goalie slots. These labels describe the uploaded projection, not an
official NHL depth chart.

## Three-pick and daily-lineup opportunity after live mock validation

Two live 10-team mocks exposed limitations that were distinct from replacement
calibration. First, current + next-pick planning could still favor a D-heavy path
because it stopped before the following own turn. Second, multi-position eligibility
was represented by feasible starter allocation but not by actual daily lineup access,
and aggregate playoff schedule comparisons could make a nine-game player look nearly
neutral when a feasible alternative offered more usable dates.

The live planner now searches current pick + the next two own selections whenever
both future turns remain. Yahoo ADP remains an availability/depletion input only.
Opponent selections are removed in market order between each snake turn, skipping
players already selected by us. The second turn keeps at most two candidates per
starter position and the third keeps one per position, bounding the search to at most
32 second/third paths per current candidate. Sequential category-fit evaluation keeps
both earlier selections and the original neutral utility origin. Near the end of the
draft the established two-pick planner remains the fallback.

The NHL schedule payload now retains exact game dates for Yahoo Weeks 24-26.
Schedule opportunity compares projected 14-skater rosters (10 starters + four bench
slots) before and after a candidate. On each real playoff date a maximum-weight
C2/LW2/RW2/D4 lineup is allocated. Multi-position eligibility therefore has no flat
bonus: it helps only when it lets the projected roster avoid a real busy-night
benching conflict or field a stronger daily lineup.

Schedule value is centered on the league-average playoff game count. A player's
per-scheduled-game expected category production is derived from season projections
divided by NHL team games, not projected GP, preserving the existing availability
interpretation. The candidate's schedule adjustment is the change in centered daily
lineup opportunity between the feasible before/after projected rosters. Thus a
nine-game player is penalized versus an otherwise comparable 10/11-game alternative,
while favorable dates or multi-position access can offset part of that penalty.
Older schedule payloads without exact dates keep aggregate game-volume economics but
receive no invented daily-flexibility benefit.

This does not add a generic position-count score, D penalty, round rule, player-name
exception, consensus-rank bonus, or Yahoo ADP score bonus. Season-long bench
deployment remains outside the model; the new exact lineup-access term is specifically
for the configured Yahoo playoff weeks.

## Replacement-scarcity calibration after live 10-team validation

A live 10-team mock exposed a second defense-heavy failure mode after the bench-only
starter-vacancy fix. With Cale Makar already rostered at pick 16, the model assigned
roughly 7.8 Player Value to a high-end defenseman versus roughly 4.4 to an elite
center. The raw seven-category production was not the cause: the large gap came from
comparing the defenseman almost entirely with the eventual D40 fringe while the
center faced a much stronger forward replacement. The bounded two-pick planner
reduced that gap but could still prefer two defensemen because both current and next
starter gains inherited the same deep positional baseline.

This release restores the historical replacement calibration that existed before
Stage 5: 55% feasible positional replacement plus 45% position-neutral league
replacement. The 55/45 split is not a new live-data fit; it is the prior Nevisly
safeguard that specifically prevented a weak D40/D48 baseline from overwhelming
elite forward value. Stage 5's unique feasible allocation and bounded category
utility remain in place.

The position-neutral side uses the league-wide starter cutoff in raw standardized
score. Because a single fringe player's category shape would inject an arbitrary
archetype into every comparison, that scalar cutoff is represented as an equal-
category neutral profile. Player Value blends bounded per-category utility from the
actual feasible replacement with bounded utility from that neutral profile.
Current-roster neutral gain uses the same blend; contextual category saturation
continues to use the real feasible roster exchange. Therefore the displayed Player
Value and the recommendation score use the same scarcity calibration.

This is position symmetric: relabeling the complete C/LW/RW/D economy leaves values
unchanged. Real positional scarcity is retained at 55%; it is not a defense penalty,
round rule, named-player exception, or Yahoo ADP bonus. Yahoo ADP remains an
availability input only. The two-pick planner, category weights, projections, and
schedule formulas are otherwise unchanged.

## Category-economics correction (after PR9)

Before: intrinsic Player Value was `sum((player[c] − feasibleReplacement[c]) / SD[c])`.
Reference means cancel. Position enters through the single feasible replacement;
there is no separate position/normalization bonus. For starter recommendations,
Team Fit subtracts that VOR and substitutes the feasible own-roster gain. PR9
then adds a separate two-pick adjustment. Intrinsic VOR is not counted twice,
though it also determines the explicitly assumed opponent selection order.

Verified defect: linear standardized differences are unbounded. An out-of-reference
synthetic player with 1,000 BLK against a nearly constant 30-BLK population had
roughly 1.98 million linear value points. Roster-proportional sampling fixes role
composition, but cannot guarantee a non-narrow category distribution. Empty-roster
category fit previously retained the same unbounded linear term. This does not
establish that the user's actual four-source BLK/HIT distributions are pathological.

Correction: use the existing Stage5 utility `U(x) = w * tanh(x/w)`, with the existing
`w = sqrt(10)`, for each neutral replacement gain. Player Value is now
`sum(U((player[c] − replacement[c])/SD[c]))`. Each category has the same slope of
one at zero and limit ±w. No category-specific coefficient, position multiplier,
or new tuning constant is introduced. Values remain utility units, not category
win counts or calibrated probabilities. The reference population, SDs, raw-score
allocation, selected replacements, categories, and league-size inputs are unchanged.
Allocation remains a standardized-production allocation; it is not a global nonlinear
matchup optimizer. A zero reference SD retains the existing zero-contribution policy.

The neutral own-roster gain uses the same bounded function. Existing category fit
still blends neutral and roster-context utility with unchanged evidence confidence;
it is not an increased positional penalty. Raw production deltas remain visible,
alongside neutral utility and fit adjustments. For PR9's second selection the neutral
origin stays at the first comparison's starting roster: `U(a+b) − U(a)` rather than
`U(b)`. Thus both neutral and context gains telescope across the two selections.
No PR9 shortlist, opponent order rule, snake logic, or fallback was redesigned.

Reproducible 8-team diagnostics (`tests/category-economics.test.cjs`): synthetic
market from the existing 300-player fixture scaled to 65% production, plus profiles
A (multi-category C/LW) and B (two-way D). The same actual replacements are retained.

| Category | A old | A corrected | B old | B corrected |
| --- | ---: | ---: | ---: | ---: |
| G | 0.474 | 0.470 | 0.440 | 0.437 |
| A | -0.496 | -0.492 | 2.156 | 1.874 |
| P | -0.046 | -0.046 | 1.452 | 1.358 |
| PPP | -0.574 | -0.568 | 1.922 | 1.716 |
| SOG | 2.785 | 2.235 | 1.511 | 1.406 |
| HIT | 4.048 | 2.708 | 1.626 | 1.497 |
| BLK | 0.192 | 0.191 | 3.637 | 2.586 |
| Total | 6.383 | 4.500 | 12.744 | 10.873 |

The defense-type profile retains its lead: it beats its replacement across all seven
categories, while A's gains concentrate in SOG/HIT and it trails its stronger offensive
replacement in A/P/PPP. BLK and HIT contribute on both sides; neither is specially
discounted. The exact reported 8.52/3.88 live values cannot be reconstructed from two
players alone: the complete blend/reference/replacement pool is required. This fixture
explains the mechanism, not an asserted reproduction of that missing state.

Injury/status, import, Yahoo/extension, schedule formula, goalies, and uncertainty
behavior are unchanged. Eight-team economics derive from the existing team-count
input; the same formula is tested at ten and twelve teams. The remainder of this
document records earlier releases and their historical formulas.

## Next-pick opportunity correction (after PRs 7–8)

The prior production engine ranked only Player Value + Team Fit. Its urgency
label used VOR rank and snake distance, but neither future availability nor a
cross-position two-pick comparison affected ordering. This verifies a missing
mechanism, not that every defense-heavy board is wrong. The supplied ranking
anecdote alone cannot establish the optimal pick without its full pool/state.

Immediate value, PR7 normalization/schedule and PR8 league-size economics remain
unchanged. Recommendation now adds an explicit Draft Urgency adjustment:
`marginal next-pick upgrade after this selection − common next-pick baseline`.
Consequently ordering compares immediate utility plus a complementary future
upgrade, with the same baseline subtracted for all starter candidates. Deep
replacement VOR is not added again. Player Value, current Team Fit and uncertainty
are unchanged by turn distance. Equal totals prefer immediate utility, then ID.

Assumptions and bounds:

- Opponents remove the highest available intrinsic VOR players before our next
  snake turn, excluding the player selected now. This is a deterministic scenario,
  not ADP, a survival probability, or a prediction of actual opponents.
- Precompute the two best surviving immediate options per eligible starter
  position (at most eight identities). Evaluate each through the existing feasible
  one-player exchange, retaining the current selection. Two D picks remain legal.
  Multi-position identities cannot occupy two slots. No draft tree is searched.
- Both marginal category utilities use the same opponent target and current
  confidence. The second upgrade is measured after the first, preventing repeated
  use of the same roster improvement. Schedule estimates remain fixed within this
  short horizon; only a second starter upgrade receives its own schedule term.
- The common baseline is the best nonnegative immediate starter opportunity
  after the opponent cutoff, before removing our current choice. Bench timing,
  goalie timing and unfillable starter comparisons retain their existing fallback.
  Back-to-back selections and the final draft turn keep immediate ordering.
- This is deliberately a two-selection approximation. Shortlisting can miss a
  specialist, actual opponents may draft differently, and later-round balance is
  not optimized. No rule limits early defense selections or favors forwards.

Timing is shown in the decision panel, contribution breakdown and legend. Applied
timing explanations identify the modeled next-pick alternative. Existing overall
Player Pool ranks reuse the resulting order before filtering/search.

## Post-release calibration: roster reference and schedule opportunity

The sections below record the original Stage 5 release. This correction changes only its normalization reference, schedule term, relevant explanations, and Player Pool rank display. Intrinsic Player Value is now VOR alone; the schedule term belongs to Team Fit. Recommendation = VOR + (feasible roster gain − VOR) + category fit + schedule opportunity, with the existing depth/insufficient-roster fallback. The cancellation proves replacement is not rewarded twice; a synthetic test shifts VOR by 100 and requires unchanged starter recommendations.

The verified calibration defect is reference selection, not an extra D bonus: a top-250-by-points cutoff chooses the population used to scale *every* category. In the supplied Dom and Category League copies only 44/250 and 41/250 reference players were D, versus four of ten required skater slots. A synthetic low-point/high-block role demonstrates arbitrarily exaggerated BLK z-scores when the points cutoff excludes that role. The new reference retains a maximum size of 250 but fills roster-proportional slots (50 C, 50 LW, 50 RW, 100 D) with unique identities, using projected points within feasible allocation. Shallow pools use only feasible slots. No role coefficient, named-player target, archetype bonus, ADP or source ranking is introduced. This establishes a mechanism; it does not reproduce or attribute every ranking in the unavailable four-source blend to that mechanism.

Schedule uses only weekly rows 24–26, March 15–April 4, 2027. Additional expected usable starts relative to other available eligible players multiply `sum(projected category / reference SD) / scheduled season games`. Projected season totals already reflect expected availability; dividing by projected GP would incorrectly undo that adjustment. With no slot congestion every scheduled game has equal opportunity. With congestion, busy-night capacity is shared across owned players confined to the candidate's eligible slots plus the candidate; off nights are assumed usable. This is a transparent, conservative capacity approximation, not an exact daily lineup optimizer. There is no flat game bonus, seasonal off-night bonus, balance bonus, or second schedule adjustment. Unknown/partial schedules or no comparable alternatives contribute zero. Supplemental opportunity changes Team Fit, never intrinsic Player Value or Draft Urgency. Schedule explanations appear only for a non-negligible applied adjustment (at least 0.01 score units).

Existing feasible exchanges continue to produce multi-position value only when useful. Position-count-only explanation text was removed. Overall available-player ranks are computed once from canonical recommendation order before search, filtering or table sorting; drafted rows display a dash. Allocation stops after filling its maximum-weight basis, avoiding unsuccessful attempts for every lower-ranked player. No Yahoo, extension, import, goalie strategy or draft-state behavior is changed.

Calibration validation: 125 app tests passed (including nine new targeted tests), TypeScript passed, lint passed, and the final diff check passed. The production build could not fetch the existing Geist/Geist Mono Google Fonts in this execution environment; release remains blocked pending a successful production build. No browser acceptance, PR, merge, or production deployment is claimed for this correction. The concurrent 600-player benchmark reported 3,651 ms market preparation and 84 ms cached recommendation ranking; these are runner measurements, not browser latency guarantees.

Production baseline: `8fdf8413f94d23efa51382ec2a58ceae4809351d`.

## Migration and intended effects

1. The original engine was extracted without intentional semantic changes. Five independent tests execute frozen pre-extraction production functions and compare every player output at 0, 12, 30, 60 and 100 selections. Contribution sums reproduce the original score. The frozen oracle is never regenerated from the new model.
2. Replacement now uses one maximum-weight eligibility allocation across league starter slots. A multi-position identity fills one slot. A replacement must support a feasible augmenting-path exchange, not be counted in several positional pools. Premium defensemen can rise when 48 distinct D slots must be filled in a 12-team league. Flexibility earns value through feasible allocation, not a flat bonus.
3. Team Fit compares complete, feasible projected starter rosters before and after a selection, using available reserve players for open slots. All feasible one-player exchanges are evaluated; a lower-raw specialist can be useful when improving a close category costs production in a category already far ahead. Keeping the lineup is also an option. Full pools with insufficient positional depth fall back to intrinsic VOR with an explicit warning.
4. Independent category-need and per-drafted-skater H2H multipliers no longer stack. Category utility is `width * tanh(margin / width)` in normalized production units. Incremental utility is blended with linear production by roster evidence. It is not a probability model and has not been calibrated against real matchup outcomes.
5. Every applied term is visible: replacement value + schedule + roster opportunity + category fit. Player Value = replacement value + schedule; Team Fit = roster opportunity + category fit. Draft Urgency and Uncertainty do not add to those scores.

## Explicit assumptions retained or introduced

Retained league: C2/LW2/RW2/D4/G2 and four shared bench slots. G/A/P/PPP/SOG/HIT/BLK remain separate equally weighted categories; goals and assists still also contribute to points because all three score independently in this league. Top 250 projected points define normalization. Existing schedule formula and weeks 24–26 are preserved, not reinterpreted as a confirmed Yahoo league setting.

New configurable assumptions live in `src/lib/model/config.ts`: category width sqrt(10), opponent prior strength 10 starter slots, own-roster prior strength four known skaters, and two additional prior slots per unresolved own selection. Opponent incomplete starters are filled by positional market means, then shrunk toward the league prior. These forecast assumptions are distinct from observed canonical selections. Bench deployment and goalie production are unmodeled. Bench options use intrinsic value while space remains, with an explicit warning. A full configured roster suppresses new recommendation draft actions; manual history tools remain available.

Player metadata is not a scoring prerequisite. Missing scoring categories remain unavailable, never imputed to zero. Real zeros remain valid. Unknown and goalie selections remain real canonical draft ordinals and affect ownership/turns; unresolved skater production reduces confidence. Draft Urgency uses available VOR rank against the number of opponent selections before the next turn. It is a heuristic, not ADP-based calibration.

## Controlled heuristic evaluation

Run `node scripts/model-report.cjs` for production → allocation → incremental fit → consolidated comparisons at 0/24/60/100 picks on the deterministic 300-player fixture. The report also removes one old term at a time from the fit stage. No licensed projection files are checked in.

| Old term | Intended behavior | Observed first-pick top-10 positions changed on removal | Replacement behavior |
| --- | --- | ---: | --- |
| Breadth | Prefer broad foundations | 10 | Actual seven-category production plus marginal category utility; no extra count-of-strengths award |
| Power-forward | Preserve offense and hits | 10 | Offense and hits already contribute to production and feasible roster comparison |
| Age | Flag age risk | 5 | Explicit uncertainty note, avoiding a second penalty on age-aware projections |
| Round strategy | Early foundation / D timing | 10 | Eligibility-aware market depth and roster opportunity; no fixed round preference |
| Scarcity | Avoid depleted positions | 0 | Actual feasible replacement depth; urgency is separate |
| Tier cliff | Avoid losing a valuable tier | 0 (7–8 in later fixtures) | Value rank and pick distance shown as urgency; no duplicate numeric scarcity reward |
| Flexibility | Reward lineup access | 2 | One-player allocation and feasible exchanges |

Removal changes behavior deliberately: a broad player no longer receives an independent categorical bonus merely for clearing thresholds; age alone does not move a ranking; tier/round labels do not add production. Synthetic specialist and balanced-player cases test both the retained category utility and these changes. This is a utility model, not evidence that one strategy maximizes championship odds.

## Real-file sanity check

Both user-supplied sources were parsed and blended separately at 100%: Dom 606 eligible skaters and skaters_cat_league 578 eligible skaters in the current attached copies. This count differs from the earlier reported 721-row source; the Stage 4 compatibility fixtures remain in the full suite.

With empty rosters and no schedule data, the Dom top three change from McDavid/MacKinnon/Kucherov to McDavid/MacKinnon/Makar; Makar was previously #14. The other source changes from MacKinnon/McDavid/Celebrini to MacKinnon/McDavid/Bouchard. These premium-D shifts are expected under unique allocation and four D slots; they are substantial and explicitly recorded. No ranking equivalence is claimed after semantic changes. Filled-position and specialist tests prevent treating that empty-roster preference as universal.

## Performance and architecture

Projection normalization and market allocation are memoized by projection pool / league size. Category targets and urgency order are prepared once per draft state. Reserve baselines are recalculated only if the candidate actually occupies the baseline lineup. The redundant first-pass heuristic ranking and seven per-card category sorts were removed. The engine consumes canonical identity, ownership and selection ordinals; it never imports DOM captures or extension transport structures. Adapter-equivalence tests vary transport metadata while requiring identical recommendations.

Representative 600-player timings are printed by `stage5-performance.test.cjs`; absolute results depend on runner load. Earlier optimized rank evaluation was 18 ms versus 401 ms for the old calculation; the later specialist exchange check adds bounded work (at most ten exchanges per candidate). Market preparation is separate and occurs only when projections/settings change. A generous five-second test guard catches accidental unbounded per-pick work; it is not a browser performance guarantee.

## Coverage and release gates

Baseline parity; brute-force allocation optimality; premium D/elite F; multi-position feasibility; balanced/specialists; empty/uneven/full positions; missing vs zero; unknown and goalie selections; stable ties; input order; finite scores; canonical adapter equivalence; cached/uncached output equivalence; before/after and term ablations; performance; decision-panel rendering and full-roster action suppression. All prior projection, persistence, draft and receiver tests remain enabled. Firefox adapter code is unchanged and its separate tests are run.

Required commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; extension `npm test` and `npm run lint`. The read-only `/api/version` endpoint exposes only Vercel's commit SHA and model version for production verification. Browser verification must distinguish rendered UI testing from real Yahoo/Firefox acceptance, which this stage does not claim to complete.

Final release validation: TypeScript, lint, 116 app tests, production build and 21 extension tests passed. The final 600-player run measured market preparation 2,224 ms, cached ranking 89 ms and legacy ranking 612 ms under concurrent test load. Early-roster tests require zero category-saturation adjustment when empty and at most 20% of each production delta with one known skater. Additional release tests verify urgency cannot change intrinsic value/order, uncertainty metadata cannot add a hidden penalty, and an elite forward beats the mediocre-D fixture despite four required D slots.
