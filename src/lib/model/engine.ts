import type { DecisionAssessment } from '@/types/decision';
import type { FinalContext, RankedPlayer } from './legacy';
import { prepareScheduleOpportunity, scheduleFor } from './schedule';
import { getNextTurn } from '@/lib/draft/state';
import { hasProjectionValue } from '@/lib/projections/quality';
import { replacementValues } from './replacement';
import { canonicalSelections, prepareCategoryFit, type CategoryFit } from './categoryFit';
import { categories, categoryLabels } from './config';
import { allocate, rosterSlots, compareIds } from './allocation';
import { modelConfig } from './config';

export type Recommendation = RankedPlayer & {decision: DecisionAssessment; fit: CategoryFit; explanations:string[]};
export const compareRecommendations = (a:RankedPlayer,b:RankedPlayer) => b.score-a.score || compareIds(a,b);
/** Input is already the canonical recommendation order; filters never renumber. */
export function availableRecommendationRanks(players:readonly RankedPlayer[],draftedIds:ReadonlySet<string>) {
  return new Map(players.filter(p=>!draftedIds.has(p.id)).map((p,i)=>[p.id,i+1]));
}

/** One preparation per state; no per-candidate H2H league recomputation or urgency sorting. */
export function rankRecommendations(context:FinalContext, market = replacementValues(context.rankedPlayers,context.leagueTeams)):Recommendation[] {
  const selections=canonicalSelections(context.draftPicks);
  const taken=new Set(selections.map(s=>s.projectionId));
  const byId=new Map(context.rankedPlayers.map(p=>[p.id,p]));
  const evaluate=prepareCategoryFit({players:market.ranked,reserves:market.reserves.map(p=>byId.get(p.id)!),market:market.allocated,deviations:market.deviations,selections,teams:context.fantasyTeams});
  const turn=getNextTurn(context.draftPicks,context.leagueTeams,context.myDraftSlot);
  const available=[...market.ranked].filter(p=>!taken.has(p.id)).sort((a,b)=>b.vor-a.vor || compareIds(a,b));
  const ranks=new Map(available.map((p,i)=>[p.id,i+1]));
  const opponentSelections=turn.opponentTeamIds.length;
  const ownSelections=selections.filter(s=>s.teamId===context.fantasyTeams.find(t=>t.isMyTeam)?.id);
  const ownPlayers=ownSelections.flatMap(s=>byId.get(s.projectionId)?[byId.get(s.projectionId)!]:[]);
  const evaluateSchedule=prepareScheduleOpportunity(market.ranked.filter(p=>!taken.has(p.id)),ownPlayers,context.playoffSchedule,market.deviations);
  const knownStarters=allocate(ownPlayers,rosterSlots(modelConfig.starters)).size;
  const goalieCount=ownSelections.filter(s=>s.positions.includes('G')).length;
  const unknownCount=ownSelections.filter(s=>!byId.has(s.projectionId)&&!s.positions.includes('G')).length;
  const benchUsed=ownPlayers.length-knownStarters+Math.max(0,goalieCount-modelConfig.goalieSlots)+unknownCount;
  const benchAvailable=benchUsed<modelConfig.sharedBenchSlots;
  return market.ranked.map((base):Recommendation=>{
    const player=byId.get(base.id)!;
    const fit=evaluate(base);
    const drafted=taken.has(base.id);
    const schedule=scheduleFor(player.team,context.playoffSchedule);
    const scheduleValue=evaluateSchedule(player);
    const scheduleBonus=drafted?0:scheduleValue.adjustment;
    const rank=ranks.get(player.id)??Infinity;
    const urgency=opponentSelections===0?'LOW':rank<=opponentSelections?'HIGH':rank<=opponentSelections*2?'MODERATE':'LOW';
    const warnings=[...fit.warnings];
    if(!scheduleValue.available)warnings.push('Complete playoff schedule unavailable; no schedule adjustment applied.');
    if(!base.replacementAvailable)warnings.push('Market replacement unavailable; VOR is not estimated.');
    if(!hasProjectionValue(player,'age'))warnings.push('Age unknown.');
    else if(player.age>=35)warnings.push('Age 35+: review projection and injury uncertainty; no additional age penalty.');
    if((player.projectionSources??1)<2)warnings.push('Single projection source; agreement cannot be measured.');
    const contributions={replacementValue:base.vor,schedule:scheduleBonus,
      rosterOpportunity:drafted?0:fit.rosterGain-base.vor,
      categoryFit:drafted?0:fit.saturationAdjustment};
    // Unavailable comparable rosters fall back to intrinsic value with a warning.
    if(!drafted&&fit.categories && Object.keys(fit.categories).length===0)contributions.rosterOpportunity=0;
    if(!drafted&&!fit.starterImprovement&&benchAvailable) {
      contributions.rosterOpportunity=0;
      contributions.categoryFit=0;
      warnings.push('Bench depth ranked by intrinsic VOR; no bench playing-time estimate is assumed.');
    }
    const playerValue=base.vor;
    const teamFit=contributions.rosterOpportunity+contributions.categoryFit+scheduleBonus;
    const explanations:string[]=[];
    if(fit.replacementNames.length)explanations.push(`Projected starter upgrade over ${fit.replacementNames.join(', ')}`);
    const strongest=categories.map(c=>({c,gain:fit.categories[c]?.productionGain??0})).sort((a,b)=>b.gain-a.gain).filter(x=>x.gain>0).slice(0,2);
    if(strongest.length)explanations.push(`Adds ${strongest.map(x=>categoryLabels[x.c]).join(' + ')} versus the feasible replacement`);
    if(!fit.starterImprovement)explanations.push('Depth option; no projected starter upgrade');
    if(Math.abs(scheduleBonus)>=0.01)explanations.unshift(`${scheduleValue.games} games in Yahoo playoff Weeks 24–26; ${Math.abs(scheduleValue.extraStarts).toFixed(1)} ${scheduleValue.extraStarts>0?'more':'fewer'} estimated usable starts than available eligible alternatives`);
    if(!explanations.length)explanations.push('Compare projected value and uncertainty');
    const decision:DecisionAssessment={playerValue:{score:playerValue},teamFit:{adjustment:teamFit},draftUrgency:{opponentSelections,level:urgency,calibrated:false},uncertainty:{warnings}};
    return {...player,...base,score:playerValue+teamFit,contributions,decision,fit,explanations,
      needBonus:teamFit,h2hGain:0,scarcityBonus:0,scarcityReasons:[],tierScarcityBonus:0,
      returnRisk:urgency==='HIGH'?'RISKY':urgency==='MODERATE'?'POSSIBLE':'SAFE',returnProbability:0,
      returnReason:`Heuristic: available value rank ${Number.isFinite(rank)?rank:'—'}; ${opponentSelections} opponent selections before your next turn. Not a probability.`,picksUntilNext:opponentSelections,
      scheduleBonus,seasonOffNightGames:schedule?.seasonOffNightGames??0,playoffGames:scheduleValue.games??0,playoffOffNightGames:['24','25','26'].reduce((n,w)=>n+(schedule?.playoffByWeek[w]?.offNightGames??0),0),
      playoffWeekGames:['24','25','26'].map(w=>schedule?.playoffByWeek[w]?.games??0) as [number,number,number],
      playoffWeekOffNights:['24','25','26'].map(w=>schedule?.playoffByWeek[w]?.offNightGames??0) as [number,number,number]};
  }).sort(compareRecommendations);
}
