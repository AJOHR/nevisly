# Nevisly Project Notes

## Project

Nevisly is a Yahoo Fantasy Hockey draft assistant built to maximize the probability of winning a Head-to-Head Categories league championship.

Primary objective:

> Maximize probability of finishing first overall after the fantasy playoffs.

Nevisly should not simply maximize raw projected fantasy value or regular-season totals.

Current production URL:

https://nevisly.vercel.app

GitHub:

https://github.com/AJOHR/nevisly

Stack:

- Next.js
- TypeScript
- Tailwind CSS
- Vercel
- GitHub
- Papa Parse
- Yahoo OAuth 2.0
- NHL public schedule API

---

## Development Workflow

Development happens in Cursor.

Normal workflow:

Cursor  
→ make changes  
→ git add .  
→ git commit  
→ git push  
→ GitHub  
→ Vercel auto deployment  
→ test production

Production:

https://nevisly.vercel.app

Localhost testing is not normally required.

For large files such as:

src/components/ProjectionUpload.tsx

prefer full-file replacements rather than small patch snippets when making major changes.

---

# Championship Objective

Nevisly's North Star is:

> Build the fantasy roster with the highest probability of winning the H2H playoffs and league championship.

The model should eventually combine:

- player quality
- positional replacement value
- positional scarcity
- H2H category balance
- current roster needs
- opponent roster construction
- draft-room behavior
- return-to-next-pick probability
- positional flexibility
- season schedule quality
- season off-night games
- playoff schedule quality
- playoff off-night games
- age / durability risk
- injury risk
- goalie strategy
- future Yahoo live draft synchronization

The UI should expose one primary Nevisly score while keeping most complexity internal.

---

# League Settings

Scoring format:

Head-to-Head Categories

This is NOT a roto league.

Expected league size:

12 teams

Yahoo may show a higher maximum-team limit, but the actual league has historically been 12 teams.

Current roster:

- C
- C
- LW
- LW
- RW
- RW
- D
- D
- D
- D
- G
- G
- BN
- BN
- BN
- BN
- IR+
- IR+

Skater starter counts:

- C: 2
- LW: 2
- RW: 2
- D: 4

Skater scoring categories:

- Goals (G)
- Assists (A)
- Points (P)
- Powerplay Points (PPP)
- Shots on Goal (SOG)
- Hits (HIT)
- Blocks (BLK)

Goalie scoring categories:

- Wins (W)
- Save Percentage (SV%)
- Shutouts (SHO)

Minimum goalie appearances:

3 per fantasy team per week

Lineup changes:

Daily - Today

Draft:

Live Standard Draft

Pick timer:

90 seconds

---

# Yahoo Fantasy Week Calendar

Yahoo has published the official 2026-27 fantasy week calendar.

Nevisly's league intentionally forgoes Yahoo Week 27.

Fantasy playoff weeks used by Nevisly:

Week 24:  
March 15-21, 2027

Week 25:  
March 22-28, 2027

Week 26:  
March 29-April 4, 2027

Ignored:

Week 27:  
April 5-10, 2027

Therefore Nevisly's championship playoff schedule window is:

March 15, 2027  
through  
April 4, 2027

Week 27 must NOT contribute to playoff schedule value.

---

# Yahoo OAuth / API

Yahoo OAuth works end-to-end.

Working:

- Yahoo authorization redirect
- OAuth callback
- authorization code exchange
- access token received
- refresh token received on initial authorization
- secure HTTP-only token storage

Routes:

src/app/api/auth/yahoo/route.ts

src/app/api/auth/yahoo/callback/route.ts

src/app/api/yahoo/leagues/route.ts

Current Yahoo Fantasy Sports API response:

403

"This application is not authorized to perform this action."

A Yahoo Fantasy Sports API access application has been submitted and is awaiting approval.

Do not delete or regenerate the current Yahoo app credentials while waiting.

Yahoo integration must remain isolated from the core ranking engine.

Nevisly must continue to function using manual draft entry even if Yahoo access is unavailable.

Yahoo should be treated as a DraftDataSource, not as the draft engine itself.

---

