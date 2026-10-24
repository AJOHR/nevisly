import { compareIds } from './allocation';
import { modelConfig } from './config';

type Option = {id:string; positions:string[]; vor:number; score:number};
/** Bounded two-selection planning, not a forecast of Yahoo drafting behavior.
 * Opponents follow a supplied market order, excluding our current pick.
 * Search only the top two surviving current-roster options per starter position
 * (at most eight unique players). The callback checks a feasible second upgrade,
 * retaining the first pick, against the same category target/prior.
 * Subtract a common next-pick baseline: this centers timing without counting
 * either deep replacement value or the second player's full VOR twice.
 */
export function prepareDraftOpportunity<T extends Option>(available:readonly T[], opponentSelections:number, eligibleFuture:(p:T)=>boolean=()=>true, demandIds?:readonly string[]) {
  // Legacy order retained only for explicit callers without market data. The live
  // engine always supplies Yahoo order; absent matches are not assumed survivors.
  const ids=demandIds??[...available].sort((a,b)=>b.vor-a.vor||compareIds(a,b)).map(p=>p.id);
  const order=new Map(ids.map((id,i)=>[id,i]));
  const survivors=(start:number)=>available.filter(p=>order.has(p.id)&&order.get(p.id)!>=start&&eligibleFuture(p));
  const baseline=Math.max(0,...survivors(opponentSelections).map(p=>p.score));
  const shortlist=(start:number)=>{
    const remaining=survivors(start).sort((a,b)=>b.score-a.score||compareIds(a,b));
    // Keep one spare because the current selection must be excluded first.
    return Object.keys(modelConfig.starters).map(position=>remaining.filter(p=>p.positions.includes(position)).slice(0,3));
  };
  const lists=[shortlist(opponentSelections),shortlist(opponentSelections+1)];
  const planner=(candidate:T, gain:(future:T)=>number)=>{
    if(opponentSelections===0)return {adjustment:0,alternative:undefined as T|undefined};
    const groups=lists[(order.get(candidate.id)??Infinity)<=opponentSelections?1:0];
    const list=[...new Map(groups.flatMap(group=>group.filter(p=>p.id!==candidate.id).slice(0,2)).map(p=>[p.id,p])).values()];
    let value=0,alternative:T|undefined;
    for(const future of list) {
      if(future.id===candidate.id)continue;
      const improvement=gain(future);
      if(improvement>value+1e-10||(improvement>0&&Math.abs(improvement-value)<=1e-10&&alternative&&compareIds(future,alternative)<0)) {
        value=improvement;alternative=future;
      }
    }
    return {adjustment:value-baseline,alternative};
  };
  return Object.assign(planner,{commonBaseline:baseline});
}


/** Bounded three-own-pick planning.
 * Yahoo market order removes opponents between each own turn. Our selected
 * players are removed before opponent depletion, so taking an early-market
 * player correctly pushes the removal window one player deeper.
 *
 * The second-pick shortlist keeps at most two candidates per starter position;
 * the third keeps one per position. This bounds the search to at most 32
 * second/third paths per current candidate while preserving cross-position
 * alternatives. The supplied gain callback evaluates the real sequential
 * roster state and is responsible for retaining earlier selections.
 */
export function prepareThreePickOpportunity<T extends Option>(
  available:readonly T[],
  firstWait:number,
  secondWait:number,
  eligibleFuture:(p:T)=>boolean=()=>true,
  demandIds?:readonly string[]
) {
  const ids=demandIds??[...available].sort((a,b)=>b.vor-a.vor||compareIds(a,b)).map(p=>p.id);
  const byId=new Map(available.map(p=>[p.id,p]));

  const survivorsAfter=(selected:ReadonlySet<string>,opponents:number)=>{
    let remaining=Math.max(0,opponents);
    const survivors:T[]=[];
    for(const id of ids){
      if(selected.has(id))continue;
      if(remaining>0){remaining--;continue;}
      const player=byId.get(id);
      if(player&&eligibleFuture(player))survivors.push(player);
    }
    return survivors;
  };
  const shortlist=(players:readonly T[],perPosition:number)=>{
    const ordered=[...players].sort((a,b)=>b.score-a.score||compareIds(a,b));
    return [...new Map(Object.keys(modelConfig.starters)
      .flatMap(position=>ordered.filter(p=>p.positions.includes(position)).slice(0,perPosition))
      .map(p=>[p.id,p])).values()];
  };

  // Common centering constants affect displayed urgency magnitude, not ordering.
  // They keep an additional future pick from mechanically inflating every score.
  const baselineSecond=Math.max(0,...shortlist(survivorsAfter(new Set(),firstWait),2).map(p=>p.score));
  const baselineThird=Math.max(0,...shortlist(survivorsAfter(new Set(),firstWait+secondWait),1).map(p=>p.score));

  const commonBaseline=baselineSecond+baselineThird;
  const planner=(candidate:T,gain:(future:T,path:readonly T[])=>number)=>{
    if(firstWait===0)return {adjustment:0,alternatives:[] as T[]};
    const selectedFirst=new Set([candidate.id]);
    const seconds=shortlist(survivorsAfter(selectedFirst,firstWait),2);
    let best=0,bestSecond:T|undefined,bestThird:T|undefined;

    for(const second of seconds){
      const secondGain=gain(second,[candidate]);
      if(secondGain<=0)continue;
      const selectedTwo=new Set([candidate.id,second.id]);
      const thirds=shortlist(survivorsAfter(selectedTwo,firstWait+secondWait),1);
      let thirdGain=0,thirdChoice:T|undefined;
      for(const third of thirds){
        const value=gain(third,[candidate,second]);
        if(value>thirdGain+1e-10 ||
          (value>0&&Math.abs(value-thirdGain)<=1e-10&&thirdChoice&&compareIds(third,thirdChoice)<0)){
          thirdGain=value;thirdChoice=third;
        }
      }
      const total=secondGain+thirdGain;
      if(total>best+1e-10 ||
        (total>0&&Math.abs(total-best)<=1e-10&&bestSecond&&compareIds(second,bestSecond)<0)){
        best=total;bestSecond=second;bestThird=thirdChoice;
      }
    }

    return {
      adjustment:best-commonBaseline,
      alternatives:[bestSecond,bestThird].filter((p):p is T=>!!p),
    };
  };
  return Object.assign(planner,{commonBaseline});
}


