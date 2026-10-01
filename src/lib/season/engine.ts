import {allocateWeek,type LineupResult,type WeeklyLineup} from './lineup';
import {SKATER_CATEGORIES, type Category, type SeasonLeagueState, type SeasonPlayer, type SkaterCategory} from './state';
export type Outlook = 'Strong'|'Close'|'Swing'|'Behind'|'Unknown';
export function classifyCategory(mine:number|undefined,theirs:number|undefined,unit:number):Outlook {
  if(mine===undefined||theirs===undefined||![mine,theirs,unit].every(Number.isFinite)||unit<=0)return 'Unknown';
  const gap=(mine-theirs)/unit;
  return gap>1?'Strong':gap>=-1?'Close':gap>=-2?'Swing':'Behind';
}
export function matchupRows(state:SeasonLeagueState,lineup:LineupResult=allocateWeek(state)){
  const myRemaining={...state.myTeam.remaining};
  for(const c of SKATER_CATEGORIES)myRemaining[c]=lineup.available?lineup.production?.[c]:undefined;
  const myTeam={...state.myTeam,remaining:myRemaining};
  return state.categories.map(category=>{
    // A ratio is not additive. SV% stays current-only until save/shot denominators exist.
    const finish=(side:SeasonLeagueState['myTeam'])=>category==='SV%'?undefined:
      side.current[category]!==undefined&&side.remaining[category]!==undefined?side.current[category]!+side.remaining[category]!:undefined;
    const mine=finish(myTeam),theirs=finish(state.opponent);
    const projected=mine!==undefined&&theirs!==undefined;
    return {category,mine:state.myTeam.current[category],theirs:state.opponent.current[category],
      mineRemaining:category==='SV%'?undefined:myRemaining[category],
      theirRemaining:category==='SV%'?undefined:state.opponent.remaining[category],mineFinish:mine,theirFinish:theirs,
      basis:projected?'projected finish':'current totals',
      status:classifyCategory(projected?mine:state.myTeam.current[category],projected?theirs:state.opponent.current[category],state.swingUnits[category])};
  });
}
export type Move = {add:SeasonPlayer; drop:SeasonPlayer; weeklyFit:number; rosChange:number; gamesChange:number; delta:Record<SkaterCategory,number>; reasons:string[]; before:WeeklyLineup; after:WeeklyLineup};
// Clamped category-gap utility: -2 (behind) through +1 (comfortable lead).
// Further production beyond the bands adds nothing; changes crossing bands remain visible.
const utility=(gap:number)=>Math.max(-2,Math.min(1,gap));
export function weeklyCategoryImpact(gap:number,change:number,unit:number){return utility(gap+change/unit)-utility(gap);}
export function compareMove(state:SeasonLeagueState,add:SeasonPlayer,drop:SeasonPlayer):Move|null {
 const before=allocateWeek(state);
 return compareWithBaseline(state,add,drop,before,matchupRows(state,before));
}
function compareWithBaseline(state:SeasonLeagueState,add:SeasonPlayer,drop:SeasonPlayer,before:LineupResult,rows:ReturnType<typeof matchupRows>):Move|null {
 if(!state.freeAgents.some(p=>p.id===add.id)||!state.myTeam.roster.some(p=>p.id===drop.id)||add.kind!=='skater'||drop.kind!=='skater')return null;
 if(!Number.isFinite(add.rosValue)||!Number.isFinite(drop.rosValue)||!before.available||!before.production)return null;
 const skaterRows=rows.filter(r=>SKATER_CATEGORIES.includes(r.category as SkaterCategory));
 if(skaterRows.length!==7||skaterRows.some(r=>r.mineFinish===undefined||r.theirFinish===undefined))return null;
 const after=allocateWeek(state,[...state.myTeam.roster.filter(p=>p.id!==drop.id),add]);
 if(!after.available||!after.production)return null;
 const delta={} as Record<SkaterCategory,number>;let weeklyFit=0;
 const reasons:string[]=[];
 for(const row of skaterRows){
  const c=row.category as SkaterCategory,unit=state.swingUnits[c];
  if(!Number.isFinite(unit)||unit<=0)return null;
  const change=after.production[c]-before.production[c];
  delta[c]=change;
  const contribution=weeklyCategoryImpact((row.mineFinish!-row.theirFinish!)/unit,change,unit);
  weeklyFit+=contribution;
  if(contribution>0.05)reasons.push(`${c} is ${row.status.toLowerCase()}: +${change.toFixed(1)}`);
 }
 const gamesChange=after.usable-before.usable;
 const dates=after.players[add.id].dates;
 if(dates.length)reasons.push(`Starts on ${dates.join(', ')}; ${after.players[add.id].scheduled-dates.length} candidate games benched`);
 return {add,drop,delta,weeklyFit,rosChange:add.rosValue!-drop.rosValue!,gamesChange,reasons,before,after};
}
export function seasonMoves(state:SeasonLeagueState):Move[]{
 // Compute the existing roster and category outlook once, not once per candidate/drop pair.
 const before=allocateWeek(state),rows=matchupRows(state,before);
 if(!before.available||!before.production)return [];
 return state.freeAgents.flatMap(add=>{
  const choices=state.myTeam.roster.map(drop=>compareWithBaseline(state,add,drop,before,rows)).filter((m):m is Move=>m!==null);
  choices.sort(compareMoves);return choices.slice(0,1);
 }).sort(compareMoves);
}
function compareMoves(a:Move,b:Move){return b.weeklyFit-a.weeklyFit||b.gamesChange-a.gamesChange||b.rosChange-a.rosChange||a.add.id.localeCompare(b.add.id)||a.drop.id.localeCompare(b.drop.id);}
export function formatSeasonNumber(value:number|undefined,category?:Category){return value===undefined?'—':value.toFixed(category==='SV%'?3:1);}