# DraftDataSource Architecture

Desired architecture:

DraftDataSource  
├── Manual Draft  
├── Yahoo API  
└── Future Fantasy Platforms

Every source should eventually produce the same normalized draft event.

Concept:

Yahoo draft result  
or  
Manual draft click  
↓  
DraftPick  
↓  
Shared Draft State  
↓  
League Rosters  
↓  
H2H / Needs / Scarcity / Return Risk  
↓  
Nevisly Recommendations

---

# Projection Importer

CSV projection import is implemented.

Current test projection source:

DtZ NHL Fantasy Projections

Current test file loads approximately:

757 players

Current importer reads:

- Player
- Age
- Pos
- Team
- GP
- Goals
- Assists
- Points
- PP Points
- SOG
- Hits
- BLK

Normalized player structure:

```ts
type SkaterProjection = {
  id: string;
  name: string;
  age: number;
  team: string;
  positions: string[];

  gp: number;
  goals: number;
  assists: number;
  points: number;
  ppp: number;
  sog: number;
  hits: number;
  blocks: number;
};
```

Positions are split on commas/slashes where necessary.

Current generated ID concept:

Player-Team-index

Do not use the projection provider's supplied ranking or VOR as Nevisly's ranking.

---

# Base Ranking Model

Current skater categories:

- G
- A
- P
- PPP
- SOG
- HIT
- BLK

Current Z-score reference pool:

Top 250 skaters by projected points.

For each category:

Z =  
(player stat - category mean)  
/  
category standard deviation

Raw Category Score:

Raw Score =  
G Z  
+ A Z  
+ P Z  
+ PPP Z  
+ SOG Z  
+ HIT Z  
+ BLK Z

The top-250 reference pool is temporary.

Eventually the fantasy-relevant comparison population may be derived dynamically from:

- league size
- roster size
- starter requirements
- replacement level

---

# Heatmap

Heatmap is implemented for:

- G
- A
- P
- PPP
- SOG
- HIT
- BLK

Current approximate thresholds:

Z >= 2  
dark green

Z >= 1  
strong green

Z >= 0.35  
light green

Z between approximately -0.35 and +0.35  
neutral

Below average values become progressively red.

Hovering a heatmap cell shows the exact Z-score.

---

# Positional VOR

Positional replacement value is implemented.

Replacement level:

League Teams × Starter Slots

Example for a 12-team league:

C:  
24th C

LW:  
24th LW

RW:  
24th RW

D:  
48th D

Current VOR:

VOR =  
Raw Category Score  
-  
Replacement-Level Raw Score

For multi-position players, Nevisly calculates value at every eligible position and uses the position that produces the highest VOR.

Example:

A C/LW player may derive more replacement value at LW than C.

---

# Positional Flexibility

Positional flexibility is part of the Nevisly score.

Current concept:

2 eligible positions:  
small flexibility bonus

3+ eligible positions:  
slightly larger flexibility bonus

Additional small bonus may be applied when a multi-position player can cover an open starter position.

Current approximate values:

2 positions:

+0.10

3+ positions:

+0.18

Additional open-position flexibility:

+0.08

Maximum flexibility bonus:

approximately +0.25

Flexibility is intentionally a tiebreaker.

It should never outweigh a major talent difference.

---

# Shared Draft State

Draft state uses:

```ts
type DraftPick = {
  playerId: string;
  fantasyTeamId: string;
  pickNumber: number;
};

type FantasyTeam = {
  id: string;
  name: string;
  isMyTeam: boolean;
};
```

Drafted players are tracked through shared draft state.

Derived state includes:

- drafted player IDs
- player owner
- My Team draft order
- league team rosters

Undo is implemented.

Drafted players disappear from the available player pool by default.

Drafted players can optionally be shown.

Manual draft actions and future Yahoo draft events should update this same state.

---

# Snake Draft

Snake draft logic is implemented.

User selects:

My Draft Slot

Supported draft slots depend on selected league size.

Current draft state automatically determines which fantasy team is selecting next.

Snake logic reverses each round.

Example in a 12-team league:

Round 1:  
1 → 12

