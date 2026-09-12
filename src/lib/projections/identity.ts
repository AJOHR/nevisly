/** Provisional identity until a provider/Yahoo ID is available. Collisions must be rejected, not guessed. */
export function normalizePlayerName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function projectionId(name: string): string { return `projection:${normalizePlayerName(name)}`; }
