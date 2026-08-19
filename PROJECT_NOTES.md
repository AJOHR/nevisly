# Nevisly Project Notes

## Project

Nevisly is a Yahoo Fantasy Hockey draft assistant inspired by tools such as _____.

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

---

## Current Yahoo Status

Yahoo OAuth is working end-to-end.

Working:

- Yahoo authorization redirect
- OAuth callback
- Authorization code exchange
- Access token received
- Refresh token received on initial authorization
- Access token stored in secure HTTP-only cookie

Yahoo Fantasy Sports API currently returns:

403
"This application is not authorized to perform this action."

A Yahoo Fantasy Sports API access application has been submitted and is pending approval.

Do not delete or regenerate the current Yahoo app credentials while waiting.

Yahoo integration should remain isolated from the core draft engine so Nevisly can function without Yahoo API access.

---

## League Settings

Current skater scoring categories:

- Goals (G)
- Assists (A)
- Points (P)
- Powerplay Points (PPP)
- Shots on Goal (SOG)
- Hits (HIT)
- Blocks (BLK)

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

Current skater starter counts:

- C: 2
- LW: 2
- RW: 2
- D: 4

Goalies are not implemented yet.

---

## Projection Importer

Current importer supports CSV files.

Current test projection file:

DtZ 2024-2025 NHL Fantasy Projections

The importer currently reads:

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

Normalized internal player structure:

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

Current test file loads 757 players successfully.

---

## Player Table

Implemented:

- CSV upload
- Instant player search
- Team search
- Position filters:
  - ALL
  - C
  - LW
  - RW
  - D
- Clickable sorting
- Age column
- Player age sorting
- Drafted-player tracking
- Show/hide drafted players
- My Pick button
- PO Games placeholder
- Status placeholder

Current columns:

- Draft
- Player
- Age
- Pos
- Team
- Score
- VOR
- Need
- VOR Pos
- GP
- G
- A
- P
- PPP
- SOG
- HIT
- BLK
- PO Games
- Status

---

## Heatmap

Heatmap is implemented for:

- G
- A
- P
- PPP
- SOG
- HIT
- BLK

Heatmap is based on category Z-scores.

Current Z-score baseline uses the top 250 projected skaters rather than all 757 players.

Current heatmap interpretation:

- Dark green = elite
- Medium green = strong
- Light green = above average
- Neutral = average
- Light red = below average
- Medium red = weak
- Dark red = very weak

Hovering a category cell shows the exact Z-score.

The top-250 baseline is temporary.

Eventually the fantasy-relevant pool should be calculated dynamically from:

- league size
- roster settings
- replacement level

---

## Base Ranking Model

Current categories:

- G
- A
- P
- PPP
- SOG
- HIT
- BLK

For each category:

Z = (player stat - category mean) / category standard deviation

Raw player score:

Raw Score =
G Z
+ A Z
+ P Z
+ PPP Z
+ SOG Z
+ HIT Z
+ BLK Z

Do not use the projection provider's supplied Rank or VOR as Nevisly's ranking.

---

## Positional VOR

Positional scarcity is implemented.

Current replacement levels depend on:

League Teams × Starting Slots Per Team

Example in a 12-team league:

- C replacement = approximately 24th C
- LW replacement = approximately 24th LW
- RW replacement = approximately 24th RW
- D replacement = approximately 48th D

For multi-position players, Nevisly calculates VOR at every eligible position and uses the most valuable eligible replacement position.

Current:

VOR = Raw Category Score - Replacement-Level Raw Score

The League Teams selector currently supports:

- 8
- 10
- 12
- 14
- 16
- 18
- 20

Default:

12 teams

Eventually Yahoo should populate league size automatically.

---

## My Team

Implemented:

- My Pick button
- My Team panel
- Draft order tracking
- Automatic removal of My Pick players from available pool
- Projected category totals
- Intelligent starter assignment

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

The roster assignment system attempts to maximize filled starting slots.

Flexible players are automatically rearranged when possible.

Example:

A C/LW player can move between C and LW to allow a C-only player to occupy C.

---

## Team Needs Engine

Dynamic team-needs scoring is being implemented.

Current concept:

Each drafted player's category Z-scores contribute to the strength of My Team.

For each category:

Team Category Strength =
average Z-score of drafted players in that category

Category need weights are generated relative to the team's average category strength.

Approximate interpretation:

- Weight > 1.0 = category needs help
- Weight < 1.0 = team is already relatively strong
- Weight = 1.0 = neutral

Current clamp:

0.75 to 1.35

