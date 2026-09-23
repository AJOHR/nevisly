"use client";

import { useMemo } from 'react';
import type { DraftPick } from '@/types/draft';
import type { GoalieProjection } from '@/types/goalie';
import type { Recommendation } from '@/lib/model/engine';
import type { MarketSnapshot } from '@/lib/model/marketDemand';
import { matchMarketPlayers } from '@/lib/model/marketDemand';
import { rankGoalies } from '@/lib/model/goalies';
import { normalizePlayerName } from '@/lib/projections/identity';
import { findWatchTargetPick, lateDraftWatchTargets } from '@/lib/draft/lateDraftWatchlist';

function uniqueNameMatch<T extends {name:string}>(name:string,players:readonly T[]){
  const key=normalizePlayerName(name);
  const matches=players.filter(p=>normalizePlayerName(p.name)===key);
  return matches.length===1?matches[0]:undefined;
}

const number=(value:number|undefined,digits=1)=>value===undefined?'—':value.toFixed(digits);

export default function LateDraftWatchlist({
  draftPicks,
  skaters,
  goalies,
  marketSnapshot,
}:{
  draftPicks:DraftPick[];
  skaters:Recommendation[];
  goalies:GoalieProjection[];
  marketSnapshot:MarketSnapshot;
}){
  const availableTargets=useMemo(
    ()=>lateDraftWatchTargets.filter(target=>!findWatchTargetPick(target,draftPicks)),
    [draftPicks]
  );

  const marketMatches=useMemo(
    ()=>matchMarketPlayers(
      lateDraftWatchTargets.map(target=>({id:target.name,name:target.name})),
      marketSnapshot
    ),
    [marketSnapshot]
  );

  const rankedGoalies=useMemo(()=>rankGoalies(goalies),[goalies]);

  const skaterTargets=availableTargets
    .filter(target=>target.tag!=='WEEK 1 GOALIE')
    .map(target=>({
      target,
      projection:uniqueNameMatch(target.name,skaters),
      market:marketMatches.get(target.name),
    }));

  const goalieTargets=availableTargets
    .filter(target=>target.tag==='WEEK 1 GOALIE')
    .map(target=>({
      target,
      projection:uniqueNameMatch(target.name,rankedGoalies),
      market:marketMatches.get(target.name),
    }));

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Late draft watchlist</div>
          <h2 className="text-lg font-bold">Sleeper / streamer skaters</h2>
          <p className="mt-1 text-xs text-zinc-400">Available watchlist players only. Drafted players disappear automatically. This table does not affect Nevisly scoring.</p>
        </div>
        <div className="rounded-lg bg-zinc-950 px-3 py-2 text-center">
          <div className="text-[9px] uppercase text-zinc-500">Available</div>
          <div className="font-black">{skaterTargets.length}</div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1120px] text-xs">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="p-2">ADP</th>
              <th className="p-2">Player</th>
              <th className="p-2">Pos</th>
              <th className="p-2">Team</th>
              <th className="p-2">GP</th>
              <th className="p-2">G</th>
              <th className="p-2">A</th>
              <th className="p-2">P</th>
              <th className="p-2">PPP</th>
              <th className="p-2">SOG</th>
              <th className="p-2">HIT</th>
              <th className="p-2">BLK</th>
              <th className="p-2">OFF</th>
              <th className="p-2">PO</th>
            </tr>
          </thead>
          <tbody>
            {skaterTargets.map(({target,projection,market})=><tr key={target.name} className="border-t border-zinc-800 hover:bg-zinc-800/40">
              <td className="p-2 tabular-nums">{market?market.adp.toFixed(1):'—'}</td>
              <td className="p-2 font-semibold">{projection?.name??target.name}</td>
              <td className="p-2 text-zinc-400">{projection?.positions.join('/')??market?.positions.join('/')??'—'}</td>
              <td className="p-2 text-zinc-400">{projection?.team??market?.team??'—'}</td>
              <td className="p-2 tabular-nums">{number(projection?.gp,0)}</td>
              <td className="p-2 tabular-nums">{number(projection?.goals)}</td>
              <td className="p-2 tabular-nums">{number(projection?.assists)}</td>
              <td className="p-2 tabular-nums">{number(projection?.points)}</td>
              <td className="p-2 tabular-nums">{number(projection?.ppp)}</td>
              <td className="p-2 tabular-nums">{number(projection?.sog)}</td>
              <td className="p-2 tabular-nums">{number(projection?.hits)}</td>
              <td className="p-2 tabular-nums">{number(projection?.blocks)}</td>
              <td className="p-2 tabular-nums">{projection?.seasonOffNightGames??'—'}</td>
              <td className="p-2 tabular-nums">{projection?.playoffGames??'—'}</td>
            </tr>)}
            {!skaterTargets.length&&<tr><td colSpan={14} className="p-6 text-center text-zinc-500">All skater watchlist targets have been drafted.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Week 1 goalie watch</div>
          <h2 className="text-lg font-bold">Goalie streamers</h2>
          <p className="mt-1 text-xs text-zinc-400">Available targets only. Projections come from your uploaded goalie file.</p>
        </div>
        <div className="rounded-lg bg-zinc-950 px-3 py-2 text-center">
          <div className="text-[9px] uppercase text-zinc-500">Available</div>
          <div className="font-black">{goalieTargets.length}</div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="p-2">ADP</th>
              <th className="p-2">Player</th>
              <th className="p-2">Team</th>
              <th className="p-2">Projected role</th>
              <th className="p-2">GP</th>
              <th className="p-2">W</th>
              <th className="p-2">SV%</th>
              <th className="p-2">SO</th>
            </tr>
          </thead>
          <tbody>
            {goalieTargets.map(({target,projection,market})=><tr key={target.name} className="border-t border-zinc-800 hover:bg-zinc-800/40">
              <td className="p-2 tabular-nums">{market?market.adp.toFixed(1):'—'}</td>
              <td className="p-2 font-semibold">{projection?.name??target.name}</td>
              <td className="p-2 text-zinc-400">{projection?.team??market?.team??'—'}</td>
              <td className="p-2 text-zinc-300">{projection?.role??'—'}</td>
              <td className="p-2 tabular-nums">{number(projection?.gp,0)}</td>
              <td className="p-2 tabular-nums">{number(projection?.wins,0)}</td>
              <td className="p-2 tabular-nums">{projection?projection.svPct.toFixed(3):'—'}</td>
              <td className="p-2 tabular-nums">{number(projection?.shutouts,0)}</td>
            </tr>)}
            {!goalieTargets.length&&<tr><td colSpan={8} className="p-6 text-center text-zinc-500">All goalie watchlist targets have been drafted.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