Round 2:  
12 → 1

Round 3:  
1 → 12

The Draft Room automatically advances to the next team after each recorded pick.

Undo recalculates the next selecting team.

Changing league size or My Draft Slot resets the draft state.

---

# My Team / Roster Assignment

Implemented:

- My Pick
- My Team panel
- intelligent starter assignment
- bench assignment
- automatic roster rearrangement
- team category totals
- open starter count

Current skater slots:

- C1
- C2
- LW1
- LW2
- RW1
- RW2
- D1
- D2
- D3
- D4
- BN1
- BN2
- BN3
- BN4

Roster matching accounts for multi-position eligibility.

Example:

A C/LW player may move from C to LW so a C-only player can occupy the C slot.

The objective is to maximize starter utilization.

---

# Team Needs Engine

Dynamic category-needs scoring is implemented.

Each drafted My Team player's Z-scores contribute to team category strength.

Team Category Strength:

Average drafted-player Z-score within each category.

Category needs are measured relative to My Team's average category strength.

Approximate interpretation:

Weight > 1.0  
category is relatively weak

Weight < 1.0  
category is relatively strong

Weight = 1.0  
neutral

Current clamp:

0.75 to 1.35

Current sensitivity:

approximately 0.18

Need Bonus:

sum(  
player category Z  
×  
(category need weight - 1)  
)

Current multiplier:

Need Bonus × 0.75

This allows the recommendation model to respond dynamically as My Team changes.

---

# H2H Matchup Impact

H2H-specific matchup modeling is implemented for skaters.

File:

src/lib/draft/h2hImpact.ts

The model compares My Team against every other fantasy team across:

- G
- A
- P
- PPP
- SOG
- HIT
- BLK

Category result:

Win = 1

Tie = 0.5

Loss = 0

Candidate players are simulated on My Team.

The system estimates whether adding the player improves projected category wins against the league.

Current result includes:

- matchupGain
- beforeWins
- afterWins

Current Nevisly score applies:

H2H Matchup Gain × 1.25

This is more aligned with the real H2H league format than roto-point optimization.

Goalie categories are not yet incorporated into H2H matchup simulations.

---

# League Rankings

League Rankings are implemented.

Component:

src/components/LeagueRankings.tsx

Current League Rankings can display:

- team totals
- category comparisons
- internal roto-style points/ranks

IMPORTANT:

Roto points are NOT the league's real scoring format.

They are currently only an internal category-strength comparison heuristic.

The League Rankings matrix is collapsed by default to keep the main draft UI clean.

Next major upgrade:

Replace the roto-style headline with true H2H metrics such as:

- average projected categories won
- matchup strength
- matchup win rate
- projected H2H rank
- eventual playoff/championship strength

---

# Draft-Room Scarcity

Dynamic draft-room scarcity is implemented.

File:

src/lib/draft/draftRoomScarcity.ts

Scarcity considers:

- positional demand
- players already drafted
- remaining positional depth
- remaining strong VOR players
- tier drop-offs

Current positional pressure weights approximately include:

- C: 0.8
- LW: 1.0
- RW: 1.0
- D: 1.15

Defense receives slightly more scarcity pressure.

Potential recommendation reasons include:

- D tier cliff
- D run developing
- D depth drying up

Scarcity bonus is capped so Nevisly does not panic-draft a position.

Current approximate max:

+0.75

---

# Return Risk / Gone Risk

Opponent-aware return risk is implemented.

File:

src/lib/draft/returnRisk.ts

Purpose:

Estimate whether a player is likely to still be available at My Team's next snake-draft selection.

Inputs include:

- current player rank
- picks until My Team selects again
- snake draft order
- exact teams selecting before My Team
- opponent rosters
- opponent positional needs
- opponent category needs
- player VOR
- player category strengths
- position scarcity

Risk levels:

- SAFE
- POSSIBLE
- RISKY
- TAKE NOW

UI shows:

GONE RISK: X%

plus:

- risk level
- picks until My Team's next selection
- short explanation

Examples:

- 4 upcoming teams fit this player
- 2 teams before you may target him
- Ranks inside the expected pick window
- Reasonable chance he survives

