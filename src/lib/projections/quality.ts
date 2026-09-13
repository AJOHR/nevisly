import type { SkaterProjection } from '@/types/player';
import { normalizePlayerName } from './identity';

export const projectionFields = ['age', 'gp', 'goals', 'assists', 'points', 'ppp', 'sog', 'hits', 'blocks'] as const;
export type ProjectionField = (typeof projectionFields)[number];

export function hasProjectionValue(player: SkaterProjection, field: ProjectionField) {
  return !player.missingFields?.includes(field) && Number.isFinite(player[field]) && player[field] >= 0;
}

/** Ignore row IDs and ordering when detecting repeated provider records. */
function signature(player: SkaterProjection) {
  return JSON.stringify([
    player.team, [...player.positions].sort(),
    ...projectionFields.map(field => hasProjectionValue(player, field) ? player[field] : null),
  ]);
}

export function inspectProjectionRows(players: SkaterProjection[]) {
  const groups = new Map<string, SkaterProjection[]>();
  for (const player of players) {
    const key = normalizePlayerName(player.name);
    groups.set(key, [...(groups.get(key) ?? []), player]);
  }
  const accepted: SkaterProjection[] = [];
  const warnings: string[] = [];
  for (const rows of groups.values()) {
    if (rows.length > 1) {
      const conflict = new Set(rows.map(signature)).size > 1;
      warnings.push(`${rows[0].name}: ${conflict ? 'conflicting duplicate identity excluded' : 'duplicate rows counted once'}.`);
      if (conflict) continue;
    }
    accepted.push(rows[0]);
  }
  return { players: accepted, warnings };
}
