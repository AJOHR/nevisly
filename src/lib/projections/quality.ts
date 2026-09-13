import type { SkaterProjection } from '@/types/player';
import { normalizePlayerName } from './identity';

export const projectionFields = ['age', 'gp', 'goals', 'assists', 'points', 'ppp', 'sog', 'hits', 'blocks'] as const;
export const requiredProjectionFields = ['goals', 'assists', 'points', 'ppp', 'sog', 'hits', 'blocks'] as const;
export const optionalProjectionFields = ['age', 'gp'] as const;
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

/** Missing age is unknown, not youth; omit the existing age-only adjustment. */
export function projectionAgeAdjustment(player: SkaterProjection) {
  if (!hasProjectionValue(player, 'age')) return 0;
  const age = player.age;
  return age <= 31 ? 0 : age <= 34 ? -0.03 : age <= 36 ? -0.07 : age <= 38 ? -0.12 : -0.18;
}

export function projectionStartMessage(sources: {weight: number; players: SkaterProjection[]}[], rankedCount: number) {
  if (rankedCount > 0) return '';
  const loaded = sources.filter(source => source.players.length > 0);
  if (!loaded.length) return 'Upload a projection CSV to enable recommendations. Manual drafting remains available.';
  if (!loaded.some(source => Number.isFinite(source.weight) && source.weight > 0)) return 'Set at least one loaded projection source to a weight greater than 0%.';
  return 'Projection rows are loaded, but none are ready to rank. Check the diagnostics for missing scoring categories or identity conflicts. Missing age or GP does not block ranking.';
}
