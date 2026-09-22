import type { BaseRankedPlayer } from './legacy';
import type { SkaterProjection } from '@/types/player';
import type { DraftPick, FantasyTeam } from '@/types/draft';
import { allocate, compareIds, rosterSlots } from './allocation';
import { categories, modelConfig, positionalReplacementWeight, type CategoryValues, type ModelConfig } from './config';
import { categoryUtilityGain } from './categoryUtility';
export { categoryUtilityGain } from './categoryUtility';

/** Only canonical identity, ownership and selection ordinals enter the model.
 * Transport revisions, DOM captures and Yahoo player keys never enter scoring.
 */
export type ModelSelection = {id: string; projectionId: string; teamId: string; ordinal: number; positions: readonly string[]};
export function canonicalSelections(picks: readonly DraftPick[]): ModelSelection[] {
  return picks.map(p=>({id:p.selectionId ?? `pick:${p.pickNumber}`,projectionId:p.projectionId ?? p.playerId,
    teamId:p.fantasyTeamId,ordinal:p.pickNumber,positions:p.positions ?? []}))
    .sort((a,b)=>a.ordinal-b.ordinal || compareIds(a,b));
}
export type FitCategory = {beforeMargin: number; afterMargin: number; productionGain: number; neutralGain:number; positionalNeutralGain:number; overallNeutralGain:number; adjustment: number};
export type CategoryFit = {adjustment: number; rosterGain: number; saturationAdjustment: number; categories: Record<string,FitCategory>; replacementNames: string[]; warnings: string[]; starterImprovement:boolean};
const totals=(players: readonly BaseRankedPlayer[]) => Object.fromEntries(categories.map(c=>[c,players.reduce((sum,p)=>sum+p[c],0)])) as CategoryValues;

