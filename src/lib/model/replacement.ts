import type { SkaterProjection } from '@/types/player';
import { DEFAULT_LEAGUE_TEAMS } from '@/lib/league';
import { hasProjectionValue } from '@/lib/projections/quality';
import type { BaseRankedPlayer } from './legacy';
import { allocate, augment, compareIds, rosterSlots } from './allocation';
import { categories, modelConfig, type CategoryValues, type ModelConfig } from './config';

export function normalizeProjections(players: SkaterProjection[], config: ModelConfig = modelConfig, leagueTeams = DEFAULT_LEAGUE_TEAMS) {
  const eligible = players.filter(p => !p.positions.includes('G') &&
    p.positions.some(pos => (config.starters[pos] ?? 0) > 0) && categories.every(c => hasProjectionValue(p,c)));
  // A points-only cutoff under-samples low-point roster roles (especially D),
  // biasing the scale of BLK/HIT before replacement is even calculated. Keep
  // the historical reference depth per team, sampling feasible unique slots.
  const referenceSize = Math.round(config.normalizationPool * leagueTeams / DEFAULT_LEAGUE_TEAMS);
  const perRoster = Object.values(config.starters).reduce((sum,n)=>sum+n,0);
  const quotas = Object.entries(config.starters).map(([position,n])=>({position,quota:referenceSize*n/perRoster}));
  const referenceCounts = Object.fromEntries(quotas.map(q=>[q.position,Math.floor(q.quota)]));
  const remainder = referenceSize-Object.values(referenceCounts).reduce((sum,n)=>sum+n,0);
  quotas.sort((a,b)=>(b.quota%1)-(a.quota%1)||compareIds({id:a.position},{id:b.position}));
  for(const q of quotas.slice(0,remainder))referenceCounts[q.position]++;
  const referenceSlots = rosterSlots(referenceCounts);
  const pool = [...allocate(eligible.map(p=>({...p,rawScore:p.points})),referenceSlots).values()].sort(compareIds);
  const means = {} as CategoryValues, deviations = {} as CategoryValues;
  for (const c of categories) {
    means[c] = pool.reduce((sum,p)=>sum+p[c],0)/(pool.length || 1);
    deviations[c] = Math.sqrt(pool.reduce((sum,p)=>sum+(p[c]-means[c])**2,0)/(pool.length || 1));
  }
  const ranked = [...eligible].sort(compareIds).map(p => {
    const zScores = {} as CategoryValues;
    for (const c of categories) zScores[c] = deviations[c] ? (p[c]-means[c])/deviations[c] : 0;
    return {...p, zScores, rawScore:categories.reduce((sum,c)=>sum+zScores[c],0)};
  });
  return {ranked, means, deviations, referenceSize:pool.length, excluded: players.length-eligible.length};
}

/** Replacement is an actual exchange in one league-wide allocated roster, not
 * four independently counted eligibility pools. Never use the candidate as its
 * own replacement. An undersized pool reports unavailable replacement explicitly.
 */
export function replacementValues(players: SkaterProjection[], leagueTeams: number, config: ModelConfig = modelConfig) {
  const normalized = normalizeProjections(players,config,leagueTeams);
  const slots = rosterSlots(config.starters,leagueTeams);
  const assigned = allocate(normalized.ranked,slots);
  const selected = [...assigned.values()];
  const selectedIds = new Set(selected.map(p=>p.id));
  const reserves = normalized.ranked.filter(p=>!selectedIds.has(p.id)).sort((a,b)=>b.rawScore-a.rawScore || compareIds(a,b));
  const thresholds = [...selected].sort((a,b)=>a.rawScore-b.rawScore || compareIds(a,b));
  const ranked: (BaseRankedPlayer & {replacementId?:string; replacementAvailable:boolean})[] = normalized.ranked.map(player => {
    let replacement: typeof player | undefined;
    let position = player.positions.find(p=>(config.starters[p]??0)>0) ?? '—';
    if(selectedIds.has(player.id)) {
      const without = new Map([...assigned].filter(([,p])=>p.id!==player.id));
      const originalSlot = slots.find(s=>assigned.get(s.id)?.id===player.id);
      position=originalSlot?.position ?? position;
      for(const reserve of reserves) {
        if(augment(reserve,slots,new Map(without))) {replacement=reserve;break;}
      }
    } else {
      // Minimum-cost feasible starter exchange defines the entry threshold.
      for(const starter of thresholds) {
        const without = new Map([...assigned].filter(([,p])=>p.id!==starter.id));
        const trial = new Map(without);
        if(augment(player,slots,trial)) {
          replacement=starter;
          position=slots.find(s=>trial.get(s.id)?.id===player.id)?.position ?? position;
          break;
        }
      }
    }
    return {...player,vor:replacement ? player.rawScore-replacement.rawScore : 0,
      replacementPosition:position,replacementId:replacement?.id,replacementAvailable:!!replacement};
  });
  return {...normalized, ranked, allocated:assigned, reserves};
}
