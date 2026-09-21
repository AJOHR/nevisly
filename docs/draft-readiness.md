# Final 10-team score accounting and turn correction

Audited production baseline: `509688bca1ba9f8ebbc4e89134d386d71d311f56`.
No model files changed between PR #10 and that baseline. Complete FreshSheets/DtZ
inputs and the live schedule snapshot are unavailable here; numerical examples
below are synthetic, not a reconstruction of the user's four-source board.

## Verified timing defect

`getNextTurn` has correct, deliberately conditional semantics:

| Empty draft slot | Current pick | On clock | Next own pick | Opponents counted |
|---|---:|---|---:|---:|
| 1 | 1 | yes | 20 | 18 after this pick |
| 3 | 1 | no | 3 | 2 before our pick |
| 5 | 1 | no | 5 | 4 before our pick |
| 10 | 1 | no | 10 | 9 before our pick |

The engine formerly passed all these counts to candidate-now planning. That
excluded our hypothetical candidate from opponent removal BEFORE we could draft
him. Only the timing adjustment varied; Player Value and Team Fit did not.

Existing 300-player fixture, no schedule, no selections:

| Candidate | Player Value | Team Fit | Immediate | Old slot 3 timing / final | Old slot 5 timing / final | Fixed off-clock final |
|---|---:|---:|---:|---:|---:|---:|
| p000 (elite forward) | 7.0463 | 0.7633 | 7.8095 | -2.8335 / 4.9760 | -2.7064 / 5.1031 | 7.8095 |
| p003 (premium D) | 9.4940 | 0.6981 | 10.1921 | -4.9481 / 5.2440 | -3.9168 / 6.2753 | 10.1921 |
| p005 (broad physical forward) | 3.6000 | 0.2456 | 3.8456 | -1.3232 / 2.5223 | -1.2783 / 2.5672 | 3.8456 |
| p099 (lesser D) | 4.4572 | 0.9311 | 5.3883 | -2.3829 / 3.0055 | -1.8893 / 3.4990 | 5.3883 |

Minimal correction: require `turn.onClock` for the two-pick adjustment. No
changes to snake geometry, survivor ordering/shortlist, allocation, utility or
coefficients. Before our turn, urgency labels still describe upcoming availability.
On clock at #3 the following pick is #18 (14 opponents); at #5 it is #16
(10 opponents). At #10/#11 and #20/#21 there are consecutive picks and zero
intervening opponents; existing zero-wait behavior remains unchanged.

## Actual score path

- Existing blending uses positive unique sources, per-field available-weight
  averages rounded to two decimals. The seven scoring fields must be available;
  missing optional metadata does not exclude a player. Source eligibility is
  combined; existing canonical draft eligibility is applied before the model.
- At 10 teams the reference target is round(250*10/12)=208 unique slots:
  C42/LW42/RW41/D83, selected by projected points with feasible eligibility.
  Actual size can be smaller when a role lacks depth. Population SDs set units.
- The market allocates 100 unique skater starters (20C/20LW/20RW/40D) by summed
  standardized production. Feasible reserve exchanges define actual replacement
  identities. Goalies/bench/IR+ are not added as fictitious skater starter demand.
  Normal draft capacity is still 10*(10+2+4)=160, excluding IR+.
- For category c, x[c]=(candidate[c]-marketReplacement[c])/SD[c]. Player Value
  V=sum U(x[c]), where U(x)=sqrt(10)*tanh(x/sqrt(10)). Position/replacement economics
  are inside these differences, not an additional positional bonus.
- Own open slots are filled with available market reserves. A candidate is
  compared through every feasible one-player exchange against that completed
  baseline. Let R be its neutral bounded roster gain, C its context adjustment,
  and S its schedule adjustment. Team Fit = (R-V)+C+S for starter upgrades.
  Therefore V+Team Fit=R+C+S; market V is replaced, not added twice.
- Empty roster confidence is 0/(0+4)=0, so C=0 exactly. Empty-roster Team Fit is
  R-V+S, not a penalty for already owning the wrong positions. The market exchange
  and the own completed-roster exchange can use different replacement identities.
  V and R are not guaranteed equal, and S can be negative. Positions affect feasible
  exchanges. The common reserve roster is candidate-independent for market starters;
  reserve candidates already in it are excluded from their own baseline.
- Unavailable full-roster comparisons fall back to V; non-upgrading bench options
  likewise use V while bench space remains. These existing limitations are explicit.
- Schedule S remains the PR #7 linear estimate: extra usable starts versus eligible
  alternatives * sum(candidate[c]/SD[c])/scheduled season games. Only Weeks24–26;
  unknown schedules are neutral. This is separate projected opportunity, not another
  replacement gain or a bounded category-win estimate. Off-night sharing matters
  under congestion. It is an approximation, not a daily lineup optimizer.
