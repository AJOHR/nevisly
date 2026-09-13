# Nevisly Firefox Sync v2 — fixture-tested development build

This extension is paired with the Nevisly v2 receiver, not the old production receiver. It uses the supplied Yahoo HTML capture as extraction evidence. No Stage 5 scoring changes are included.

## Install and test

1. Disable/remove the old Nevisly sync extension.
2. Unzip this folder. In Firefox open about:debugging#/runtime/this-firefox, choose Load Temporary Add-on, and select manifest.json.
3. Run the Nevisly v2 branch locally (`npm ci`, `npm run dev`) and open http://localhost:3000. Production https://nevisly.vercel.app is also supported once the corresponding app changes are deployed. Other previews/origins are deliberately not permitted.
4. Open the Yahoo NHL mock-draft room at its sports-fantasy.media.yahoo.com/draft/hockey/... URL. Open Results → Round by Round and keep it open for the first live test.
5. In Nevisly, verify league size/slot and click Connect for the intended room. Observe transport, capture age, extraction, history coverage, matching and owner-mapping states separately.
6. If Firefox cannot reinject scripts after loading/reloading the add-on, refresh both pages once. Temporary add-ons must be loaded again after restarting Firefox. This has not been tested in a real installed Firefox session here.

Do not merge/deploy the app solely because these deterministic tests pass. Complete the live mock-draft checklist below first. No additional HTML capture is currently required to start that test.

## Evidence and limits

Verified in the supplied HTML: history picks 1–18, header Round 2/Pick 19, semantic table header data-id values pick/player/team, .ys-player[data-id] numeric player identifiers, abbr eligibility/team values, a goalie at #9, owner display-name cells, and /draft/hockey/2253754/9 routing. The screenshot shows a later pick and is not combined with the HTML state.

The row number is authoritative for each observation. The header only cross-checks whether all preceding numbers are represented. Coverage is called complete-through-header, not proof of Yahoo server freshness. Before the first round boundary, at the final pick, with missing rows/metadata, or on unsupported layouts, observations may remain partial. Partial observations never remove retained selections.

No Yahoo fantasy-team key, server revision or draft-reset epoch is exposed. Owner slots are derived from unique first-round display names, not fabricated Yahoo team IDs; ambiguous/unmapped owners stay unassigned with their raw names preserved. A room URL is an observed route, not a claim that Yahoo never reuses room IDs. A new draft must be explicitly started/rebound. Closing the source tab requires explicit reconnection to a new source tab; it cannot silently replace the bound draft.

The stream UUID and sequence are local transport/capture identities. They are NOT Yahoo IDs/revisions. The sequence changes only when actual captured content changes; replay retains it. Sender extension, origin, top frame and current browser document identity are checked. A browser without document identity support is unsupported instead of being trusted by tab number alone.

History differences are quarantined. A user-reviewed correction can apply only the latest complete pending observation, preserving slot numbers and removing absent later slots only after that explicit local review. Partial corrections and automatic resets are unsupported.

## Files and tests

Runtime: manifest.json, extractor.js, yahoo.js, background.js, nevisly.js.

`npm ci` then `npm run lint` performs JavaScript syntax checks. `npm test` runs fixture and transport/integration tests. The transport tests execute the actual scripts with mocked browser interfaces and load the real Nevisly receiver. Set NEVISLY_PATH to your Nevisly checkout, or place this folder next to a `nevisly` checkout. The fixture preserves captured markup while replacing fantasy display names; it contains no auth state, scripts, cookies or original resource bundle.

The matching Nevisly branch has its own TypeScript, ESLint, regression and build gates. The extension has no runtime third-party dependencies.

## Live Firefox checklist (still required)

- Normal pick and consecutive snake picks at 12/13 and 24/25.
- Goalies, a player absent from projections, dual eligibility and owner counts.
- Open Nevisly late; refresh Yahoo and Nevisly separately; reload the add-on.
- Request fresh history without another pick; pause for a full 60-second turn.
- Two Yahoo rooms: only the explicitly bound source may update the draft.
- Scroll history / switch results tabs: partial/unsupported health must appear, with retained picks intact; reopen Round by Round and recover.
- Verify user-reviewed correction behavior if Yahoo offers an undo/reset in the mock room. Do not simulate a correction and call it live Yahoo evidence.
- Final draft selection: it must consume its explicit number even if the final header stops advancing. Coverage may remain partial.

No actual Firefox/Yahoo end-to-end run or wall-clock latency guarantee has been established in this environment.
