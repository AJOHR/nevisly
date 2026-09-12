import type { Session } from '@/lib/session/session';
import type { DraftPick, SyncMetadata } from '@/types/draft';
import { getSnakeTeamIdForPick, nextPickNumber } from './state';
import { normalizePlayerName } from '@/lib/projections/identity';

type Candidate = {id: string; name: string; team: string; positions: string[]};
type YahooPick = {
  pickNumber: number;
  playerName: string;
  nhlTeam: string;
  positions: string[];
  yahooPlayerId?: string;
  fantasyTeamId?: string;
};
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const integer = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
export function normalizeNhlTeam(value: string) {
  const key = value.trim().toUpperCase();
  const aliases: Record<string, string> = {TB:'TBL', LA:'LAK', NJ:'NJD', SJ:'SJS', WAS:'WSH', CLB:'CBJ', MON:'MTL'};
  return aliases[key] ?? key;
}
function readPick(value: unknown, teams: number): YahooPick {
  if (!object(value) || !integer(value.pickNumber) || value.pickNumber < 1 || value.pickNumber > 10000) throw Error('Invalid Yahoo pick number');
  for (const field of ['playerName', 'nhlTeam']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw Error(`Invalid Yahoo ${field}`);
  }
  if (value.positions !== undefined && (!Array.isArray(value.positions) || !value.positions.every(p => typeof p === 'string' && ['C','LW','RW','D','G'].includes(p)))) throw Error('Invalid Yahoo eligibility');
  if (value.yahooPlayerId !== undefined && (typeof value.yahooPlayerId !== 'string' || !value.yahooPlayerId)) throw Error('Invalid Yahoo player ID');
  if (value.fantasyTeamId !== undefined && (typeof value.fantasyTeamId !== 'string' || !/^team-[1-9]\d*$/.test(value.fantasyTeamId) || Number(value.fantasyTeamId.slice(5)) > teams)) throw Error('Invalid Yahoo owner');
  return {
    pickNumber: value.pickNumber,
    playerName: (value.playerName as string | undefined)?.trim() ?? '',
    nhlTeam: normalizeNhlTeam((value.nhlTeam as string | undefined) ?? ''),
    positions: [...new Set((value.positions ?? []) as string[])].sort(),
    yahooPlayerId: value.yahooPlayerId as string | undefined,
    fantasyTeamId: value.fantasyTeamId as string | undefined,
  };
}
// Fingerprints describe source observations, never projection linkage or local UI state.
const fingerprint = (p: YahooPick) => JSON.stringify(p);
export function matchYahooPlayer(pick:Pick<YahooPick,'playerName'|'nhlTeam'>,players:Candidate[]):{player?:Candidate;ambiguous:boolean} {
 const exact=players.filter(p=>normalizePlayerName(p.name)===normalizePlayerName(pick.playerName));
 if(exact.length===1)return {player:exact[0],ambiguous:false}; // Unique full identity survives a trade.
 if(exact.length>1){const team=exact.filter(p=>normalizeNhlTeam(p.team)===normalizeNhlTeam(pick.nhlTeam));return team.length===1?{player:team[0],ambiguous:false}:{ambiguous:true};}
 const parts=pick.playerName.trim().split(/\s+/);const first=parts[0].replace('.','');
 // Fuzzy initials are only allowed when Yahoo actually supplied an initial, never a different full name.
 if(first.length!==1||parts.length<2)return {ambiguous:false};
 const last=normalizePlayerName(parts.slice(1).join(' '));
 const matches=players.filter(p=>{const n=p.name.trim().split(/\s+/);return normalizePlayerName(n[0])[0]===normalizePlayerName(first)&&normalizePlayerName(n.slice(1).join(' '))===last&&normalizeNhlTeam(p.team)===normalizeNhlTeam(pick.nhlTeam);});
 return matches.length===1?{player:matches[0],ambiguous:false}:{ambiguous:matches.length>1};
}
function samePerson(p: YahooPick, old: DraftPick) {
  if (p.yahooPlayerId && old.yahooPlayerId) return p.yahooPlayerId === old.yahooPlayerId;
  return !!p.playerName && normalizePlayerName(p.playerName) === normalizePlayerName(old.playerName ?? '');
}
function legacyConflict(p: YahooPick, old: DraftPick) {
  return !!(
    (p.yahooPlayerId && old.yahooPlayerId && p.yahooPlayerId !== old.yahooPlayerId) ||
    (p.playerName && old.playerName && normalizePlayerName(p.playerName) !== normalizePlayerName(old.playerName)) ||
    (p.nhlTeam && old.nhlTeam && normalizeNhlTeam(p.nhlTeam) !== normalizeNhlTeam(old.nhlTeam)) ||
    (p.fantasyTeamId && p.fantasyTeamId !== old.fantasyTeamId) ||
    (p.positions.length && old.positions?.length && JSON.stringify([...p.positions].sort()) !== JSON.stringify([...old.positions].sort()))
  );
}
function resolve(p: YahooPick, players: Candidate[], session: Session, old?: DraftPick): DraftPick {
  const compatible = old && (samePerson(p, old) || (!p.playerName && !p.yahooPlayerId));
  const playerName = p.playerName || (compatible ? old.playerName : '') || '';
  const nhlTeam = p.nhlTeam || (compatible ? old.nhlTeam : '') || '';
  const positions = p.positions.length ? p.positions : compatible ? old.positions ?? [] : [];
  const mapped = compatible && old.manualProjectionId ? players.find(x => x.id === old.manualProjectionId) : undefined;
  const match = positions.includes('G') ? {ambiguous: false} : mapped ? {player: mapped, ambiguous: false} : matchYahooPlayer({playerName, nhlTeam}, players);
  const selectionId = old?.selectionId ?? `local:${encodeURIComponent(session.id)}:pick:${p.pickNumber}`;
  const projectionId = match.player?.id;
  return {
    selectionId, projectionId, playerId: projectionId ?? selectionId,
    manualProjectionId: mapped?.id,
    pickNumber: p.pickNumber,
    fantasyTeamId: p.fantasyTeamId ?? old?.fantasyTeamId ?? getSnakeTeamIdForPick(p.pickNumber, session.leagueTeams),
    ownershipSource: p.fantasyTeamId ? 'yahoo' : old?.ownershipSource ?? (old?.source === 'manual' ? 'manual' : 'snake-inferred'),
    playerName, nhlTeam, positions,
    yahooPlayerId: p.yahooPlayerId ?? (compatible ? old.yahooPlayerId : undefined),
    source: 'yahoo',
    resolution: positions.includes('G') ? 'goalie' : projectionId ? 'matched' : match.ambiguous ? 'ambiguous' : 'unresolved',
  };
}
function unlinkCollisions(picks: DraftPick[]) {
  const counts = new Map<string, number>();
  for (const p of picks) if (p.projectionId) counts.set(p.projectionId, (counts.get(p.projectionId) ?? 0) + 1);
  return picks.map(p => p.projectionId && counts.get(p.projectionId)! > 1
    ? {...p, projectionId: undefined, playerId: p.selectionId!, manualProjectionId: undefined, resolution: 'ambiguous' as const}
    : p);
}
/** Projection edits are local enrichment, not new source observations/revisions. */
export function refreshProjectionLinks(session: Session, players: Candidate[]): Session {
  const draftPicks = unlinkCollisions(session.draftPicks.map(old => {
    if (old.source !== 'yahoo') return old;
    const linked = resolve({pickNumber: old.pickNumber, playerName: old.playerName ?? '', nhlTeam: old.nhlTeam ?? '', positions: old.positions ?? [], yahooPlayerId: old.yahooPlayerId}, players, session, old);
    return {...linked, ownershipSource: old.ownershipSource};
  }));
  const health = session.sync?.health;
  return {...session, draftPicks, ...(health && session.sync ? {sync: {...session.sync, health: {...health,
    unmatchedSelections: draftPicks.filter(p => p.resolution === 'unresolved' || p.resolution === 'ambiguous').length,
    projectionCollisions: draftPicks.filter(p => p.resolution === 'ambiguous' && !p.projectionId).length,
  }}} : {})};
}
const emptySync: SyncMetadata = {lastSnapshotSequence: -1, pickSequences: {}, status: 'PARTIAL', message: 'Waiting for Yahoo observations', lastReceivedAt: 0};

