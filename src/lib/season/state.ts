/** Normalized season input. Adapters supply projections and usable starts; no provider types. */
export const SKATER_CATEGORIES = ['G','A','P','PPP','SOG','HIT','BLK'] as const;
export const CATEGORIES = [...SKATER_CATEGORIES,'W','SV%','SO'] as const;
export type SkaterCategory = typeof SKATER_CATEGORIES[number];
export type Category = typeof CATEGORIES[number];
export type Totals = Partial<Record<Category, number>>;
export type SeasonPlayer = {
  id: string; name: string; team: string; positions: string[];
  kind: 'skater' | 'goalie';
  /** Expected usable starts, supplied by manual state or a future lineup adapter. */
  usableGames?: number;
  perGame?: Partial<Record<SkaterCategory,number>>;
  /** Comparable ROS utility supplied by an adapter, never calculated from weekly fit. */
  rosValue?: number;
};
export type SeasonTeam = {id:string; name:string; roster:SeasonPlayer[]; current:Totals; remaining:Totals};
export type SeasonLeagueState = {
  source: {kind:'manual'|'mock'|'provider'; label:string; asOf:string|null; notes:string};
  week:number; leagueTeams:number;
  categories:Category[];
  rosterSlots:Record<string,number>;
  /** One meaningful weekly increment per category; explicit manual configuration, not probability. */
  swingUnits:Record<Category,number>;
  myTeam:SeasonTeam; opponent:SeasonTeam; freeAgents:SeasonPlayer[];
};
const nonnegative=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const cleanTotals=(totals:Totals):Totals=>Object.fromEntries(CATEGORIES.flatMap(c=>nonnegative(totals[c])&&(c!=='SV%'||totals[c]!<=1)?[[c,totals[c]]]:[]));
/** Copies inputs; invalid/missing numeric observations stay unknown, never become zero. */
export function normalizeSeasonState(input:SeasonLeagueState):SeasonLeagueState {
  if(!Number.isInteger(input.week)||input.week<1||!Number.isInteger(input.leagueTeams)||input.leagueTeams<2)throw Error('Invalid season week or league size');
  for(const c of input.categories)if(!CATEGORIES.includes(c)||!nonnegative(input.swingUnits[c])||input.swingUnits[c]===0)throw Error('Invalid category or swing unit');
  const seen=new Set<string>();
  const player=(p:SeasonPlayer):SeasonPlayer=>{
    if(!p.id.trim()||seen.has(p.id)||!p.name.trim())throw Error('Missing or duplicate season player identity');
    seen.add(p.id);
    return {...p,name:p.name.trim(),positions:[...new Set(p.positions.map(s=>s.trim().toUpperCase()).filter(Boolean))],
      usableGames:nonnegative(p.usableGames)?p.usableGames:undefined,
      rosValue:typeof p.rosValue==='number'&&Number.isFinite(p.rosValue)?p.rosValue:undefined,
      perGame:Object.fromEntries(SKATER_CATEGORIES.flatMap(c=>nonnegative(p.perGame?.[c])?[[c,p.perGame![c]]]:[]))};
  };
  const team=(t:SeasonTeam):SeasonTeam=>({...t,roster:t.roster.map(player),current:cleanTotals(t.current),remaining:cleanTotals(t.remaining)});
  return {...input,source:{...input.source},categories:[...input.categories],rosterSlots:{...input.rosterSlots},swingUnits:{...input.swingUnits},myTeam:team(input.myTeam),opponent:team(input.opponent),freeAgents:input.freeAgents.map(player)};
}
