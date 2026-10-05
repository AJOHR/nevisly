import {CATEGORIES, normalizeSeasonState, type SeasonLeagueState, type SeasonTeam} from './state';

/** Provider-neutral, normalized observations; omitted collections mean unknown, not empty.
 * Players retain the existing identity contract; adapters omit a roster until it is known.
 * No Nevisly tuning belongs here. This is not a recommendation-ready state.
 */
export type SeasonProviderSnapshot = Partial<Omit<SeasonLeagueState, 'swingUnits'|'myTeam'|'opponent'>> & {
  myTeam?: Partial<SeasonTeam>;
  opponent?: Partial<SeasonTeam>;
};
export type SeasonConfiguration = Pick<SeasonLeagueState, 'swingUnits'>;
export type SeasonComposition =
  | {available:true; state:SeasonLeagueState}
  | {available:false; missing:string[]; errors:string[]};

/** Compose only structurally complete engine input. Optional projections/schedules stay
 * unknown; existing engine guards still determine which calculations are supported.
 * Typed adapter input is normalized here, not raw provider JSON.
 */
export function composeSeasonState(snapshot:SeasonProviderSnapshot, config:Partial<SeasonConfiguration>):SeasonComposition {
  const missing:string[]=[];
  for(const key of ['source','week','leagueTeams','categories','rosterSlots','freeAgents'] as const)
    if(snapshot[key]===undefined)missing.push(key);
  for(const key of ['myTeam','opponent'] as const){
    const team=snapshot[key];
    if(!team){missing.push(key);continue;}
    for(const field of ['id','name','roster','current','remaining'] as const)
      if(team[field]===undefined)missing.push(`${key}.${field}`);
  }
  for(const category of CATEGORIES)
    if(config.swingUnits?.[category]===undefined)missing.push(`swingUnits.${category}`);
  if(missing.length)return {available:false,missing,errors:[]};
  // Required properties were checked above; no defaults or provider tuning are copied in.
  const state={...snapshot,myTeam:snapshot.myTeam as SeasonTeam,opponent:snapshot.opponent as SeasonTeam,
    swingUnits:config.swingUnits} as SeasonLeagueState;
  if(!state.categories.length||!Object.keys(state.rosterSlots).length||
    ![state.myTeam,state.opponent].every(t=>t.id.trim()&&t.name.trim())||
    CATEGORIES.some(c=>!Number.isFinite(state.swingUnits[c])||state.swingUnits[c]<=0))
    return {available:false,missing:[],errors:['Invalid league configuration or team identity']};
  try{return {available:true,state:normalizeSeasonState(state)};}
  catch(error){return {available:false,missing:[],errors:[error instanceof Error?error.message:'Invalid season input']};}
}