/** Compatibility receiver. Legacy/v1 cannot attest independent coverage or sender identity. */
export function applyYahooMessage(session: Session, raw: unknown, kind: 'pick' | 'snapshot', players: Candidate[], now = Date.now()): Session {
  const prior = session.sync ?? emptySync;
  const fail = (message: string): Session => ({...session, sync: {
    ...prior, status: 'ERROR', message,
    health: {...(prior.health ?? {lastMessageAt: 0, extraction: 'unverified', unmatchedSelections: 0, projectionCollisions: 0, missingPickNumbers: []}), history: 'conflict'},
  }});
  const replay = (): Session => ({...session, sync: {...prior, lastReceivedAt: now,
    ...(prior.health ? {health: {...prior.health, lastMessageAt: now}} : {}),
  }});
  try {
    const data: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const versioned = object(data) && data.schemaVersion !== undefined;
    let sequence: number | undefined;
    let draftSessionId = prior.draftSessionId;
    let allowRollback = false;
    if (versioned) {
      if (data.schemaVersion !== 1 || typeof data.draftSessionId !== 'string' || !data.draftSessionId || !integer(data.sequence) || data.kind !== kind) throw Error('Invalid bridge envelope');
      if (draftSessionId && draftSessionId !== data.draftSessionId) throw Error('Different Yahoo draft session. Start a new draft explicitly before connecting it.');
      if (kind === 'snapshot' && data.complete !== true) throw Error('v1 snapshot is incomplete; request a complete observation');
      if (data.allowRollback !== undefined && typeof data.allowRollback !== 'boolean') throw Error('Invalid correction flag');
      sequence = data.sequence;
      draftSessionId = data.draftSessionId;
      allowRollback = data.allowRollback === true;
      if (sequence < prior.lastSnapshotSequence) return replay();
    } else if (draftSessionId) return fail('Legacy event ignored after versioned synchronization');

    const values = kind === 'snapshot' ? (versioned ? data.picks : data) : [versioned ? data.pick : data];
    if (!Array.isArray(values) || values.length > 10000) throw Error('Invalid snapshot');
    const incoming = values.map(value => readPick(value, session.leagueTeams)).sort((a,b) => a.pickNumber - b.pickNumber);
    if (new Set(incoming.map(p => p.pickNumber)).size !== incoming.length) throw Error('Duplicate Yahoo pick number');
    const yahooIds = incoming.flatMap(p => p.yahooPlayerId ? [p.yahooPlayerId] : []);
    if (new Set(yahooIds).size !== yahooIds.length) throw Error('Duplicate Yahoo player identity in snapshot');
    if (versioned && kind === 'snapshot' && incoming.some((p,i) => p.pickNumber !== i + 1)) throw Error('Complete snapshot has gaps');
    const snapshotFingerprint = JSON.stringify({picks: incoming, allowRollback});
    if (sequence !== undefined && sequence === prior.lastSnapshotSequence && kind === 'snapshot') {
      if (!prior.lastSnapshotFingerprint) throw Error('Saved snapshot lacks replay evidence; request a newer snapshot');
      if (snapshotFingerprint !== prior.lastSnapshotFingerprint) throw Error('Contradictory snapshot at the same revision');
      return replay();
    }
    const revisions = {...prior.pickSequences};
    const fingerprints = {...prior.pickFingerprints};
    for (const p of incoming) {
      if (sequence !== undefined && revisions[p.pickNumber] === sequence) {
        if (!fingerprints[p.pickNumber]) throw Error('Saved pick lacks replay evidence; request a newer snapshot');
        if (fingerprints[p.pickNumber] !== fingerprint(p)) throw Error('Contradictory pick at the same revision');
      }
    }
    // A pick absent from a snapshot cannot be introduced by replay at that snapshot's revision.
    if (sequence !== undefined && sequence === prior.lastSnapshotSequence && kind === 'pick') {
      if (revisions[incoming[0].pickNumber] === undefined) throw Error('Same-revision pick contradicts snapshot coverage');
      return replay();
    }
    let result = [...session.draftPicks];
    let conflicts = 0;
    if (versioned && kind === 'snapshot') {
      result = result.filter(p => (revisions[p.pickNumber] ?? -1) >= sequence! || (p.pickNumber > incoming.length && !allowRollback));
    }
    for (const p of incoming) {
      if (sequence !== undefined && (revisions[p.pickNumber] ?? -1) > sequence) continue;
      const old = session.draftPicks.find(x => x.pickNumber === p.pickNumber);
      if (sequence === undefined && old && legacyConflict(p, old)) { conflicts++; continue; }
      if (p.yahooPlayerId && result.some(x => x.pickNumber !== p.pickNumber && x.yahooPlayerId === p.yahooPlayerId)) {
        if (versioned) throw Error('Conflicting Yahoo player ownership');
        conflicts++; continue;
      }
      const resolved = resolve(p, players, session, old);
      result = [...result.filter(x => x.pickNumber !== p.pickNumber), resolved];
      if (sequence !== undefined) { revisions[p.pickNumber] = sequence; fingerprints[p.pickNumber] = fingerprint(p); }
    }
    result = unlinkCollisions(result).sort((a,b) => a.pickNumber - b.pickNumber);
    const high = nextPickNumber(result) - 1;
    const represented = new Set(result.map(p => p.pickNumber));
    const missingPickNumbers = Array.from({length: high}, (_,i) => i+1).filter(n => !represented.has(n));
    // Validate the result, not just the input: reconciliation must retain every covered slot.
    if (versioned && kind === 'snapshot' && incoming.some(p => !represented.has(p.pickNumber))) throw Error('Reconciliation failed final coverage validation');
    const suffixRetained = versioned && kind === 'snapshot' && result.some(p => p.pickNumber > incoming.length && (prior.pickSequences[p.pickNumber] ?? -1) <= sequence!);
    const unmatched = result.filter(p => p.resolution === 'unresolved' || p.resolution === 'ambiguous').length;
    const collisions = result.filter(p => p.resolution === 'ambiguous' && !p.projectionId).length;
    return {...session, draftPicks: result, sync: {
      ...prior, draftSessionId, pickSequences: revisions, pickFingerprints: fingerprints,
      lastSnapshotSequence: versioned && kind === 'snapshot' ? sequence! : prior.lastSnapshotSequence,
      lastSnapshotFingerprint: versioned && kind === 'snapshot' ? snapshotFingerprint : prior.lastSnapshotFingerprint,
      lastSnapshotAt: versioned && kind === 'snapshot' ? now : prior.lastSnapshotAt,
      lastReceivedAt: now, status: 'PARTIAL',
      message: conflicts ? `${conflicts} conflicting observations retained; a verified correction is required` : suffixRetained ? 'Short snapshot retained later picks; explicit correction required' : 'Legacy/v1 observations received; Yahoo coverage and extraction remain unverified',
      health: {lastMessageAt: now, extraction: 'unverified', history: conflicts ? 'conflict' : missingPickNumbers.length ? 'gaps' : 'unverified', unmatchedSelections: unmatched, projectionCollisions: collisions, missingPickNumbers},
    }};
  } catch (error) { return fail(error instanceof Error ? error.message : 'Invalid Yahoo data'); }
}
