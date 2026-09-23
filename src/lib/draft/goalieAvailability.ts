import type { DraftPick } from '@/types/draft';
import type { GoalieProjection } from '@/types/goalie';
import { normalizePlayerName } from '@/lib/projections/identity';

function normalizeTeam(team:string|undefined){
  const key=(team??'').trim().toUpperCase();
  const aliases:Record<string,string>={TB:'TBL',LA:'LAK',NJ:'NJD',SJ:'SJS',WAS:'WSH',CLB:'CBJ',MON:'MTL'};
  return aliases[key]??key;
}

/**
 * Resolve a draft selection against the goalie projection sidecar.
 *
 * Yahoo occasionally omits eligibility from a captured history row. A unique
 * normalized goalie-name match is sufficient to mark that goalie drafted;
 * team is used only to disambiguate duplicate normalized names.
 */
export function matchDraftPickToGoalie<T extends GoalieProjection>(
  pick:DraftPick,
  goalies:readonly T[]
):T|undefined {
  const direct=goalies.find(g=>g.id===pick.playerId||g.id===pick.projectionId);
  if(direct)return direct;

  if(!pick.playerName)return undefined;
  const name=normalizePlayerName(pick.playerName);
  const matches=goalies.filter(g=>normalizePlayerName(g.name)===name);
  if(matches.length===1)return matches[0];
  if(matches.length>1&&pick.nhlTeam){
    const team=normalizeTeam(pick.nhlTeam);
    const teamMatches=matches.filter(g=>normalizeTeam(g.team)===team);
    if(teamMatches.length===1)return teamMatches[0];
  }
  return undefined;
}