Gone Risk is currently informational.

It does NOT directly increase a player's Nevisly talent score.

This prevents urgency from being confused with player quality.

Very obvious top players should be able to display approximately 100% Gone Risk.

---

# Schedule Engine

Schedule data is implemented using the NHL public schedule API.

Current API route:

src/app/api/nhl/playoff-schedule/route.ts

Despite the route name, it now calculates both:

- season schedule data
- playoff schedule data

Current usable fantasy season:

September 29, 2026  
through  
April 4, 2027

Yahoo Week 27 is intentionally excluded.

Schedule data includes:

- season games
- season off-night games
- playoff games
- playoff off-night games
- playoff games by week
- playoff off-night games by week

The route steps through the NHL schedule and de-duplicates games using NHL game IDs.

Only regular-season NHL games are counted.

---

# Off-Night Games

Off-night schedule value is implemented.

Current off-night days:

- Sunday
- Monday
- Wednesday
- Friday

These matter because the league uses daily lineup changes.

Games on lighter NHL nights are more likely to fit into active roster slots rather than being lost on the bench because several roster players play simultaneously.

Nevisly currently considers:

- season off-night value
- playoff off-night value

Season off-night value is measured relative to the NHL-team average.

Playoff off-night value receives additional championship relevance.

The Player Pool includes an:

OFF

column showing season off-night games.

The OFF column is sortable.

Recommendation explanations can identify:

Strong off-night schedule

when a player's NHL team has meaningfully more season off-night games than the NHL average.

Current explanation threshold is approximately:

NHL average + 4 off-night games

Recommendation explanations can also identify:

Strong playoff off-nights

when playoff off-night volume is meaningfully above the league average.

---

# Playoff Schedule

Playoff schedule value is implemented.

Current fantasy playoff window:

Yahoo Week 24  
March 15-21, 2027

Yahoo Week 25  
March 22-28, 2027

Yahoo Week 26  
March 29-April 4, 2027

Yahoo Week 27 is excluded.

The Player Pool currently shows:

PO

where PO is the total number of NHL games a player's team plays during Weeks 24-26.

Examples:

- 9
- 10
- 11
- 12

Washington can have 12 games during this window.

Week 27 games do NOT count.

The Best Available panel also displays:

PO 10  
PO 11  
PO 12

etc.

The PO column is sortable.

Hovering PO can show:

- Yahoo Weeks 24-26 only
- playoff off-night games
- season off-night games

Playoff schedule scoring considers:

- total playoff games
- playoff off-night games
- weekly playoff balance

Schedule should remain a meaningful tiebreaker rather than override major differences in player quality.

---

# Schedule Bonus

Current schedule value concept:

Schedule Bonus =  
Season Off-Night Bonus  
+ Playoff Games Bonus  
+ Playoff Off-Night Bonus  
+ Weekly Playoff Balance Bonus

Season off-night component:

approximately:

(schedule season off-night games - NHL average) × 0.01

Playoff games component:

approximately:

(playoff games - 9) × 0.06

Playoff off-night component:

approximately:

(playoff off-night games - NHL average playoff off-night games) × 0.025

Weekly playoff balance:

A balanced schedule such as:

4 / 3 / 4

can receive a small positive adjustment.

A badly unbalanced playoff schedule can receive a small negative adjustment.

Current overall schedule bonus is capped approximately between:

-0.35 and +0.40

Schedule remains secondary to core player quality.

---

# NHL Team Abbreviation Mapping

Projection sources and the NHL API do not always use the same team abbreviations.

Nevisly contains schedule aliases for common differences.

Examples:

TB → TBL

LA → LAK

NJ → NJD

SJ → SJS

WAS → WSH

CLB → CBJ

MON → MTL

This fixed schedule-data mismatches such as Tampa players failing to receive schedule values.

Continue expanding this mapping if projection sources use additional alternate abbreviations.

---

# Age Risk

Age is imported from the projection CSV.

Age is now part of the Nevisly score, but only as a small risk modifier.

Current philosophy:

Do NOT reward youth simply for being young.

