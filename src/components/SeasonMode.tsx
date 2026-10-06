'use client';
import {useMemo,useState} from 'react';
import {manualSeasonFixture} from '@/lib/season/fixture';
import {normalizeSeasonState,SKATER_CATEGORIES,type SeasonLeagueState} from '@/lib/season/state';
import {formatSeasonNumber as fmt,matchupRows,seasonMoves,usableGames} from '@/lib/season/engine';
const tabs=['Dashboard','Matchup','Waivers','Streamers','Lineup','Goalies','Trades','Playoffs'] as const;
type Tab=typeof tabs[number];
const panel='rounded-xl border border-zinc-800 bg-zinc-900 p-4';
const cell='px-3 py-2 text-left whitespace-nowrap';
export default function SeasonMode({state=manualSeasonFixture}:{state?:SeasonLeagueState}){
 const [tab,setTab]=useState<Tab>('Dashboard');
 const league=useMemo(()=>normalizeSeasonState(state),[state]);
 const rows=useMemo(()=>matchupRows(league),[league]);
 const moves=useMemo(()=>seasonMoves(league),[league]);
 const best=moves[0]?.weeklyFit>0?moves[0]:undefined;
 const moveById=new Map(moves.map(m=>[m.add.id,m]));
 const waiverRanks=new Map(moves.map((m,i)=>[m.add.id,i]));
 const waivers=league.freeAgents.filter(p=>p.kind==='skater').sort((a,b)=>(waiverRanks.get(a.id)??Infinity)-(waiverRanks.get(b.id)??Infinity)||a.id.localeCompare(b.id));
 const total=usableGames(league.myTeam.roster.filter(p=>p.kind==='skater'));
 const goalies=league.myTeam.roster.filter(p=>p.kind==='goalie');
 const signed=(n:number)=>`${n>=0?'+':''}${n.toFixed(2)}`;
 const outlook=<div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Matchup category outlook</caption><thead><tr>{['Category','Your current','Their current',...(tab==='Matchup'?['Your remaining','Their remaining']:[]),'Your finish','Their finish','Outlook / basis'].map(t=><th key={t} className={cell}>{t}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.category} className="border-t border-zinc-800"><th className={cell}>{r.category}</th><td className={cell}>{fmt(r.mine,r.category)}</td><td className={cell}>{fmt(r.theirs,r.category)}</td>{tab==='Matchup'&&<><td className={cell}>{fmt(r.mineRemaining,r.category)}</td><td className={cell}>{fmt(r.theirRemaining,r.category)}</td></>}<td className={cell}>{fmt(r.mineFinish,r.category)}</td><td className={cell}>{fmt(r.theirFinish,r.category)}</td><td className={cell}>{r.status} <span className="text-xs text-zinc-400">· {r.basis}</span></td></tr>)}</tbody></table></div>;
 return <main className="min-h-screen bg-zinc-950 text-zinc-100"><div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-6">
  <header><h1 className="text-2xl font-bold">{league.myTeam.name} · Season</h1><p className="text-sm text-emerald-300">League data: {league.source.label} · Week {league.week} · {league.leagueTeams} teams</p><p className="mt-2 text-sm text-amber-200">{league.source.notes}</p><p className="text-xs text-zinc-500">Updated: {league.source.asOf??'Undated manual fixture — not live'}</p></header>
  <nav aria-label="Season navigation" className="flex flex-wrap gap-2">{tabs.map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>setTab(t)} className={`rounded-lg px-3 py-2 text-sm ${tab===t?'bg-emerald-400 text-black':'bg-zinc-800 text-zinc-200'}`}>{t}</button>)}</nav>
  {tab==='Dashboard'&&<>
   <section className={panel}><h2 className="text-lg font-bold">Your Next Move</h2>{best?<><p className="mt-3 font-semibold">ADD {best.add.name} / DROP {best.drop.name}</p><p className="mt-2 text-sm text-zinc-300">{best.reasons.slice(0,2).join(' · ')}</p><p className="mt-2 text-sm">{signed(best.gamesChange)} usable games · ROS value change: {signed(best.rosChange)}</p><p className="mt-2 text-sm">{SKATER_CATEGORIES.map(c=>`${signed(best.delta[c])} ${c}`).join(' / ')}</p><p className="mt-2 text-xs text-zinc-400">Weekly Fit: {best.weeklyFit.toFixed(2)} swing units. Mock comparison, not a live transaction recommendation. Review the ROS tradeoff before acting.</p></>:<p className="mt-2 text-zinc-400">{moves.length?'Hold: no evaluated move improves weekly category fit.':'Insufficient season-state data: need complete skater projections, ROS values, usable games and both teams’ remaining totals.'}</p>}</section>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
    ['Best Add/Drop',best?`${best.add.name} / ${best.drop.name}`:'No supported upgrade'],
    ['Best Streamer','Not enough data — daily lineup optimizer comes next'],
    ['Usable Games',total===undefined?'Not enough data':`${total} remaining skater starts (manual estimate)`],
    ['Goalie Situation',`${goalies.length} rostered: ${goalies.map(p=>p.name).join(', ')}. Starts and remaining ratios unknown.`]
   ].map(([title,body])=><section key={title} className={panel}><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-zinc-400">{body}</p></section>)}</div>
   <section className={panel}><h2 className="mb-3 font-bold">Matchup Outlook · {league.myTeam.name} vs {league.opponent.name}</h2>{outlook}</section>
   <details className={panel}><summary>Your manual roster · {league.myTeam.roster.length} players</summary><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{league.myTeam.roster.map(p=><li key={p.id}>{p.name} · {p.positions.join('/')}</li>)}</ul></details>
  </>}
  {tab==='Matchup'&&<section className={panel}><h2 className="mb-3 font-bold">{league.myTeam.name} vs {league.opponent.name}</h2>{outlook}<p className="mt-3 text-sm text-zinc-400">SV% is current-only; projecting it requires saves and shots faced. Missing remaining goalie totals are not treated as zero.</p></section>}
  {(tab==='Dashboard'||tab==='Matchup')&&<details className={panel}><summary>How to read the outlook</summary><p className="mt-2 text-sm text-zinc-400">Strong: lead greater than one swing unit. Close: within one unit either way. Swing: deficit greater than one and at most two units. Behind: deficit greater than two units. Unknown: missing totals. These are gap bands, not win probabilities.</p><p className="mt-2 text-xs text-zinc-400">Manual swing units: {league.categories.map(c=>`${c} ${league.swingUnits[c]}`).join(' · ')}</p></details>}
  {tab==='Waivers'&&<section className={panel}><h2 className="font-bold">Available skaters · manual/mock ownership</h2><p className="my-3 text-sm text-zinc-400">Sorted by Weekly Fit, then ROS change. Fit sums gains toward close/swing category leads (capped at a one-unit lead) minus all category losses, in the displayed swing units. Same-position swaps only; usable starts are supplied estimates. ROS is separate. Stats below are projected remaining weekly production.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Player','Team','Pos','ROS Value','Weekly Fit','Usable GP',...SKATER_CATEGORIES,'Suggested Drop'].map(h=><th key={h} className={cell}>{h}</th>)}</tr></thead><tbody>{waivers.map(p=>{const move=moveById.get(p.id);return <tr key={p.id} className="border-t border-zinc-800"><th className={cell}>{p.name}</th><td className={cell}>{p.team}</td><td className={cell}>{p.positions.join('/')}</td><td className={cell}>{fmt(p.rosValue)}</td><td className={cell}>{fmt(move?.weeklyFit)}</td><td className={cell}>{fmt(p.usableGames)}</td>{SKATER_CATEGORIES.map(c=><td key={c} className={cell}>{fmt(p.perGame?.[c]!==undefined&&p.usableGames!==undefined?p.perGame[c]!*p.usableGames:undefined)}</td>)}<td className={cell}>{move&&move.weeklyFit>0?move.drop.name:move?'Hold':'Insufficient data'}</td></tr>;})}</tbody></table></div></section>}
  {!['Dashboard','Matchup','Waivers'].includes(tab)&&<section className={panel}><h2 className="font-bold">{tab} · Coming next</h2><p className="mt-2 text-zinc-400">Not implemented in Phase 1. No automated actions or live recommendations.</p></section>}
 </div></main>;
}
