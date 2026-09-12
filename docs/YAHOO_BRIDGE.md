# Firefox / Yahoo bridge contract (v1)

The Firefox source is absent and has NOT been modified or verified. Existing DOM CustomEvent names remain supported:

- `nevisly-yahoo-pick`
- `nevisly-yahoo-snapshot`

`detail` may be an object or JSON string. A legacy pick object / snapshot array remains accepted only before v1 binding, conservatively merging non-conflicting records. Legacy snapshots cannot prove freshness, undo history or replace conflicting picks; UI remains PARTIAL. Errors never mean an unknown player did not consume a pick.

## Versioned envelope

```json
{
  "schemaVersion": 1,
  "draftSessionId": "yahoo-league-and-draft-unique-id",
  "sequence": 42,
  "kind": "snapshot",
  "complete": true,
  "picks": [
    {"pickNumber": 1, "playerName": "Example Player", "nhlTeam": "TBL", "positions": ["C"], "yahooPlayerId": "optional-stable-player-key", "fantasyTeamId": "team-1"}
  ]
}
```

For incremental messages use `kind: "pick"` and `pick` instead of `picks`. `sequence` must be monotonic across this draft session, persisted by the extension through reload/reconnect. A snapshot's sequence marks the observation it covers, not the later time it was delivered. The extension must serialize consistent snapshot capture and event observations. Nevisly persists sequence barriers and per-pick revisions.

A complete snapshot includes every pick from 1 through its highest observed pick. Unknowns and goalies still need entries. If the Yahoo DOM cannot be parsed completely, do NOT label the snapshot complete. Request another observation rather than manufacturing missing records.

A new complete snapshot corrects covered pick identities and ownership. A shorter snapshot does not delete later history unless `allowRollback: true` explicitly identifies an authoritative undo/reset. Live events newer than the snapshot's sequence remain preserved. Never use this flag as a workaround for partial DOM extraction.

`fantasyTeamId`, if provided, is the normalized Nevisly team ID based on draft slot, not an arbitrary Yahoo key. The extension must establish that mapping correctly; otherwise omit it and Nevisly uses standard snake ownership. Names alone are not an ownership mapping. `positions` must be actual Yahoo eligibility when supplied.

The first v1 message binds the local session. Another Yahoo draft ID is rejected until the user explicitly starts a new local draft. Legacy messages after v1 binding are rejected. Changing stream identity or resetting sequence numbers is not a transparent reconnect.

Nevisly emits `nevisly-yahoo-request-snapshot` on mount and on user request. The extension should respond with a fresh complete snapshot. Nevisly displays STALE after 30 seconds without accepted/processed observations; extension should send periodic snapshots even between picks. No message listener alone establishes LIVE status. Errors/partial matching remain visible.

## Manual operation and matching

Exact full names are searched globally before initials. Unique full names survive team changes. Initial matching requires a literal initial and a unique name/team candidate. Ambiguous players remain first-class selections and can be explicitly matched in draft history. Goalie/unprojected identity never depends on the skater CSV.

The CustomEvent transport is a same-page integration boundary, not cryptographic authentication. The extension must restrict its content-script origins and bridge delivery. That side requires source review and a Firefox/Yahoo mock draft before claiming end-to-end reliability.