Do NOT heavily punish elite older players.

Age represents a modest decline/durability-risk tiebreaker.

Current model:

Age <= 31:

0

Age 32-34:

-0.03

Age 35-36:

-0.07

Age 37-38:

-0.12

Age 39+:

-0.18

This means age cannot overpower elite talent.

Hovering the Age value can display the applied age-risk modifier.

Eventually injury history, games played, role stability and recent decline should provide better risk modeling than age alone.

---

# Current Nevisly Score

Current conceptual skater score:

Nevisly Score =  
VOR  
+ Need Bonus  
+ (H2H Matchup Gain × 1.25)  
+ Draft-Room Scarcity Bonus  
+ Positional Flexibility Bonus  
+ Schedule Bonus  
+ Age Risk Bonus

Where Schedule Bonus includes:

- season off-night value
- playoff game volume
- playoff off-night value
- playoff weekly balance

Gone Risk is NOT currently included directly in the Nevisly score.

Gone Risk is displayed separately as draft-timing information.

The distinction is intentional:

Nevisly Score = how valuable the player is to winning

Gone Risk = how likely the player is to disappear before the next pick

---

# Recommendation Explanations

Recommendation explanations are implemented.

Nevisly identifies actual category rank among currently available players.

The recommendation system no longer only says generic things such as:

Strong A + P

when a more useful league-wide strength can be identified.

Examples:

- #1 PPP
- Elite A
- Elite P
- Helps HIT + BLK
- Fills RW
- Scarce D value
- C/LW flexibility
- Improves H2H matchup strength
- D tier cliff
- 12 playoff games
- Strong off-night schedule
- Strong playoff off-nights

Current #1 logic:

If a player ranks first among available players in a category, the explanation can explicitly show:

#1 PPP

Current Elite definition:

Category rank approximately #2 through #5 among available players

AND

category Z-score >= +1.0

Recommendation explanations return approximately the top three reasons to keep the UI fast.

---

# Best Available Panel

Best Available is implemented.

The panel prominently displays approximately the top 5 current Nevisly recommendations.

Each recommendation includes:

- recommendation rank
- player name
- eligible positions
- NHL team
- playoff games
- recommendation reasons
- Gone Risk
- risk level
- picks until My Team selects again
- Gone Risk explanation
- Nevisly score
- large MY PICK button

The #1 recommendation receives stronger visual emphasis.

Goal:

The user should be able to:

1. identify the recommended player
2. understand why
3. make the pick

in approximately 10 seconds.

This is important because the Yahoo draft timer is:

90 seconds

---

# Player Pool

Current visible Player Pool columns include:

- Pick
- Player
- Pos
- Team
- Nevisly
- Gone Risk
- G
- A
- P
- PPP
- SOG
- HIT
- BLK
- Age
- OFF
- PO
- Status

Features:

- instant search
- team search
- position filters
- sortable columns
- category heatmap
- Draft button
- Mine button
- Undo
- Show Drafted toggle
- playoff-game totals
- season off-night games
- age
- schedule hover information

Internal metrics such as:

- VOR
- Need Bonus
- H2H Gain
- scarcity bonus
- flexibility bonus
- schedule bonus
- age risk

are intentionally not shown as separate primary columns.

The UI should remain decision-focused.

---

# UI Philosophy

Nevisly should minimize mental overhead during a live draft.

Non-negotiables:

- #1 recommendation is obvious
- top 5 recommendations visible quickly
- MY PICK button is large
- player search is fast
- position filters are easy to reach
- current team needs are visible
- open roster positions are visible
- Undo Last is always easy to access
- drafted players disappear immediately
- recommendation updates should feel instant
- advanced matrices remain secondary/collapsed

The complexity should remain internal.

Primary visible decision metric:

Nevisly Score

Supporting information:

Why this player

Gone Risk

PO games

OFF-night value

The user should not need to mentally combine many separate advanced statistics during a 90-second pick timer.

---

# Draft Room

Manual Draft Room is implemented.

Features:

- every fantasy team represented
- snake order automatically advances
- manual team selection possible
- player ownership tracking
- team pick counts
- My Team identification
- Undo Last
- individual player undo

