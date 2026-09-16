/** Maximum-weight matching for roster eligibility (a transversal matroid).
 * Greedy by player weight plus augmenting paths gives a maximum-weight basis;
 * each identity occupies at most one slot, including multi-position players.
 */
export type EligiblePlayer = {id: string; positions: string[]; rawScore: number};
export type ModelSlot = {id: string; position: string};
export const compareIds = (a: {id: string}, b: {id: string}) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function rosterSlots(starters: Readonly<Record<string, number>>, teams = 1): ModelSlot[] {
  return Object.entries(starters).flatMap(([position, count]) =>
    Array.from({length: count * teams}, (_, i) => ({id: `${position}${i + 1}`, position})));
}
export function augment<T extends EligiblePlayer>(player: T, slots: ModelSlot[], assigned: Map<string, T>, visited = new Set<string>()): boolean {
  for (const slot of slots) {
    if (!player.positions.includes(slot.position) || visited.has(slot.id)) continue;
    visited.add(slot.id);
    const existing = assigned.get(slot.id);
    if (!existing || augment(existing, slots, assigned, visited)) {
      assigned.set(slot.id, player);
      return true;
    }
  }
  return false;
}
export function allocate<T extends EligiblePlayer>(players: readonly T[], slots: ModelSlot[]) {
  const assigned = new Map<string, T>();
  const seen = new Set<string>();
  for (const player of [...players].sort((a, b) => b.rawScore - a.rawScore || compareIds(a,b))) {
    if (seen.has(player.id)) continue;
    seen.add(player.id);
    augment(player, slots, assigned);
  }
  return assigned;
}
