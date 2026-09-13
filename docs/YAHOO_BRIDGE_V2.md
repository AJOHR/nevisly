# Yahoo bridge v2 — implemented guarded DOM protocol

This replaces the inactive v2 draft for the supported captured layout. Legacy/v1 ingress is ignored while a local session has a v2 binding. No Yahoo API, server revision, backend or database is required or invented.

## Envelope and selection identity

Observation: `{schemaVersion:2,type:'observation',destinationSessionId,roomPath,stream,sequence,capturedAt,capture}`.

`stream` is an extension-local UUID persisted with the source tab/room. `sequence` is a monotonically increasing local capture counter, incremented only when capture content changes. It is NOT a Yahoo revision. Captures, counter, fingerprint and stream are stored together before delivery; replay retains them. `capturedAt` is extension-local observation time. Repeated identical captures update freshness without changing sequence. A capture counter cannot attest server freshness.

`capture` contains `{rows,issues,coverage,currentPick,round,teamCount}`. Rows preserve explicit `{pickNumber,round,playerName,yahooPlayerId,positions,nhlTeam,ownerName}`. Numeric Yahoo player IDs come from actual .ys-player data-id. Missing descriptive metadata does not erase explicit selections. No Yahoo fantasy-team key is exposed in the fixture, so ownership uses a separately labelled local mapping and preserves raw names.

Nevisly selectionId is local and stable across projection linkage and explicit corrections. projectionId is optional. Projection collisions detach links rather than erase numbered slots. Yahoo eligibility is used for linked selections. The compatibility playerId view key remains for existing recommendation consumers.

## Coverage and changes

A complete capture is cross-checked against a unique current-header pick, actual row contiguity, independently labelled rounds and the observed round-1/round-2 boundary. The receiver revalidates this and final represented coverage. The UI calls it complete-through-header; this is deliberately not a claim of server-certified completeness or freshness.

Partial capture adds/enriches observed slots and preserves retained history. Unsupported layouts preserve all selections and expose issues. Same-sequence replay is idempotent; contradictory content is rejected. Older observations cannot move history backward. Changed identities/ownership or a shorter complete history are quarantined for explicit local review. Only the latest pending complete observation can be accepted using the Reviewed Yahoo correction action. A Boolean on the wire never authorizes removal. Empty/final/reset layouts without adequate evidence remain partial or unsupported.

## Connection and recovery

Events: page -> content `nevisly-bridge-request-v2`; content -> page `nevisly-bridge-v2`; content readiness `nevisly-bridge-content-ready-v2`. Payloads crossing the page boundary are JSON strings.

READY_V2 includes local sessionId and existing stream. Offers identify the source tab/room and observed count. The user explicitly connects the intended room. BIND_V2 ties that source stream to one destination session. Every observation is checked against the binding. A new local draft clears the binding; old-session messages cannot populate it. Source navigation to another room creates a new stream and requires reconnection.

READY messages repeat every two seconds to cover both startup orders and replay the persisted source capture. Yahoo polls history each second and observes relevant DOM mutations. REQUEST_V2 routes to the bound Yahoo content script. Delivery failures are retried through repeated readiness/capture messages. ACK_V2 records applied, replayed, rejected or memory-only application. Tab-message delivery alone is not an application ACK. A stale local tab never acknowledges persisted application when its write was blocked.

The background serializes reads, mutations and writes. It validates sender origin/frame/extension/document and ignores closed/navigated source tabs for replay. See YAHOO_CAPTURE_EVIDENCE.md for remaining same-room reset and source-identity limits.

## Health and deployment

Transport receipt, source capture age, extraction quality, history coverage, unresolved projections and owner mapping are distinct UI indicators. Cached replay does not reset source capture age to now.

The extension is separate from the app source and has no build-time app dependency at runtime. Allowed app targets are production Nevisly and http://localhost:3000. PR previews are intentionally not granted broad wildcard permissions; use the matching app branch locally until the app changes are reviewed and deployed. Disable the old extension before loading v2.
