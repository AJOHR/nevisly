import type { DecisionAssessment } from '@/types/decision';
import type { FinalContext, RankedPlayer } from './legacy';
import { prepareScheduleOpportunity, scheduleFor } from './schedule';
import { getFutureOwnTurns, getNextTurn } from '@/lib/draft/state';
import { hasProjectionValue } from '@/lib/projections/quality';
import { replacementValues } from './replacement';
import { canonicalSelections, prepareCategoryFit, type CategoryFit } from './categoryFit';
import { categories, categoryLabels } from './config';
import { allocate, rosterSlots, compareIds } from './allocation';
import { modelConfig } from './config';
import { rosterSelectionCapacity } from './config';
import { prepareDraftOpportunity, prepareThreePickOpportunity } from './draftOpportunity';
import { defaultMarketSnapshot, prepareMarketDemand, marketTiming, type MarketSnapshot } from './marketDemand';

export type Recommendation = RankedPlayer & {decision: DecisionAssessment; fit: CategoryFit; explanations:string[]};
export const compareRecommendations = (a:RankedPlayer,b:RankedPlayer) => b.score-a.score ||
  (b.score-(b.contributions?.draftOpportunity??0))-(a.score-(a.contributions?.draftOpportunity??0)) || compareIds(a,b);
/** Input is already the canonical recommendation order; filters never renumber. */
export function availableRecommendationRanks(players:readonly RankedPlayer[],draftedIds:ReadonlySet<string>) {
  return new Map(players.filter(p=>!draftedIds.has(p.id)).map((p,i)=>[p.id,i+1]));
}

