import type { GoalieProjection, RankedGoalie, GoalieRole } from '@/types/goalie';

function stats(values:number[]){
  const mean=values.reduce((a,b)=>a+b,0)/(values.length||1);
  const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length||1));
  return {mean,sd};
}
const z=(value:number,s:{mean:number;sd:number})=>s.sd?(value-s.mean)/s.sd:0;

export function rankGoalies(players:readonly GoalieProjection[]):RankedGoalie[]{
  const winStats=stats(players.map(p=>p.wins));
  const svStats=stats(players.map(p=>p.svPct));
  const soStats=stats(players.map(p=>p.shutouts));
  const byTeam=new Map<string,GoalieProjection[]>();
  for(const p of players)byTeam.set(p.team,[...(byTeam.get(p.team)??[]),p]);

  return players.map(p=>{
    const peers=[...(byTeam.get(p.team)??[])].sort((a,b)=>b.gp-a.gp||a.name.localeCompare(b.name));
    const leader=peers[0];
    const second=peers.find(q=>q.id!==p.id);
    const totalGp=peers.reduce((n,q)=>n+q.gp,0);
    const workloadShare=totalGp?p.gp/totalGp:0;
    const teamLeadGp=leader?.gp??p.gp;
    const teamGapGp=p.id===leader?.id?p.gp-(second?.gp??0):p.gp-teamLeadGp;
    let role:GoalieRole='BACKUP';
    if(p.id===leader?.id && p.gp>=45 && (p.gp>=50 || teamGapGp>=7 || workloadShare>=0.58))role='STARTER';
    else if(p.gp>=35 && (p.id===leader?.id || workloadShare>=0.42))role='TANDEM';

    const zWins=z(p.wins,winStats),zSvPct=z(p.svPct,svStats),zShutouts=z(p.shutouts,soStats);
    return {...p,zWins,zSvPct,zShutouts,score:zWins+zSvPct+zShutouts,role,workloadShare,teamLeadGp,teamGapGp};
  }).sort((a,b)=>b.score-a.score||b.gp-a.gp||a.name.localeCompare(b.name));
}

export function goalieRoleReason(goalie:RankedGoalie){
  if(goalie.role==='STARTER')return `Projected clear No. 1: ${goalie.gp} GP, ${Math.round(goalie.workloadShare*100)}% of listed team goalie workload`;
  if(goalie.role==='TANDEM')return `Projected shared crease: ${goalie.gp} GP, ${Math.round(goalie.workloadShare*100)}% of listed team goalie workload`;
  return `Projected backup/depth workload: ${goalie.gp} GP, ${Math.round(goalie.workloadShare*100)}% of listed team goalie workload`;
}
