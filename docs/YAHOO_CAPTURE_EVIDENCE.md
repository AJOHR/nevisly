# Yahoo capture evidence and supported v2 boundaries

The original `draft.zip` was inspected, including rendered HTML, the screenshot, inline bootstrap data, referenced scripts, styles, images and small auxiliary HTML resources. Raw bootstrap data/account resources are not committed. Tests retain a sanitized history/header subset with owner labels consistently replaced; the DOM structure, semantic attributes, player IDs and eligibility are retained. The JSON fixture is extracted from that same sanitized DOM, not from the screenshot.

HTML: Round 2, current Pick 19, history rows 1–18. Screenshot: Round 2, current Pick 24, latest history pick 23. These are different states and are never merged.

| Item | Classification | Evidence / boundary |
| --- | --- | --- |
| Overall selection number | VERIFIED FROM CAPTURE | First cell of the history table identified by th[data-id=pick/player/team]. Rows 1–18 explicitly numbered. |
| Round | VERIFIED FROM CAPTURE | Round 1/2 group headings; boundary 12/13 is explicit. |
| Current pick | VERIFIED FROM CAPTURE | A unique header span ends in Round 2, Pick 19. It is an overall number in this capture. |
| Completed-pick count | REASONABLE BUT NEEDS LIVE VERIFICATION | Header 19 and full history 1–18 agree. No independent server completed-count field or revision is present. Coverage is specifically complete-through-header, not a server guarantee. |
| Player display name | VERIFIED FROM CAPTURE | History player image title, e.g. J. Eichel; abbreviated, not necessarily full legal name. Missing title leaves identity metadata unresolved. |
| Player ID | VERIFIED FROM CAPTURE | .ys-player[data-id], e.g. J. Eichel 6744 and A. Vasilevskiy 5699. Repeated in player-note markup. These are captured numeric IDs, not fabricated full fantasy player keys. |
| NHL team | VERIFIED FROM CAPTURE | Player-cell abbr element separate from owner cell, with abbreviation and full-team title. |
| Yahoo eligibility | VERIFIED FROM CAPTURE | Separate position abbr with C, D, G or comma-delimited eligibility such as LW,RW. |
| Goalie | VERIFIED FROM CAPTURE | Pick 9 is A. Vasilevskiy, G, TB, Your Team. |
| Fantasy owner display | VERIFIED FROM CAPTURE | Third history cell; includes Your Team. |
| Fantasy owner key | NOT AVAILABLE IN CAPTURE | No stable owner data-id, owner link, select value or team key in history/inspected rendered markup. Local ownership is derived from unique first-round labels/slots and explicitly marked history-derived. Ambiguity remains unassigned; raw name is preserved. |
| Round-by-round history | VERIFIED FROM CAPTURE | One table has semantic Pick/Player/Team header data-id attributes; descending displayed rows include both rounds. |
| Last selection | VERIFIED FROM CAPTURE | Last: J. Eichel (C · VGK), owner dalip. Notification/context only; it does not determine numbering. |
| Room path | VERIFIED FROM CAPTURE | Canonical route /draft/hockey/2253754/9; bootstrap routes describe leagueId/managerId. Auth query is never transmitted. |
| Unique draft/reset instance | NOT AVAILABLE IN CAPTURE | URL alone does not prove an instance across reuse/reset. Explicit destination binding plus a local stream isolates delivery. Same-room changed history requires review; a new local draft requires explicit binding. |
| Yahoo revision | NOT AVAILABLE IN CAPTURE | No server history revision or ordered event log. sequence means persisted extension capture order, not Yahoo revision. |
| Selector longevity | REASONABLE BUT NEEDS LIVE VERIFICATION | Semantic attributes avoid _ys_* styling hashes but one fixture cannot prove stability across Yahoo releases. Unsupported/missing/ambiguous layouts return visible extraction issues. |
| Final draft screen / reset / different league types | NOT AVAILABLE IN CAPTURE | Do not infer final completion or automatic reset from empty/short DOM. Keep observed numbered slots and report partial/unsupported coverage. |

## Resource findings

The inline App bootstrap contains shell routing/configuration, including the draft route and component registration. It does not contain draftResults, draftOrder, pickNumber history or a draft-instance revision. Saved vendor/main scripts include a react-draft-client loader/registry; the loaded draft client's runtime state is not serialized here. Other saved JS is consent/analytics infrastructure, and the CSS/images support rendered presentation. Player image filenames agree with IDs but are not used as the primary identity source. No saved resource establishes stable fantasy-owner keys or an authoritative reset revision.

## Implemented safeguards

The extractor reads explicit row numbers only; header movement cannot relabel a Last player. It cross-checks contiguous rows against current header and round evidence. Contiguous prefixes, malformed headers, missing metadata, repeated IDs and conflicting duplicate rows remain partial. Before round 2 supplies sufficient team-count evidence, observations can be imported as partial without a full-coverage claim.

Owner IDs are not manufactured: team-N is a local slot mapping backed by uniquely observed first-round labels, never a Yahoo key. Duplicate/unmapped names remain unresolved and manual correction remains available. Captured Yahoo eligibility overrides projection eligibility for linked selections without changing score coefficients.

## Browser sender identity

The extension validates origin, top-level frame, own extension ID, and documentId against webNavigation.getFrame before accepting a message. The room path and bound local stream/destination are then checked again by Nevisly. Browser document IDs distinguish a replaced document from a reused tab/frame; they are browser IDs, not Yahoo IDs. See Mozilla's runtime.MessageSender and Work with documentId documentation:

- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/MessageSender
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Work_with_documentId

A browser lacking this capability is unsupported rather than silently dropping the document check. The same-page CustomEvent boundary does not protect against arbitrary malicious JavaScript already running in Nevisly's origin.