- On clock, timing T=max feasible next-pick incremental utility plus that next
  player's schedule adjustment, minus a common next-pick baseline. Opponents are
  assumed to take highest V. At most eight surviving candidates are checked.
  First pick is retained, category prior/confidence remain fixed, and PR #10's
  neutral origin is retained: U(a)+[U(a+b)-U(a)]=U(a+b).
  Schedule for the current candidate enters once; next-player schedule enters once
  in the two-player plan. That next player's full V is not added again.
- Final=V+Team Fit+T. Urgency level itself and uncertainty warnings add zero.
  Sorting uses final score, then immediate score, then ID. Available ranks exclude
  drafted players and are computed before filtering/searching.

The seven objectives remain separate, including G/A/P/PPP correlations. No D
bonus, forward penalty, archetype bonus, age penalty or source-agreement multiplier.
PR #10 bounds all replacement/roster category utility comparisons; linear rawScore
still selects the reference/market allocation, and schedule remains its explicit
linear opportunity estimate. Neither is a hidden second VOR. Allocation is not a
nonlinear global optimizer; seven-skater utility is not championship probability.

## Six representative profiles: end-to-end accounting

Reproducible synthetic input: existing `model-scenarios.cjs` players, each scoring
field scaled by .65, plus these profiles (G/A/P/PPP/SOG/HIT/BLK):
A C 46/78/124/36/335/65/52;
B C 39/91/130/52/259/70/34;
C D 21/64/85/34/226/52/132;
D D 10/45/56/26/172/172/191;
E RW 38/65/103/30/284/80/32;
F C/LW 29/36/65/20/274/218/31.
All share the fixture's metadata. No schedule supplied, so S=0; uncertainty=0.
Role-limited reference actually fills196/208 slots, market fills100/100.

| Profile | G | A | P | PPP | SOG | HIT | BLK | V |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A broad C | 2.0517 | 2.4367 | 2.3336 | 1.9510 | 2.6946 | .7469 | .8446 | 13.0591 |
| B playmaking C | 1.5355 | 2.7765 | 2.4592 | 2.8904 | 1.9521 | .8537 | .3135 | 12.7809 |
| C offensive D | 1.5310 | 2.5588 | 2.2597 | 2.3796 | 2.1703 | .6813 | 1.7287 | 13.3094 |
| D peripheral D | .4602 | 1.7426 | 1.3206 | 1.6133 | 1.3471 | 2.5138 | 2.6214 | 11.6189 |
| E scoring RW | 1.4502 | 1.8630 | 1.7404 | 1.2238 | 2.2640 | 1.0608 | .2528 | 9.8550 |
| F physical C/LW | .5727 | -.2967 | .0854 | -.3508 | 2.1482 | 2.7600 | .2223 | 5.1411 |

| Profile | Market replacement | Own replacement | Team Fit | Off-clock final | On-clock #5 timing | On-clock final |
|---|---|---|---:|---:|---:|---:|
| A | p068 | p072 | .1204 | 13.1795 | -4.8653 | 8.3142 |
| B | p068 | p072 | .1112 | 12.8921 | -4.9667 | 7.9255 |
| C | p163 | p179 | .4723 | 13.7818 | -5.0016 | 8.7802 |
| D | p163 | p179 | .5998 | 12.2187 | -4.4240 | 7.7946 |
| E | p068 | p074 | .1714 | 10.0264 | -3.3623 | 6.6641 |
| F | p068 | p105 | 1.0077 | 6.1488 | -1.9162 | 4.2326 |

On-clock state records four unknown opponent selections; no invented projections.
Category-balance adjustment is zero for each profile. The defense profiles gain
from several categories above actual D replacement; F's large SOG/HIT gains coexist
with A/PPP deficits against its stronger feasible market replacement. No global
position rule is involved. Exact live ordering/concentration cannot be inferred
from these synthetic numbers.

For the earlier supplied rounded 8-team figures only, arithmetic identifies the
Makar/McDavid reversal: 7.30-2.23+1.31=6.38 versus 7.59-1.88+.38=6.09. Team Fit
widens McDavid's immediate lead to .64; the .93 relative timing adjustment reverses
it. Those timing amounts are residuals of supplied rounded values, not a recreated
live pool. Schedule is already inside Team Fit, not an additional residual term.

## Conclusion and validation scope

Concrete defect: pre-turn horizon used for candidate-now planning. No additional
additive-accounting defect demonstrated. Preserve the existing model assumptions
and avoid tuning to the live named-player board. Negative Team Fit alone is not
proof of a bug; its components must be inspected with the real pool/schedule.

New regressions cover 10-team snake boundaries, off-clock slot invariance and
quality ordering, on-clock horizon sensitivity with invariant V/Team Fit, and
empty/one-forward/one-D/two-D/mixed/near-full states with finite additive scores and
available ranks. Existing two-D test moved from an impossible off-clock plan to
valid 10-team on-clock pick29/slot9, retaining both outcome assertions.
