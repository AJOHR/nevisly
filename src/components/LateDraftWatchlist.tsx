"use client";
import type { DraftPick } from '@/types/draft';
import { findWatchTargetPick, lateDraftWatchTargets } from '@/lib/draft/lateDraftWatchlist';

export default function LateDraftWatchlist({
  draftPicks,
  myTeamId,
}:{
  draftPicks:DraftPick[];
  myTeamId:string;
}){
  const rows=lateDraftWatchTargets.map(target=>{
    const pick=findWatchTargetPick(target,draftPicks);
    const status=!pick?'AVAILABLE':pick.fantasyTeamId===myTeamId?'MINE':'TAKEN';
    return {target,pick,status};
  });
  const available=rows.filter(r=>r.status==='AVAILABLE').length;

  return <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 p-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Late draft watchlist</div>
        <h2 className="text-lg font-bold">Sleepers / Streamers</h2>
        <p className="mt-1 max-w-2xl text-xs text-zinc-400">Quick availability board only. These tags do not change Nevisly rankings or scores.</p>
      </div>
      <div className="rounded-lg bg-zinc-950 px-3 py-2 text-center">
        <div className="text-[9px] uppercase text-zinc-500">Available</div>
        <div className="font-black">{available}/{rows.length}</div>
      </div>
    </div>

    <div className="overflow-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-zinc-900 text-left text-zinc-400">
          <tr>
            <th className="p-3">Player</th>
            <th className="p-3">Tag</th>
            <th className="p-3">Why</th>
            <th className="p-3">Status</th>
            <th className="p-3">Pick</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({target,pick,status})=>{
            const tagClass=target.tag==='WEEK 1 GOALIE'
              ? 'border-blue-900 text-blue-300'
              : target.tag==='WEEK 1 STREAMER'
                ? 'border-amber-900 text-amber-300'
                : 'border-violet-900 text-violet-300';
            const statusClass=status==='AVAILABLE'
              ? 'text-emerald-400'
              : status==='MINE'
                ? 'text-cyan-300'
                : 'text-red-400';
            const pickLabel=pick
              ? '#'+pick.pickNumber+(pick.ownerName?' · '+pick.ownerName:'')
              : '—';
            return <tr key={target.name} className="border-t border-zinc-800">
              <td className="p-3 font-semibold">{target.name}</td>
              <td className="p-3"><span className={'rounded border px-2 py-1 text-[9px] font-bold '+tagClass}>{target.tag}</span></td>
              <td className="p-3 text-zinc-400">{target.note}</td>
              <td className="p-3"><span className={'font-bold '+statusClass}>{status}</span></td>
              <td className="p-3 text-zinc-500">{pickLabel}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