The currently selecting team is shown in the top bar.

The Draft Room automatically advances after each pick according to snake order.

This manual system should remain usable even after Yahoo live-draft synchronization becomes available.

---

# League Size / Draft Slot

Current league-size selector supports multiple team counts including:

- 8
- 10
- 12
- 14
- 16

Default:

12 teams

My Draft Slot is selectable dynamically based on league size.

Changing either:

- league size
- My Draft Slot

resets the draft state to avoid invalid ownership/snake-order state.

Eventually Yahoo should populate league size and draft position automatically.

---

# Goalies

Goalies are intentionally not implemented yet.

Current league goalie categories:

- W
- SV%
- SHO

Minimum goalie appearances:

3 per fantasy team per week

Goalies require a separate projection model.

Future goalie model should consider:

- projected starts
- wins
- save percentage
- shutouts
- team strength
- starter security
- tandem risk
- back-to-backs
- schedule
- minimum appearance requirement

Do NOT directly mix goalie Z-scores with skater Z-scores until the goalie model is designed specifically for the league.

Draft strategy preference:

Goalies are generally targeted later.

This is a preference, not a hard rule.

Nevisly should eventually override this strategy if championship odds clearly favor taking a goalie earlier.

---

# Player Status / Injury Risk

Status remains a placeholder.

Potential statuses:

- Healthy
- DTD
- OUT
- IR
- IR+

Potential sources:

- Yahoo fantasy player status
- NHL player data
- injury-specific source

Future injury model should consider:

- current injury
- games-missed history
- age
- role stability
- recovery timeline
- projected games played

Age currently acts only as a small proxy for risk.

---

# External Data Strategy

Potential data sources:

Projection Data  
Yahoo Data  
NHL Schedule Data  
Injury Data  
↓  
Normalized Player Data  
↓  
Draft State  
↓  
Ranking Engine  
↓  
Recommendation Engine  
↓  
UI

Yahoo should never be tightly coupled to ranking logic.

The system should continue functioning if any optional external data source is temporarily unavailable.

---

# Yahoo Live Draft Plan

Once Yahoo Fantasy Sports API access is approved, Nevisly should automatically retrieve:

- league
- scoring categories
- roster positions
- actual league size
- fantasy teams
- draft results
- drafted players
- team ownership
- player eligibility
- player status where available

Desired live flow:

Yahoo draft result  
→ identify player  
→ identify fantasy team  
→ create/update DraftPick  
→ update league roster  
→ remove player from available pool  
→ recalculate H2H impact  
→ recalculate team needs  
→ recalculate scarcity  
→ recalculate Gone Risk  
→ refresh Best Available

Yahoo should remain only a data source feeding the same manual DraftPick model already implemented.

---

# Security / Credentials

Never commit:

- Yahoo Client Secret
- access tokens
- refresh tokens
- private credentials

Credentials live in:

.env.local

and:

Vercel Environment Variables

.gitignore must continue ignoring:

.env*

Do not put actual secret values in this file.

---

# Current Major Implemented Systems

Implemented:

- Yahoo OAuth
- CSV projection importer
- category Z-scores
- category heatmap
- positional VOR
- dynamic league size
- manual Draft Room
- snake draft
- selectable My Draft Slot
- shared DraftPick state
- drafted-player ownership
- My Team
- intelligent roster assignment
- multi-position starter rearrangement
- team category totals
- dynamic team needs
- H2H matchup impact
- League Rankings
- draft-room positional scarcity
- opponent-aware Return Risk
- Gone Risk UI
- Best Available
- recommendation explanations
- #1 category explanations
- Elite category explanations
- positional flexibility scoring
- NHL schedule API
- official Yahoo 2026-27 fantasy week dates
- Yahoo Weeks 24-26 playoff window
- Week 27 exclusion
- playoff-game counts
- season off-night games
- playoff off-night games
- weekly playoff balance
- schedule scoring
- age-risk scoring
- NHL/projection team-abbreviation normalization
- OFF column
- PO column
- sortable OFF
- sortable PO
- schedule hover details
- 90-second-draft-focused UI

