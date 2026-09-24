"use client";

import { useMemo, useState } from 'react';
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

type SkaterSortKey='score'|'adp'|'player'|'gp'|'goals'|'assists'|'points'|'ppp'|'sog'|'hits'|'blocks'|'off'|'po';
type SortDirection='asc'|'desc';

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
}:{
  label:string;
  column:SkaterSortKey;
  active:SkaterSortKey;
  direction:SortDirection;
  onSort:(column:SkaterSortKey)=>void;
}){
  return <th className="p-2">
    <button type="button" onClick={()=>onSort(column)} className="whitespace-nowrap font-semibold hover:text-white">
      {label}{active===column?(direction==='desc'?' ▼':' ▲'):''}
    </button>
  </th>;
}

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
  const [skaterSortKey,setSkaterSortKey]=useState<SkaterSortKey>('score');
  const [skaterSortDirection,setSkaterSortDirection]=useState<SortDirection>('desc');

  const skaterTargets=availableTargets
    .filter(target=>target.tag!=='WEEK 1 GOALIE')
    .map(target=>({
      target,
      projection:uniqueNameMatch(target.name,skaters),
      market:marketMatches.get(target.name),
    }));

  const sortedSkaterTargets=useMemo(()=>{
    const rows=[...skaterTargets];
    const numeric=(row:(typeof rows)[number],key:SkaterSortKey):number|undefined=>{
      const p=row.projection;
      switch(key){
        case 'score': return p?.score;
        case 'adp': return row.market?.adp;
        case 'gp': return p?.gp;
        case 'goals': return p?.goals;
        case 'assists': return p?.assists;
        case 'points': return p?.points;
        case 'ppp': return p?.ppp;
        case 'sog': return p?.sog;
        case 'hits': return p?.hits;
        case 'blocks': return p?.blocks;
        case 'off': return p?.seasonOffNightGames;
        case 'po': return p?.playoffGames;
        default: return undefined;
      }
    };
    rows.sort((a,b)=>{
      if(skaterSortKey==='player'){
        const cmp=(a.projection?.name??a.target.name).localeCompare(b.projection?.name??b.target.name);
        return skaterSortDirection==='asc'?cmp:-cmp;
      }
      const av=numeric(a,skaterSortKey),bv=numeric(b,skaterSortKey);
      if(av===undefined&&bv===undefined)return a.target.name.localeCompare(b.target.name);
      if(av===undefined)return 1;
      if(bv===undefined)return -1;
      const cmp=av-bv;
      return skaterSortDirection==='asc'?cmp:-cmp;
    });
    return rows;
  },[skaterTargets,skaterSortKey,skaterSortDirection]);

  const sortSkaters=(column:SkaterSortKey)=>{
    if(column===skaterSortKey){
      setSkaterSortDirection(current=>current==='desc'?'asc':'desc');
      return;
    }
    setSkaterSortKey(column);
    setSkaterSortDirection(column==='player'?'asc':'desc');
  };

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
              <SortHeader label="Score" column="score" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="ADP" column="adp" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="Player" column="player" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <th className="p-2">Pos</th>
              <th className="p-2">Team</th>
              <SortHeader label="GP" column="gp" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="G" column="goals" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="A" column="assists" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="P" column="points" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="PPP" column="ppp" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="SOG" column="sog" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="HIT" column="hits" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="BLK" column="blocks" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="OFF" column="off" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
              <SortHeader label="PO" column="po" active={skaterSortKey} direction={skaterSortDirection} onSort={sortSkaters} />
            </tr>
          </thead>
          <tbody>
            {sortedSkaterTargets.map(({target,projection,market})=><tr key={target.name} className="border-t border-zinc-800 hover:bg-zinc-800/40">
              <td className="p-2 font-black tabular-nums text-emerald-400">{projection?projection.score.toFixed(2):'—'}</td>
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
            {!sortedSkaterTargets.length&&<tr><td colSpan={15} className="p-6 text-center text-zinc-500">All skater watchlist targets have been drafted.</td></tr>}
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
