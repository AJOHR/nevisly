# Live Season pipeline (stacked on PR #49; not production-accepted)

| Data | Source | Refresh |
| --- | --- | --- |
| League, settings, rosters, matchup totals, available pool | Yahoo Fantasy API | Explicit Load/refresh; private, no-store |
| Status/notes, ownership, percent owned, draft analysis, actual stats | Yahoo Fantasy API | Same refresh; actual coverage retained |
| Regular-season game dates | NHL club schedule API | Next fetch cache, 6 hours; deduplicated per team, concurrency 4 |
| Per-game projections | Existing uploaded weighted blend | Recomputed locally when blend changes; no source/weight edits |
| ROS value proxy | Existing intrinsic projection Player Value | Live league size/slots; no Draft Fit/Timing or live ADP inputs |
| Swing units | Existing Nevisly Season configuration | Unchanged |

Yahoo calls retain #49's logged-in NHL leagues, league settings/teams, scoreboard and both current rosters. New calls:

- `league/{key}/players;status=A;start={offset};count=25;out=metadata,ownership,percent_owned,draft_analysis,stats`
- `league/{key}/players;player_keys={up to 25 keys};out=metadata,ownership,percent_owned,draft_analysis,stats`
- `league/{key}/players;player_keys={up to 25 roster keys}/stats;type=date;date={league-calendar date}` (optional actual-stat diagnostics; unavailable coverage is explicitly warned)

NHL: `https://api-web.nhle.com/v1/club-schedule-season/{TEAM}/20262027`.
Only gameType 2, season 20262027 accepted. Unknown teams/errors leave schedules unknown.

The read-only `/api/yahoo/season/live?timeZone={IANA zone}` uses the existing host-scoped HttpOnly access-token cookie. It never returns the token. Yahoo collection failures block refresh; duplicates, count mismatches and pagination limits are errors, not partial success. Matchup date bounds must come from Yahoo. Users explicitly confirm the league calendar timezone; no timezone is inferred from their physical location. Completed calendar dates are excluded. Today remains included: this is schedule opportunity, not intraday lock/start certainty.

Projection joining happens locally because uploaded projections already live in the existing session. Exact existing normalized names plus compatible positions are required; ambiguous matches and multiple live identities mapped to one projection remain unmatched. Yahoo team/eligibility remain authoritative. Per-game rates use the supplied projection GP, never actual stats. Uploaded projections are not a newly refreshed ROS forecast: the displayed ROS value is explicitly labeled a full-season intrinsic projection-value proxy.

Yahoo ownership strings are retained verbatim. `freeagents`/`FA` qualify for immediately actionable single-move comparisons. Waivers and unknown ownership remain visible in provider diagnostics but are excluded from these comparisons because claim timing is not modeled. No transactions are executed. Statuses remain exact Yahoo observations, with no guessed return dates or automatic removal of scheduled games. Goalie future production remains unknown. Opponent remaining skater production uses the same exact dated allocator and projections as our roster.

No silent manual fallback. The manual fixture is an explicit source choice. Missing structural inputs block composition; missing projection/schedule inputs block the corresponding recommendation math. Server diagnostics expose provider facts and schedule coverage; client diagnostics expose projection coverage and composition readiness. Standings/transactions are not needed for this single-matchup pipeline and are not retrieved.

## Production acceptance (pending; no preview OAuth workaround)

1. Review and merge the Season stack (#46–#49 and this PR) only when separately authorized, then deploy to the authenticated production host. No PR is merged by this task.
2. On production, use the existing Yahoo login. Verify `/api/yahoo/test` still succeeds.
3. Retain/load the intended projection blend. Open Season → Yahoo, confirm the league calendar timezone, then Load/refresh.
4. Confirm real league, Yzerplan, opponent, current week/totals and both rosters. Inspect ownership/waiver counts, exact status, live draft analysis and actual-stat coverage.
5. Check projection mismatches and missing schedule diagnostics before trusting recommendations. Confirm dates match the Yahoo matchup, preseason is absent, and completed dates are excluded.
6. Compare daily assignments/benched games with the live league. Treat today, injuries and waiver processing as manual checks. Verify Draft uploads/state remain intact.

The preview lacks the production cookie and Yahoo rejects its callback; this is an acceptance limitation, not an adapter failure. The implementation is fixture-verified, not authenticated-live verified. Large available pools may approach the host's function-duration/API quota limits; errors remain explicit rather than truncating the pool.