---

# Current Important Files

Core UI:

src/components/ProjectionUpload.tsx

League ranking UI:

src/components/LeagueRankings.tsx

Projection parser:

src/lib/projections/parseSkaterCsv.ts

H2H impact:

src/lib/draft/h2hImpact.ts

Draft-room scarcity:

src/lib/draft/draftRoomScarcity.ts

Return Risk:

src/lib/draft/returnRisk.ts

Schedule scoring:

src/lib/draft/playoffSchedule.ts

NHL schedule API route:

src/app/api/nhl/playoff-schedule/route.ts

Player types:

src/types/player.ts

Draft types:

src/types/draft.ts

---

# Next Major Step

Next major feature:

## Replace Roto-Style League Rankings With True H2H Rankings

The League Rankings panel currently uses roto-style category points as an internal comparison heuristic.

That should be replaced or demoted in favor of true H2H matchup strength.

Desired metrics:

- projected category wins vs each opponent
- average categories won per matchup
- projected H2H matchup record
- matchup win probability
- projected H2H league rank

Example:

My Team

Avg Categories Won:

4.8 / 7

Projected Matchup Win Rate:

72%

H2H Rank:

2 / 12

Potential model:

For every fantasy team:

compare projected category totals against every other fantasy team.

For each matchup:

- category win = 1
- tie = 0.5
- loss = 0

Calculate:

- average categories won
- matchup win percentage
- category consistency
- league H2H rank

This should ultimately replace roto points as the primary League Rankings metric.

---

# Future Championship Model

Eventually Nevisly should move beyond projected H2H rank and estimate:

- probability of making playoffs
- probability of winning quarterfinal
- probability of winning semifinal
- probability of winning final
- championship probability

Potential concept:

Regular-season roster strength  
+ category balance  
+ schedule  
+ playoff schedule  
+ injury/risk  
+ goalie strength  
+ opponent roster distributions  
↓  
Monte Carlo / matchup simulation  
↓  
Championship probability

Ultimately the #1 draft recommendation should be the player who produces the largest increase in championship probability.

---

# Later Priorities

After true H2H League Rankings:

1. Improve opponent-specific draft modeling.
2. Improve Return Risk calibration.
3. Add player status / injury data.
4. Add goalie projections.
5. Add goalie H2H matchup modeling.
6. Add goalie schedule / back-to-back intelligence.
7. Add automatic Yahoo league settings when API access is approved.
8. Add live Yahoo draft synchronization.
9. Improve playoff championship simulation.
10. Add multiple projection providers.
11. Add projection weighting / consensus projections.
12. Improve schedule usability based on actual roster congestion.
13. Improve age/risk modeling using injury history and games played.
14. Calculate playoff advancement probability.
15. Calculate championship probability.

---

# Model Philosophy

Nevisly should avoid allowing any one secondary factor to overpower player quality.

General priority:

1. Core fantasy production
2. Positional replacement value
3. H2H category impact
4. Team fit
5. Draft-room scarcity
6. Championship/playoff schedule
7. Season schedule usability
8. Positional flexibility
9. Age/risk
10. Draft timing / Gone Risk

Gone Risk should inform WHEN to draft a player.

It should not be confused with HOW GOOD the player is.

Schedule should matter more when two players are relatively close.

Age should remain a small tiebreaker unless more sophisticated injury/durability data becomes available.

---

# Long-Term Nevisly Goal

During a live Yahoo draft, Nevisly should continuously answer:

> Who should I draft right now to maximize my probability of winning the league championship?

That answer should account for:

- who is still available
- who was already drafted
- what My Team needs
- what opponents need
- category strengths
- category weaknesses
- positional scarcity
- positional replacement value
- whether the player will survive until the next pick
- H2H matchup impact
- roster flexibility
- season schedule usability
- off-night games
- fantasy playoff games
- fantasy playoff off-night games
- playoff-week balance
- age
- injury risk
- goalie strategy
- opponent construction
- championship probability

The user should see a simple recommendation.

The complexity should stay inside Nevisly.