import { legacyFinal, type FinalContext, type RankedPlayer } from './legacy';
import { replacementValues } from './replacement';
import { canonicalSelections, prepareCategoryFit } from './categoryFit';
export function fitStage(context:FinalContext):RankedPlayer[] {
 const market=replacementValues(context.rankedPlayers,context.leagueTeams);
 const fit=prepareCategoryFit({players:context.rankedPlayers,reserves:market.reserves.map(p=>context.rankedPlayers.find(x=>x.id===p.id)!),deviations:market.deviations,market:market.allocated as Map<string,RankedPlayer>,selections:canonicalSelections(context.draftPicks),teams:context.fantasyTeams});
 return legacyFinal(context).map(player=>{
  if(context.draftedIds.has(player.id))return player;
  const assessment=fit(player),contributions={...player.contributions,categoryNeed:0,h2h:0,categoryFit:assessment.adjustment};
  return {...player,needBonus:assessment.adjustment,h2hGain:0,contributions,score:Object.values(contributions).reduce((a,b)=>a+b,0)};
 });
}
