# Yahoo mock-draft evidence required before extension work

The extension ZIP contains code, not an actual Yahoo DOM fixture. Capture the rendered page in Firefox during a Yahoo NHL mock draft. A screenshot alone cannot establish selectors or identifiers, and View Page Source may omit the rendered draft history.

## Minimum packet to unblock extraction design

1. After at least 14 completed picks in a 12-team room, open the round-by-round/draft-results view. In Firefox Inspector, select its entire containing table/list element, including headers and all currently rendered rows. Right-click the node, Copy > Outer HTML, and save as history-after-pick-14.html. Include at least one goalie; include an unprojected player if practical. Keep links and attributes intact.
2. At the same point, copy Outer HTML for the top-level draft status/header area containing round, current pick, last selection, completion/progress counts and draft/team identity labels. Save as status-after-pick-14.html. Include a screenshot showing those areas together. State the number of teams and whether Pick in that screenshot is overall or within the round if Yahoo explicitly identifies it; do not guess.
3. Provide the Yahoo draft-room URL (omit sensitive query parameters). If player or fantasy-team links/IDs are absent from the copied history, copy one player-row/card node and one fantasy-team node with all attributes/links. State which fantasy team occupied which first-round slot if the UI exposes it.

If only one round is rendered at a time, capture rounds 1 and 2 separately and say how you switched or scrolled. Do not combine their markup and label it one simultaneous complete observation. Note whether earlier rows disappear after scrolling.

## Additional captures for the later acceptance tests

- Before the first pick: empty history + status.
- Around picks 12 and 13: header and history to establish snake-boundary numbering.
- Final draft state: completed history + explicit draft-complete indicator.
- A Yahoo undo/correction/reset if the mock-draft UI permits it: before/after history and status, with a description of the action. If unavailable, say so; do not simulate a correction and present it as Yahoo evidence.
- An example with dual eligibility, missing NHL team/free-agent label, or an abbreviated name.

## Sanitization

Copy only the specified rendered element subtrees, not cookies, local storage, authentication responses, a network HAR or the entire account page. Remove email/chat and personal names if present. Keep nonsensitive player/team/draft identifiers and structure, or replace identifiers consistently across all files and explain the substitutions. Do not remove the href/data attributes needed to establish where identities actually come from. Do not include access tokens or session cookies.

Zip the HTML files/screenshots and upload them here. No new approval is needed after supplying evidence; the integration implementation is already authorized. The evidence gate comes from the user's explicit instruction to inspect actual Yahoo DOM before locking extraction.
