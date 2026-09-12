# Yahoo bridge v2 — contract draft awaiting Yahoo DOM evidence

Status: DESIGN ONLY. The current runtime accepts legacy/v1 and rejects schemaVersion 2. No extension changes, sender authentication, acknowledgements, or v2 completeness claims have been implemented. Do not deploy this as a completed integration. Stage 5 remains paused.

## Record identity

A selection has a local selectionId, its observed overall pickNumber, an optional projectionId, and source metadata. selectionId identifies the local slot record across enrichment/correction. It is NOT a Yahoo player key. The existing playerId field is temporarily a compatibility view key for recommendation components; it is never the reconciliation identity.

Yahoo player keys and fantasy-team keys are optional captured values. Never substitute a name, row number, local UUID, or snake-derived team ID for a Yahoo identifier. Missing identity, name, team or positions cannot erase a selection with a verified overall number. Projection collisions detach ambiguous projection links, not selection slots. Contradictory Yahoo identity/number evidence must be quarantined for reconciliation rather than trusted as a fresh pick.

Local snake ownership remains explicitly inferred, contingent on verified league size/order. Raw Yahoo ownership and local slot mapping are distinct. Authoritative Yahoo ownership must override inference only after that mapping is verified. Manual entries and corrections remain available.

## Binding and ordering

Before data import, the extension and Nevisly establish one source Yahoo draft instance and one destination local session. Exact source draft identifiers and their extraction are pending fixtures. A page URL or display name alone is not assumed to establish draft-instance identity. Validate runtime sender tab/document, approved origin, destination binding and the current stream owner; ignore a second source tab unless an explicit handover occurs.

Proposed v2 envelope fields:

- schemaVersion: 2
- messageId: local transport identity, stable across retries; explicitly not a Yahoo ID
- destinationSessionId: the bound local Nevisly session
- source: captured Yahoo draft/league identity plus the verified sender binding
- kind: observation | snapshot | heartbeat | extraction-error
- observation identity/order: defined after verifying Yahoo's available evidence
- selections: source selection observations with explicit overall pick numbers
- coverage: partial or complete, with evidence described below

If Yahoo exposes an actual revision, preserve it without manufacturing replacements. Otherwise, any extension observation counter must be explicitly documented as local capture order, never a Yahoo revision. Assign such order only to validated consistent captures, persist it with the corresponding payload, and keep it unchanged on replay. A counter cannot make stale DOM data fresh. The exact observation/capture boundary is not implemented until fixtures establish how history and completion evidence can be read consistently.

Same-observation replay is idempotent. Contradictory content at the same observation/revision is rejected without state mutation. A same-observation snapshot may cover an incremental observation without deleting it. Persist source fingerprints independently of local metadata/projection edits. Do not use local wall-clock arrival time as correction authority.

## Coverage and corrections

A partial snapshot supplies valid known observations and explicit extraction issues. It cannot remove or renumber existing selections. A complete snapshot must include independently verified completedPickCount and coverage evidence, not merely a contiguous extracted prefix. The receiver checks both input and final reconciled coverage, preserving observations newer than that snapshot.

Unavailable numbering: report extraction-error and request inspection. Do not pair the Last Pick box with an independently changing current-pick header to manufacture an overall number. Last Pick may request a prompt history observation.

An empty snapshot can mean pre-draft, an explicit reset, or extraction failure. Evidence and correction semantics must distinguish them. Deleting later selections requires a verified correction/reset, not a shorter DOM list or timeout. Keep a recoverable prior state and an explicit correction reason. This policy also covers moves, replacement selections, owner corrections and manual overrides.

## Bidirectional transport and recovery

The page announces readiness only after its receiver is installed. The content script announces readiness to the background only after its page listener/request path is installed. Each destination-session handshake asks for current coverage.

ACK semantics must distinguish received, applied, rejected and applied-in-memory-only. Only acknowledge persisted application after the local store succeeds. A missing page listener is not successful delivery. Rejection carries a reason and needed recovery action. Requests route from Nevisly through the content script/background to the bound Yahoo tab. Replay/retry uses original identities/order; a new request does not make an old cached snapshot newly authoritative.

Use bounded browser-local state, scoped to draft and destination. Clear neither session identity nor ordering on routine refresh/reconnect. An unavailable source or corrupt ordering state requires explicit recovery, not silent counter reset. No backend/database is needed.

## Independent health dimensions

1. Transport: last verified peer contact, pending ACKs, delivery errors.
2. Extraction: supported/partial/failed/unverified, with source evidence and actionable reason.
3. History: covered through N, independently observed completion, missing slots, conflicts, last verified snapshot.
4. Matching: linked/unresolved/ambiguous/goalie counts; unknown projections do not imply transport failure.

Heartbeat proves contact only. Neither heartbeat nor a contiguous prefix proves full history. Projection enrichment cannot change source fingerprints, pick numbers, or authoritative ownership.

## Evidence gate

See YAHOO_CAPTURE_REQUEST.md. Do not lock Yahoo selectors, IDs, overall-pick semantics, completion evidence, or correction detection before reviewing those fixtures. Extension unit/fixture tests and real Firefox acceptance remain outstanding.