export function prepareCategoryFit(input: {
  players: BaseRankedPlayer[]; reserves: BaseRankedPlayer[]; deviations: CategoryValues;
  market: Map<string,SkaterProjection>; selections: ModelSelection[]; teams: FantasyTeam[];
  config?:ModelConfig;
}) {
  const {players,reserves,deviations,market,selections,teams,config=modelConfig}=input;
  const slots=rosterSlots(config.starters),count=slots.length;
  const byId=new Map(players.map(p=>[p.id,p]));
  const myId=teams.find(t=>t.isMyTeam)?.id;
  const owned=selections.filter(p=>p.teamId===myId);
  const own=owned.flatMap(p=>byId.get(p.projectionId) ? [byId.get(p.projectionId)!]:[]);
  const taken=new Set(selections.map(s=>s.projectionId));
  const availableReserves=reserves.filter(p=>!taken.has(p.id));
  const warnings:string[]=[];
  const unresolved=selections.filter(s=>!byId.has(s.projectionId)&&!s.positions.includes('G'));
  if(unresolved.length)warnings.push(`${unresolved.length} selection(s) lack skater projections; roster/category estimates are uncertain.`);
  warnings.push('Seven skater categories only; goalie value and overall matchup probability are not modeled.');
  if(owned.length>=count+config.goalieSlots+config.sharedBenchSlots)warnings.push('All configured roster selections are filled.');
  const meanByPosition=new Map<string,CategoryValues>();
  for(const position of Object.keys(config.starters)) {
    const positionPlayers=[...market].filter(([id])=>id.startsWith(position)&&/^\d+$/.test(id.slice(position.length))).map(([,p])=>p);
    if(!positionPlayers.length)warnings.push(`No market baseline for ${position}.`);
    meanByPosition.set(position,Object.fromEntries(categories.map(c=>[c,positionPlayers.reduce((sum,p)=>sum+p[c],0)/(positionPlayers.length||1)])) as CategoryValues);
  }
  const prior=Object.fromEntries(categories.map(c=>[c,slots.reduce((sum,s)=>sum+(meanByPosition.get(s.position)?.[c]??0),0)])) as CategoryValues;
  const opponentTotals=teams.filter(t=>!t.isMyTeam).sort(compareIds).map(team=>{
    const roster=allocate(selections.filter(s=>s.teamId===team.id).flatMap(s=>byId.get(s.projectionId)?[byId.get(s.projectionId)!]:[]),slots);
    const projected=totals([...roster.values()]);
    for(const slot of slots)if(!roster.has(slot.id))for(const c of categories)projected[c]+=meanByPosition.get(slot.position)?.[c]??0;
    const observedWeight=roster.size/(roster.size+config.opponentPriorSlots);
    return Object.fromEntries(categories.map(c=>[c,prior[c]+observedWeight*(projected[c]-prior[c])])) as CategoryValues;
  });
  const target=Object.fromEntries(categories.map(c=>[c,opponentTotals.length?opponentTotals.reduce((sum,t)=>sum+t[c],0)/opponentTotals.length:prior[c]])) as CategoryValues;
  const base=allocate([...own,...availableReserves],slots);
  const reserveIds=new Set(availableReserves.map(p=>p.id));
  const baseIds=new Set([...base.values()].map(p=>p.id));
  const missingOwn=owned.filter(s=>!byId.has(s.projectionId)&&!s.positions.includes('G')).length;
  const confidence=own.length/(own.length+config.ownPriorSlots+missingOwn*config.unresolvedPriorSlots);
  const lineups=new Map<string,{players:BaseRankedPlayer[]; origin:CategoryValues}>();
  const evaluate=(candidate:BaseRankedPlayer, startingLineup?:BaseRankedPlayer[], retainId?:string, neutralOrigin?:CategoryValues):CategoryFit => {
    // A reserve candidate cannot appear on both sides of its own comparison.
    const before=startingLineup?allocate(startingLineup,slots):reserveIds.has(candidate.id)&&baseIds.has(candidate.id)?allocate([...own,...availableReserves.filter(p=>p.id!==candidate.id)],slots):base;
    const beforePlayers=[...before.values()].sort(compareIds);
    const candidateWarnings=[...warnings];
    if(before.size<count) {
      candidateWarnings.push('Insufficient replacement depth for comparable full rosters; category fit is unavailable.');
      return {adjustment:0,rosterGain:candidate.vor,saturationAdjustment:0,categories:{},replacementNames:[],warnings:candidateWarnings,starterImprovement:false};
    }
    const a=totals(beforePlayers);
    const assess=(afterPlayers:BaseRankedPlayer[])=>{
      const b=totals(afterPlayers);
      const candidateAdded=afterPlayers.some(p=>p.id===candidate.id)&&!beforePlayers.some(p=>p.id===candidate.id);
      let neutral=0,saturation=0;
      const details:Record<string,FitCategory>={};
      for(const c of categories) {
        const scale=deviations[c];
        const beforeMargin=scale?(a[c]-target[c])/scale:0;
        const afterMargin=scale?(b[c]-target[c])/scale:0;
        const productionGain=scale?(b[c]-a[c])/scale:0;
        // Keep the same neutral origin across PR9's two selections, so category
        // utility telescopes rather than awarding saturation headroom twice.
        const neutralMargin=scale&&neutralOrigin?(a[c]-neutralOrigin[c])/scale:0;
        const positionalNeutralGain=categoryUtilityGain(neutralMargin,productionGain,config.categoryWidth);
        const overallNeutralGain=candidateAdded?(candidate.overallValueContributions?.[c]??positionalNeutralGain):0;
        const neutralGain=
          positionalReplacementWeight*positionalNeutralGain+
          (1-positionalReplacementWeight)*overallNeutralGain;
        const utilityGain=categoryUtilityGain(beforeMargin,productionGain,config.categoryWidth);
        // Contextual saturation still measures the real feasible roster exchange.
        // The overall component only damps deep positional replacement scarcity.
        const adjustment=confidence*(utilityGain-positionalNeutralGain)*config.fitWeight;
        neutral+=neutralGain;saturation+=adjustment;
        details[c]={beforeMargin,afterMargin,productionGain,neutralGain,positionalNeutralGain,overallNeutralGain,adjustment};
      }
      return {neutral,saturation,details};
    };
    // Evaluate every feasible one-player exchange, including keeping the lineup.
    // Raw-score allocation alone would reject specialists before category fit
    // could value their contribution to a close category.
    let afterPlayers=beforePlayers;
    let best=assess(beforePlayers);
    for(const replacement of beforePlayers) {
      if(taken.has(candidate.id))break;
      if(replacement.id===retainId||beforePlayers.some(p=>p.id===candidate.id))continue;
      const trialPlayers=[...beforePlayers.filter(p=>p.id!==replacement.id),candidate].sort(compareIds);
      const trial=allocate(trialPlayers,slots);
      if(trial.size!==count||![...trial.values()].some(p=>p.id===candidate.id))continue;
      const assessment=assess(trialPlayers);
      if(assessment.neutral+assessment.saturation>best.neutral+best.saturation+1e-10) {
        afterPlayers=trialPlayers;best=assessment;
      }
    }
    const {neutral,saturation,details}=best;
    const afterIds=new Set(afterPlayers.map(p=>p.id));
    const replacementNames=beforePlayers.filter(p=>!afterIds.has(p.id)).map(p=>p.name);
    const starterImprovement=afterIds.has(candidate.id)&&!taken.has(candidate.id)&&!beforePlayers.some(p=>p.id===candidate.id);
    if(!starterImprovement)candidateWarnings.push('No projected starter upgrade. Bench deployment is unmodeled; assess depth separately.');
    if(!startingLineup)lineups.set(candidate.id,{players:afterPlayers,origin:a});
    return {adjustment:neutral-candidate.vor+saturation,rosterGain:neutral,saturationAdjustment:saturation,categories:details,replacementNames,warnings:candidateWarnings,starterImprovement};
  };
  return Object.assign(evaluate,{afterSelection:(candidate:BaseRankedPlayer,firstId:string)=>{
    const lineup=lineups.get(firstId);
    return lineup?evaluate(candidate,lineup.players,firstId,lineup.origin):undefined;
  }});
}
