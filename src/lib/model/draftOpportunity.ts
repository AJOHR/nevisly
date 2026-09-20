import { compareIds } from './allocation';
import { modelConfig } from './config';

type Option = {id:string; positions:string[]; vor:number; score:number};
/** Bounded two-selection planning, not a forecast of Yahoo drafting behavior.
 * Opponents take the highest intrinsic VOR options, excluding our current pick.
 * Search only the top two surviving current-roster options per starter position
 * (at most eight unique players). The callback checks a feasible second upgrade,
 * retaining the first pick, against the same category target/prior.
 * Subtract a common next-pick baseline: this centers timing without counting
 * either deep replacement value or the second player's full VOR twice.
 */
export function prepareDraftOpportunity<T extends Option>(available:readonly T[], opponentSelections:number, eligibleFuture:(p:T)=>boolean=()=>true) {
  const demand=[...available].sort((a,b)=>b.vor-a.vor||compareIds(a,b));
  const order=new Map(demand.map((p,i)=>[p.id,i]));
  const baseline=Math.max(0,...demand.slice(opponentSelections).filter(eligibleFuture).map(p=>p.score));
  const shortlist=(start:number)=>{
    const survivors=demand.slice(start).filter(eligibleFuture).sort((a,b)=>b.score-a.score||compareIds(a,b));
    // Keep one spare because the current selection must be excluded first.
    return Object.keys(modelConfig.starters).map(position=>survivors.filter(p=>p.positions.includes(position)).slice(0,3));
  };
  const lists=[shortlist(opponentSelections),shortlist(opponentSelections+1)];
  return (candidate:T, gain:(future:T)=>number)=>{
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
}
