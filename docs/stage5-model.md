# Stage 5 model and validation

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
