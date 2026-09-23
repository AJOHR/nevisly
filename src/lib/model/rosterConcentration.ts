const TEAM_FREE_SKATERS = 2;
const TEAM_BASE_PENALTY = 0.25;
const TEAM_MAX_PENALTY = 2.5;
const POSITION_BASE_PENALTY = 0.20;
const POSITION_MAX_PENALTY = 1.5;

function normalizeTeam(team:string){
  const key=team.trim().toUpperCase();
  const aliases:Record<string,string>={TB:'TBL',LA:'LAK',NJ:'NJD',SJ:'SJS',WAS:'WSH',CLB:'CBJ',MON:'MTL'};
  return aliases[key]??key;
}
function progressivePenalty(excess:number,base:number,max:number){
  if(excess<=0)return 0;
  return Math.min(max,base*Math.pow(excess,1.5));
}

export type RosterConcentration = {
  adjustment:number;
  teamPenalty:number;
  positionPenalty:number;
  resultingTeamCount:number;
  resultingPurePositionCount:number|null;
  purePosition:string|null;
};

/**
 * Soft roster-construction penalty only. It never changes intrinsic Player Value.
 *
 * NHL-team concentration:
 *   first two skaters from a club are free; later additions rise progressively.
 *
 * Single-position congestion:
 *   a player with exactly one eligible position is penalized only after the
 *   resulting count of pure players at that position exceeds its starter slots.
 *   Multi-position players receive no explicit position-congestion penalty;
 *   their actual lineup usefulness is handled by the allocation model.
 */
type RosterPiece = {team:string; positions:readonly string[]};

export function rosterConcentrationAdjustment(
  candidate:RosterPiece,
  owned:readonly RosterPiece[],
  starters:Readonly<Record<string,number>>
):RosterConcentration {
  const team=normalizeTeam(candidate.team);
  const currentTeamCount=owned.filter(p=>normalizeTeam(p.team)===team).length;
  const resultingTeamCount=currentTeamCount+1;
  const teamPenalty=progressivePenalty(
    resultingTeamCount-TEAM_FREE_SKATERS,
    TEAM_BASE_PENALTY,
    TEAM_MAX_PENALTY
  );

  const purePosition=candidate.positions.length===1?candidate.positions[0]:null;
  let resultingPurePositionCount:number|null=null;
  let positionPenalty=0;
  if(purePosition && starters[purePosition]!==undefined){
    const currentPure=owned.filter(p=>p.positions.length===1&&p.positions[0]===purePosition).length;
    resultingPurePositionCount=currentPure+1;
    positionPenalty=progressivePenalty(
      resultingPurePositionCount-starters[purePosition],
      POSITION_BASE_PENALTY,
      POSITION_MAX_PENALTY
    );
  }

  return {
    adjustment:-(teamPenalty+positionPenalty),
    teamPenalty,
    positionPenalty,
    resultingTeamCount,
    resultingPurePositionCount,
    purePosition,
  };
}
