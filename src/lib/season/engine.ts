import {SKATER_CATEGORIES, type Category, type SeasonLeagueState, type SeasonPlayer, type SkaterCategory} from './state';
export type Outlook = 'Strong'|'Close'|'Swing'|'Behind'|'Unknown';
export function classifyCategory(mine:number|undefined,theirs:number|undefined,unit:number):Outlook {
  if(mine===undefined||theirs===undefined||![mine,theirs,unit].every(Number.isFinite)||unit<=0)return 'Unknown';
  const gap=(mine-theirs)/unit;
  return gap>1?'Strong':gap>=-1?'Close':gap>=-2?'Swing':'Behind';
}
export function matchupRows(state:SeasonLeagueState){
  return state.categories.map(category=>{
    // A ratio is not additive. SV% stays current-only until save/shot denominators exist.
    const finish=(side:SeasonLeagueState['myTeam'])=>category==='SV%'?undefined:
      side.current[category]!==undefined&&side.remaining[category]!==undefined?side.current[category]!+side.remaining[category]!:undefined;
    const mine=finish(state.myTeam),theirs=finish(state.opponent);
    const projected=mine!==undefined&&theirs!==undefined;
    return {category,mine:state.myTeam.current[category],theirs:state.opponent.current[category],
      mineRemaining:category==='SV%'?undefined:state.myTeam.remaining[category],
      theirRemaining:category==='SV%'?undefined:state.opponent.remaining[category],mineFinish:mine,theirFinish:theirs,
      basis:projected?'projected finish':'current totals',
      status:classifyCategory(projected?mine:state.myTeam.current[category],projected?theirs:state.opponent.current[category],state.swingUnits[category])};
  });
}
export type Move = {add:SeasonPlayer; drop:SeasonPlayer; weeklyFit:number; rosChange:number; gamesChange:number; delta:Record<SkaterCategory,number>; reasons:string[]};
const complete=(p:SeasonPlayer)=>p.kind==='skater'&&p.usableGames!==undefined&&p.rosValue!==undefined&&SKATER_CATEGORIES.every(c=>p.perGame?.[c]!==undefined);
/** Conservative Phase 1 comparison: same-position swaps using supplied usable games.
 * Weekly fit = sum of gap-limited gains in Close/Swing categories, in stated swing units.
 * Losses in other categories still count. ROS is separate, used only to break weekly-fit ties.
 */
export function compareMove(state:SeasonLeagueState,add:SeasonPlayer,drop:SeasonPlayer):Move|null {
  if(!state.freeAgents.some(p=>p.id===add.id)||!state.myTeam.roster.some(p=>p.id===drop.id)||!complete(add)||!complete(drop))return null;
  if(!add.positions.some(p=>drop.positions.includes(p)&&state.rosterSlots[p]>0))return null;
  const rows=matchupRows(state).filter(r=>SKATER_CATEGORIES.includes(r.category as SkaterCategory));
  if(rows.length!==7||rows.some(r=>r.mineFinish===undefined||r.theirFinish===undefined))return null;
  const delta={} as Record<SkaterCategory,number>;let weeklyFit=0;
  const reasons:string[]=[];
  for(const row of rows){
    const c=row.category as SkaterCategory,unit=state.swingUnits[c];
    const change=add.perGame![c]!*add.usableGames!-drop.perGame![c]!*drop.usableGames!;
    delta[c]=change;
    const gap=(row.mineFinish!-row.theirFinish!)/unit;
    const useful=row.status==='Close'||row.status==='Swing';
    const gain=change/unit;
    const contribution=gain<0?gain:useful?Math.min(gain,Math.max(0,1-gap)):0;
    weeklyFit+=contribution;
    if(contribution>0.05)reasons.push(`${c} is ${row.status.toLowerCase()}: +${change.toFixed(1)}`);
  }
  return {add,drop,delta,weeklyFit,rosChange:add.rosValue!-drop.rosValue!,gamesChange:add.usableGames!-drop.usableGames!,reasons};
}
export function seasonMoves(state:SeasonLeagueState):Move[]{
  return state.freeAgents.flatMap(add=>{
    const choices=state.myTeam.roster.map(drop=>compareMove(state,add,drop)).filter((m):m is Move=>m!==null);
    choices.sort(compareMoves);return choices.slice(0,1);
  }).sort(compareMoves);
}
function compareMoves(a:Move,b:Move){return b.weeklyFit-a.weeklyFit||b.rosChange-a.rosChange||a.add.id.localeCompare(b.add.id)||a.drop.id.localeCompare(b.drop.id);}
export function usableGames(players:SeasonPlayer[]):number|undefined {
  return players.every(p=>p.usableGames!==undefined)?players.reduce((n,p)=>n+p.usableGames!,0):undefined;
}
export function formatSeasonNumber(value:number|undefined,category?:Category){return value===undefined?'—':value.toFixed(category==='SV%'?3:1);}
