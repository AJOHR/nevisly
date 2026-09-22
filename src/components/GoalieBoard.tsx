"use client";
import { useMemo, useState } from 'react';
import type { DraftPick } from '@/types/draft';
import type { GoalieProjection, RankedGoalie } from '@/types/goalie';
import { rankGoalies, goalieRoleReason } from '@/lib/model/goalies';
import { normalizePlayerName } from '@/lib/projections/identity';

type Props={
  goalies:GoalieProjection[];
  fileName:string;
  draftPicks:DraftPick[];
  myTeamId:string;
  selectedDraftTeamId:string;
  onUpload:(file:File)=>void;
  onDraft:(goalie:RankedGoalie,teamId:string)=>void;
  onUndo:(pick:DraftPick)=>void;
};

export default function GoalieBoard(props:Props){
  const [startersOnly,setStartersOnly]=useState(true);
  const [search,setSearch]=useState('');
  const ranked=useMemo(()=>rankGoalies(props.goalies),[props.goalies]);
  const byName=useMemo(()=>new Map(ranked.map(g=>[normalizePlayerName(g.name),g])),[ranked]);
  const ownerByGoalie=useMemo(()=>{
    const result=new Map<string,{teamId:string;pick:DraftPick}>();
    for(const pick of props.draftPicks){
      let goalie=ranked.find(g=>g.id===pick.playerId);
      if(!goalie && (pick.positions?.includes('G')||pick.resolution==='goalie') && pick.playerName)goalie=byName.get(normalizePlayerName(pick.playerName));
      if(goalie)result.set(goalie.id,{teamId:pick.fantasyTeamId,pick});
    }
    return result;
  },[props.draftPicks,ranked,byName]);

  const myGoalies=[...ownerByGoalie.entries()].flatMap(([id,owner])=>owner.teamId===props.myTeamId?[ranked.find(g=>g.id===id)!]:[]);
  const myClearStarters=myGoalies.filter(g=>g.role==='STARTER').length;
  const filtered=ranked.filter(g=>!ownerByGoalie.has(g.id))
    .filter(g=>!startersOnly||g.role==='STARTER')
    .filter(g=>!search.trim()||`${g.name} ${g.team}`.toLowerCase().includes(search.trim().toLowerCase()));

  if(!props.goalies.length){
    return <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Goalie model</div>
      <h2 className="mt-1 text-lg font-bold">Goalies · W / SV% / SO</h2>
      <p className="mt-2 max-w-3xl text-xs text-zinc-400">Upload your goalie projection CSV. Nevisly keeps goalie scoring separate from skaters and labels projected crease roles as STARTER, TANDEM or BACKUP from projected workload.</p>
      <label className="mt-4 inline-flex cursor-pointer items-center rounded-lg border border-blue-800 px-3 py-2 text-xs font-bold text-blue-300">
        Upload goalie CSV
        <input className="hidden" type="file" accept=".csv" onChange={e=>{const file=e.target.files?.[0];if(file)props.onUpload(file);}} />
      </label>
    </section>;
  }

  return <div className="space-y-3">
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Goalie model</div>
          <h2 className="text-lg font-bold">Need 2 goalies · target clear starters</h2>
          <p className="mt-1 text-xs text-zinc-400">Your roster: {myGoalies.length}/2 goalies · {myClearStarters}/2 projected clear starters. Goalie Value equally weights W, SV% and SO; GP is used for projected role, not as a hidden fourth category.</p>
          {props.fileName&&<p className="mt-1 text-[10px] text-zinc-600">{props.fileName} · {ranked.length} goalies</p>}
        </div>
        <label className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300">
          Replace CSV
          <input className="hidden" type="file" accept=".csv" onChange={e=>{const file=e.target.files?.[0];if(file)props.onUpload(file);}} />
        </label>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {filtered.slice(0,3).map((g,i)=><div key={g.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-start justify-between gap-2">
            <div><div className="text-[9px] font-bold uppercase text-emerald-400">{i===0?'Best available':'Alternative'}</div><div className="font-bold">{g.name}</div><div className="text-xs text-zinc-500">{g.team} · {g.role}</div></div>
            <div className="text-right"><div className="font-black text-emerald-400">{g.score.toFixed(2)}</div><div className="text-[9px] text-zinc-600">goalie value</div></div>
          </div>
          <div className="mt-2 text-xs text-zinc-400">{g.gp} GP · {g.wins} W · {g.svPct.toFixed(3)} SV% · {g.shutouts} SO</div>
          <div className="mt-1 text-[10px] text-zinc-600">{goalieRoleReason(g)}</div>
          <button onClick={()=>props.onDraft(g,props.myTeamId)} className="mt-3 rounded border border-emerald-800 px-2 py-1 text-[10px] font-bold text-emerald-300">MY PICK</button>
        </div>)}
      </div>
    </section>

    <section className="sticky top-[72px] z-30 rounded-xl border border-zinc-800 bg-zinc-900/95 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search goalie..." className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm sm:max-w-sm" />
        <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={startersOnly} onChange={e=>setStartersOnly(e.target.checked)} /> Clear starters only</label>
        <span className="ml-auto text-xs text-zinc-600">{filtered.length} available</span>
      </div>
    </section>

    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="max-h-[720px] overflow-auto">
        <table className="w-full min-w-[800px] text-xs">
          <thead className="sticky top-0 z-20 bg-zinc-900 text-left text-zinc-400"><tr>
            <th className="p-2">Rank</th><th className="p-2">Pick</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Projected role</th><th className="p-2">Value</th><th className="p-2">GP</th><th className="p-2">W</th><th className="p-2">SV%</th><th className="p-2">SO</th>
          </tr></thead>
          <tbody>{filtered.map((g,i)=>{
            const owner=ownerByGoalie.get(g.id);
            return <tr key={g.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
              <td className="p-2 tabular-nums">#{i+1}</td>
              <td className="p-2">{owner?<button onClick={()=>props.onUndo(owner.pick)} className="text-[10px] text-red-400">Undo</button>:<div className="flex gap-1"><button onClick={()=>props.onDraft(g,props.selectedDraftTeamId)} className="rounded border border-blue-800 px-2 py-1 text-[10px] text-blue-300">Draft</button>{props.selectedDraftTeamId!==props.myTeamId&&<button onClick={()=>props.onDraft(g,props.myTeamId)} className="rounded border border-emerald-800 px-2 py-1 text-[10px] text-emerald-300">Mine</button>}</div>}</td>
              <td className="p-2 font-semibold">{g.name}</td><td className="p-2 text-zinc-400">{g.team}</td>
              <td className="p-2"><RoleBadge goalie={g}/></td>
              <td className="p-2 font-black text-emerald-400">{g.score.toFixed(2)}</td>
              <td className="p-2">{g.gp}</td><td className="p-2">{g.wins}</td><td className="p-2">{g.svPct.toFixed(3)}</td><td className="p-2">{g.shutouts}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

function RoleBadge({goalie}:{goalie:RankedGoalie}){
  const cls=goalie.role==='STARTER'?'text-emerald-400 border-emerald-900':goalie.role==='TANDEM'?'text-yellow-400 border-yellow-900':'text-zinc-500 border-zinc-700';
  return <span title={goalieRoleReason(goalie)} className={`whitespace-nowrap rounded border px-2 py-1 text-[9px] font-bold ${cls}`}>{goalie.role}</span>;
}