Player Need Bonus:

Need Bonus =
sum(player category Z × category extra weight)

Current multiplier:

Need Bonus × 0.75

Current recommendation score:

Nevisly Score =
VOR + Need Bonus

VOR remains the player's underlying positional value.

Need Bonus represents fit with the user's current roster.

---

## Future League-Wide Draft Intelligence

Once Yahoo draft data is available, Nevisly should track every fantasy team in real time.

For each fantasy team:

- drafted players
- roster
- projected category totals
- category Z-scores
- category rank
- overall projected rank

Desired League Matrix:

Team        G    A    P    PPP    SOG    HIT    BLK
My Team     3    1    1     2      4      8     10
Team B      1    6    4     5      2     11      7
Team C      8    3    5     1      7      2      1

The matrix should use a heatmap.

Desired overall ranking example:

1. Team A
2. My Team
3. Team C
...

Eventually the recommendation engine should consider marginal category standings value.

Example:

If My Team is 11th in BLK but very close to 7th, strong blocking players should receive a meaningful recommendation boost.

If My Team is already far ahead in assists, additional assist-heavy players should receive less marginal value.

This should eventually be smarter than a simple weak-category multiplier.

---

## Best Available Panel

Planned.

During a live draft, Nevisly should prominently show approximately the top 5 recommendations.

Example:

BEST AVAILABLE

1. Player A
   Score: 8.82
   Why: Elite G + SOG, fills RW need

2. Player B
   Score: 8.65
   Why: Strong BLK + HIT, scarce D

3. Player C
   Score: 8.41
   Why: High overall value, C/LW eligibility

The goal is to reduce decision time during a ~2 minute draft clock.

---

## Yahoo Integration Plan

When Yahoo API access becomes available, Nevisly should automatically retrieve:

- league
- scoring categories
- roster positions
- league size
- fantasy teams
- draft results
- drafted players
- team ownership of each drafted player
- player eligibility
- player status where available

Desired live flow:

Yahoo draft result
→ identify drafted player
→ identify fantasy team
→ update roster
→ remove player from available pool
→ recalculate every fantasy team
→ recalculate My Team needs
→ recalculate Nevisly recommendations

Yahoo should be treated as a data source, not as the core draft engine.

---

## External Data

### Age

Currently imported from projection CSV.

Eventually use:

- Yahoo player metadata if suitable
- otherwise another player-data source
- birth date can be converted to age

### Playoff Games

Do not depend on Yahoo.

Calculate using the NHL schedule and the fantasy league's playoff dates.

Potential future metrics:

- total fantasy playoff games
- games by playoff week
- off-night games
- back-to-backs
- schedule quality

### Player Status

Current placeholder.

Potential sources:

- Yahoo fantasy status
- NHL/player data source
- injury-specific data source

Desired statuses may include:

- Healthy
- DTD
- IR
- IR+
- OUT

---

## Goalies

Not implemented yet.

Need a separate goalie projection model.

Potential goalie categories depend on league settings and may include:

- W
- SV
- SV%
- GAA
- SO
- GS

Do not mix goalie Z-scores directly with skater calculations until goalie scoring/categories are established.

---

## Architecture Direction

Keep these systems separate:

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

Yahoo should eventually be one implementation of a draft data source.

Potential data sources:

DraftDataSource
├── Yahoo API
├── Manual Draft
└── Future Fantasy Platform

---

## Current Development Workflow

Development happens in Cursor.

No localhost testing is required unless needed for debugging.

Workflow:

Cursor
→ make changes
→ git add .
→ git commit
→ git push
→ GitHub
→ Vercel auto deployment
→ test at https://nevisly.vercel.app

---

## Important Credentials

Never commit:

- Yahoo Client Secret
- access tokens
- refresh tokens
- any private credentials

Credentials live in:

.env.local

and in Vercel Environment Variables.

.gitignore should continue to ignore:

.env*

Do not put actual secret values in this file.

---

## Next Steps

Immediate:

1. Finish/test Team Needs engine.
2. Build Best Available / Top Recommendations panel.
3. Show explanations for why each player is recommended.
4. Improve roster-needs awareness.
5. Add league-wide team model for manual simulation.
6. Add NHL playoff schedule calculation.
7. Add status/injury data.
8. Add goalies.
9. Connect Yahoo live draft data when API access is approved.

Longer term:

- live league rankings
- category standings matrix
- marginal standings gain
- projection source weighting
- multiple projection providers
- playoff schedule weighting
- off-night weighting
- injury risk
- age context
- draft history
- recommendation explanations