/** One preparation per state; no per-candidate H2H league recomputation or urgency sorting. */
export function rankRecommendations(context:FinalContext, market = replacementValues(context.rankedPlayers,context.leagueTeams), snapshot:MarketSnapshot=defaultMarketSnapshot):Recommendation[] {
  const selections=canonicalSelections(context.draftPicks);
  const taken=new Set(selections.map(s=>s.projectionId));
  const byId=new Map(context.rankedPlayers.map(p=>[p.id,p]));
  const evaluate=prepareCategoryFit({players:market.ranked,reserves:market.reserves.map(p=>byId.get(p.id)!),market:market.allocated,deviations:market.deviations,selections,teams:context.fantasyTeams});
  const turn=getNextTurn(context.draftPicks,context.leagueTeams,context.myDraftSlot);
  const demand=prepareMarketDemand(context.rankedPlayers,context.draftPicks,snapshot);
  const opponentSelections=turn.opponentTeamIds.length;
  const ownSelections=selections.filter(s=>s.teamId===context.fantasyTeams.find(t=>t.isMyTeam)?.id);
  const ownPlayers=ownSelections.flatMap(s=>byId.get(s.projectionId)?[byId.get(s.projectionId)!]:[]);
  const evaluateSchedule=prepareScheduleOpportunity(market.ranked,context.playoffSchedule,market.deviations);
  const starterSlots=rosterSlots(modelConfig.starters);
  const knownStarters=allocate(ownPlayers,starterSlots).size;
  const starterVacancies=Math.max(0,starterSlots.length-knownStarters);
  const goalieCount=ownSelections.filter(s=>s.positions.includes('G')).length;
  const unknownCount=ownSelections.filter(s=>!byId.has(s.projectionId)&&!s.positions.includes('G')).length;
  const benchUsed=ownPlayers.length-knownStarters+Math.max(0,goalieCount-modelConfig.goalieSlots)+unknownCount;
  const benchAvailable=benchUsed<modelConfig.sharedBenchSlots;
  const recommendations=market.ranked.map((base):Recommendation=>{
    const player=byId.get(base.id)!;
    const fit=evaluate(base);
    const drafted=taken.has(base.id);
    const schedule=scheduleFor(player.team,context.playoffSchedule);
    const scheduleValue=evaluateSchedule(player,fit.beforeRosterIds,fit.rosterIds);
    const scheduleBonus=drafted?0:scheduleValue.adjustment;
    const timing=marketTiming(demand.matches.get(player.id)?.adp,demand.ranks.get(player.id),opponentSelections,turn.nextMyPick);
    const urgency=timing.level;
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
    if(!drafted&&!fit.starterImprovement&&benchAvailable&&starterVacancies===0) {
      contributions.rosterOpportunity=0;
      contributions.categoryFit=0;
      warnings.push('Bench depth ranked by intrinsic VOR after all skater starter slots are filled; no bench playing-time estimate is assumed.');
    } else if(!drafted&&!fit.starterImprovement&&benchAvailable&&starterVacancies>0) {
      warnings.push(`No projected starter upgrade while ${starterVacancies} skater starter slot${starterVacancies===1?' is':'s are'} still open; intrinsic bench value is deferred until the starting lineup is complete.`);
    }
    const playerValue=base.vor;
    const teamFit=contributions.rosterOpportunity+contributions.categoryFit+scheduleBonus;
    const explanations:string[]=[];
    if(fit.replacementNames.length)explanations.push(`Projected starter upgrade over ${fit.replacementNames.join(', ')}`);
    const strongest=categories.map(c=>({c,gain:fit.categories[c]?.productionGain??0})).sort((a,b)=>b.gain-a.gain).filter(x=>x.gain>0).slice(0,2);
    if(strongest.length)explanations.push(`Adds ${strongest.map(x=>categoryLabels[x.c]).join(' + ')} versus the feasible replacement`);
    if(!fit.starterImprovement)explanations.push('Depth option; no projected starter upgrade');
    if(Math.abs(scheduleBonus)>=0.01)explanations.unshift(
      `${scheduleValue.games} games in Yahoo playoff Weeks 24–26; ${scheduleValue.usableStarts} modeled usable starts; ${scheduleBonus>=0?'+':''}${scheduleBonus.toFixed(2)} lineup opportunity versus the feasible starter exchange`
    );
    if(!explanations.length)explanations.push('Compare projected value and uncertainty');
    const decision:DecisionAssessment={playerValue:{score:playerValue},teamFit:{adjustment:teamFit},draftUrgency:{opponentSelections,level:urgency,calibrated:false,adjustment:0},uncertainty:{warnings}};
    return {...player,...base,score:playerValue+teamFit,contributions,decision,fit,explanations,
      needBonus:teamFit,h2hGain:0,scarcityBonus:0,scarcityReasons:[],tierScarcityBonus:0,
      returnRisk:timing.risk,returnProbability:0,
      returnReason:timing.reason,picksUntilNext:opponentSelections,
      scheduleBonus,seasonOffNightGames:schedule?.seasonOffNightGames??0,playoffGames:scheduleValue.games??0,playoffOffNightGames:['24','25','26'].reduce((n,w)=>n+(schedule?.playoffByWeek[w]?.offNightGames??0),0),
      playoffWeekGames:['24','25','26'].map(w=>schedule?.playoffByWeek[w]?.games??0) as [number,number,number],
      playoffWeekOffNights:['24','25','26'].map(w=>schedule?.playoffByWeek[w]?.offNightGames??0) as [number,number,number]};
  });
  // Candidate-now planning requires our current pick. Off clock, the same turn
  // count describes opponents BEFORE our selection, not after a candidate pick.
  // Prefer a bounded three-own-pick path when two future turns remain; fall back
  // to the established two-pick planner near the end of the draft.
  if(turn.onClock&&turn.nextMyPick<=context.leagueTeams*rosterSelectionCapacity&&opponentSelections>0) {
    const available=recommendations.filter(p=>!taken.has(p.id));
    const futureTurns=getFutureOwnTurns(context.draftPicks,context.leagueTeams,context.myDraftSlot,2);
    const thirdTurn=futureTurns[1];
    if(thirdTurn&&thirdTurn.pickNumber<=context.leagueTeams*rosterSelectionCapacity) {
      const plan=prepareThreePickOpportunity(available,opponentSelections,thirdTurn.opponentSelections,p=>p.fit.starterImprovement,demand.ids);
      for(const player of recommendations) {
        if(taken.has(player.id)||!player.fit.starterImprovement)continue;
        const timing=plan(player,(future,path)=>{
          const next=path.length===1
            ? evaluate.afterSelection(future,path[0].id)
            : evaluate.afterSelections(future,path[0].id,path[1].id);
          if(!next?.starterImprovement)return 0;
          const futureSchedule=evaluateSchedule(future,next.beforeRosterIds,next.rosterIds);
          return next.rosterGain+next.saturationAdjustment+futureSchedule.adjustment;
        });
        player.decision.draftUrgency.adjustment=timing.adjustment;
        player.contributions={...player.contributions,draftOpportunity:timing.adjustment};
        player.score+=timing.adjustment;
        if(Math.abs(timing.adjustment)>=0.01)player.explanations.unshift(
          timing.alternatives.length
            ? `Three-pick plan: ${timing.alternatives.map(p=>`${p.name} (${p.positions.join('/')})`).join(' → ')} remain in the modeled path`
            : 'No complementary starter upgrades remain in the modeled three-pick shortlist'
        );
      }
    } else {
      const plan=prepareDraftOpportunity(available,opponentSelections,p=>p.fit.starterImprovement,demand.ids);
      for(const player of recommendations) {
        if(taken.has(player.id)||!player.fit.starterImprovement)continue;
        const timing=plan(player,future=>{
          const next=evaluate.afterSelection(future,player.id);
          if(!next?.starterImprovement)return 0;
          const futureSchedule=evaluateSchedule(future,next.beforeRosterIds,next.rosterIds);
          return next.rosterGain+next.saturationAdjustment+futureSchedule.adjustment;
        });
        player.decision.draftUrgency.adjustment=timing.adjustment;
        player.contributions={...player.contributions,draftOpportunity:timing.adjustment};
        player.score+=timing.adjustment;
        if(Math.abs(timing.adjustment)>=0.01)player.explanations.unshift(timing.alternative?
          `Next-pick plan: ${timing.alternative.name} (${timing.alternative.positions.join('/')}) remains in the modeled pool`:
          'No complementary starter upgrade remains in the modeled next-pick shortlist');
      }
    }
  }
  return recommendations.sort(compareRecommendations);
}