/** Near-term tier scarcity at the candidate's eligible positions.
 * This deliberately ignores the eventual league-wide positional fringe.
 * It asks only how much intrinsic value is lost if we wait until our next turn,
 * after the modeled Yahoo market removes opponent selections.
 *
 * Multi-position players use the best surviving option across any eligible
 * position, so extra eligibility never creates an artificial scarcity bonus.
 */
export function prepareNearTermScarcity<T extends Option>(
  available:readonly T[],
  opponentSelections:number,
  demandIds?:readonly string[]
) {
  const ids=demandIds??[...available].sort((a,b)=>b.vor-a.vor||compareIds(a,b)).map(p=>p.id);
  const byId=new Map(available.map(p=>[p.id,p]));
  const order=new Map(ids.map((id,i)=>[id,i]));

  return (candidate:T)=>{
    if(opponentSelections<=0)return {adjustment:0,alternative:undefined as T|undefined};
    // A tier is not lost by waiting when the candidate himself survives. Unknown
    // market identities cannot justify a claimed imminent positional loss either.
    const rank=order.get(candidate.id);
    if(rank===undefined||rank>=opponentSelections)return {adjustment:0,alternative:undefined as T|undefined};
    let remaining=opponentSelections;
    const survivors:T[]=[];
    for(const id of ids){
      if(id===candidate.id)continue;
      if(remaining>0){remaining--;continue;}
      const player=byId.get(id);
      if(player)survivors.push(player);
    }
    const samePosition=survivors
      .filter(p=>p.positions.some(pos=>candidate.positions.includes(pos)))
      .sort((a,b)=>b.vor-a.vor||compareIds(a,b));
    const alternative=samePosition[0];
    if(!alternative)return {adjustment:0,alternative:undefined as T|undefined};
    return {adjustment:Math.max(0,candidate.vor-alternative.vor),alternative};
  };
}

/** Conservative current-pick deferral cost, in existing Value + Fit units.
 * The opportunity gap is best imminent option minus best OTHER survivor, not a
 * positional premium. Cap Timing at -weight*gap rather than adding this to the
 * planner's loss: an already larger acquisition cost is never counted twice.
 * Both absolute ADP and remaining market order must support deferral. The weight
 * is a bounded distance ratio, NOT a survival probability or fitted forecast.
 */
export function prepareMarketDeferral<T extends Option>(
  available:readonly T[],currentPick:number,wait:number,demandIds:readonly string[],
  adps:ReadonlyMap<string,number>
) {
  const order=new Map(demandIds.map((id,i)=>[id,i+1]));
  const known=available.filter(p=>order.has(p.id)&&adps.has(p.id)).map(p=>({id:p.id,score:p.score}));
  const imminent=Math.max(0,...known.filter(p=>order.get(p.id)!<=wait).map(p=>p.score));
  // Only two needed: exclude the candidate without another pool scan per player.
  const survivors=known.filter(p=>order.get(p.id)!>wait)
    .sort((a,b)=>b.score-a.score||compareIds(a,b)).slice(0,2);
  return (candidate:T,timing:number)=>{
    const adp=adps.get(candidate.id),rank=order.get(candidate.id);
    if(wait<=0||adp===undefined||rank===undefined)return {adjustment:0,cost:0};
    const margin=Math.min(adp-(currentPick+wait+1),rank-wait-1);
    if(margin<=0)return {adjustment:0,cost:0};
    const survivor=survivors.find(p=>p.id!==candidate.id);
    // Incomplete alternative coverage does not justify inventing an opportunity gap.
    if(!survivor)return {adjustment:0,cost:0};
    const gap=Math.max(0,imminent-Math.max(0,survivor.score));
    const cost=gap*margin/(margin+wait);
    if(cost<=0)return {adjustment:0,cost:0};
    return {adjustment:Math.min(timing,-cost)-timing,cost};
  };
}
