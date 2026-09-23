import type { DraftPick } from '@/types/draft';
import { normalizePlayerName } from '@/lib/projections/identity';

export type LateDraftWatchTarget = {
  name:string;
  tag:'WEEK 1 STREAMER'|'WEEK 1 GOALIE'|'SLEEPER';
  note:string;
};

export const lateDraftWatchTargets:LateDraftWatchTarget[]=[
  {name:'Gabe Perreault',tag:'WEEK 1 STREAMER',note:'NYR Week 1 schedule'},
  {name:'Devon Levi',tag:'WEEK 1 GOALIE',note:'Week 1 goalie stream'},
  {name:'Tristan Jarry',tag:'WEEK 1 GOALIE',note:'Week 1 goalie stream'},
  {name:'Justin Hryckowian',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Porter Martone',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Matvei Gridin',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Will Smith',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Yegor Chinakhov',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Carter Yakemchuk',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Matvei Michkov',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Luke Hughes',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Bowen Byram',tag:'SLEEPER',note:'Late-round upside'},
  {name:'Dmitry Orlov',tag:'SLEEPER',note:'Late-round upside'},
];

function shortInitialSurname(name:string){
  const parts=name.trim().split(/\s+/);
  if(parts.length<2)return undefined;
  const first=normalizePlayerName(parts[0]).replace(/\./g,'');
  const last=normalizePlayerName(parts.slice(1).join(' '));
  return first.length===1&&last?{initial:first,last}:undefined;
}

function fullInitialSurname(name:string){
  const parts=name.trim().split(/\s+/);
  if(parts.length<2)return undefined;
  const first=normalizePlayerName(parts[0]);
  const last=normalizePlayerName(parts.slice(1).join(' '));
  return first&&last?{initial:first[0],last}:undefined;
}

export function findWatchTargetPick(target:LateDraftWatchTarget,picks:readonly DraftPick[]){
  const targetName=normalizePlayerName(target.name);
  const targetInitial=fullInitialSurname(target.name);
  const exact=picks.filter(p=>p.playerName&&normalizePlayerName(p.playerName)===targetName);
  if(exact.length===1)return exact[0];
  if(exact.length>1)return exact.sort((a,b)=>a.pickNumber-b.pickNumber)[0];

  if(!targetInitial)return undefined;
  const short=picks.filter(p=>{
    if(!p.playerName)return false;
    const pickName=shortInitialSurname(p.playerName);
    return !!pickName&&pickName.initial===targetInitial.initial&&pickName.last===targetInitial.last;
  });
  return short.length===1?short[0]:undefined;
}
