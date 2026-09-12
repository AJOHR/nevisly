import type { DraftPick } from '@/types/draft';

export function nextPickNumber(picks: readonly DraftPick[]): number {
  return picks.reduce((highest, pick) => Math.max(highest, pick.pickNumber), 0) + 1;
}
export function getSnakeTeamIdForPick(pick: number, teams: number): string {
  if (!Number.isSafeInteger(pick) || pick < 1 || !Number.isSafeInteger(teams) || teams < 2) throw new Error('Invalid draft position');
  const round = Math.floor((pick - 1) / teams);
  const offset = (pick - 1) % teams;
  return `team-${round % 2 ? teams - offset : offset + 1}`;
}
/** When on the clock, look past this selection. Otherwise include the current opponent. */
export function getNextTurn(picks: readonly DraftPick[], teams: number, slot: number) {
  if (!Number.isSafeInteger(slot) || slot < 1 || slot > teams) throw new Error('Invalid draft slot');
  const currentPick = nextPickNumber(picks);
  const mine = `team-${slot}`;
  const onClock = getSnakeTeamIdForPick(currentPick, teams) === mine;
  let nextMyPick = currentPick + 1;
  while (getSnakeTeamIdForPick(nextMyPick, teams) !== mine) nextMyPick++;
  const opponentTeamIds: string[] = [];
  for (let pick = currentPick + (onClock ? 1 : 0); pick < nextMyPick; pick++) opponentTeamIds.push(getSnakeTeamIdForPick(pick, teams));
  return { currentPick, currentRound: Math.floor((currentPick - 1) / teams) + 1, onClock, nextMyPick, opponentTeamIds };
}
/** Migrate the legacy view key without inventing external Yahoo identifiers. */
export function withSelectionIdentity(p: DraftPick, sessionId: string): DraftPick {
  const selectionId = p.selectionId ?? `local:${encodeURIComponent(sessionId)}:pick:${p.pickNumber}`;
  const projectionId = p.projectionId ?? ((p.resolution === 'matched' || !p.resolution) ? p.playerId : undefined);
  return {...p, selectionId, projectionId, playerId: projectionId ?? selectionId};
}
export type DraftAction = {type:'record'|'correct'; pick:DraftPick} | {type:'remove'; pickNumber:number} | {type:'undo-last'};
/** Authoritative pick numbers are keys, never array offsets. */
export function draftReducer(picks: DraftPick[], action: DraftAction): DraftPick[] {
  if (action.type === 'undo-last') return picks.filter(p => p.pickNumber !== nextPickNumber(picks) - 1);
  if (action.type === 'remove') return picks.filter(p => p.pickNumber !== action.pickNumber);
  const existing = picks.find(p => p.pickNumber === action.pick.pickNumber);
  const p = withSelectionIdentity({...action.pick, selectionId: existing?.selectionId ?? action.pick.selectionId ?? `local:${crypto.randomUUID()}`}, 'manual');
  if (!Number.isSafeInteger(p.pickNumber) || p.pickNumber < 1 || !p.playerId || !/^team-[1-9]\d*$/.test(p.fantasyTeamId)) return picks;
  if (picks.some(old => old.playerId === p.playerId && old.pickNumber !== p.pickNumber)) return picks;
  if (action.type === 'record' && picks.some(old => old.pickNumber === p.pickNumber)) return picks;
  return [...picks.filter(old => old.pickNumber !== p.pickNumber), p].sort((a,b)=>a.pickNumber-b.pickNumber);
}
