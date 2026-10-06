'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {LiveSeasonData} from '@/lib/season/live';
const storageKey='nevisly.season.timezones';
type Preferences={lastLeague?:string;zones:Record<string,string>};
export function validTimeZone(zone:string){try{new Intl.DateTimeFormat('en',{timeZone:zone});return !!zone;}catch{return false;}}
export function readTimeZones():Preferences{
 try{const value=JSON.parse(window.localStorage.getItem(storageKey)??'{}');return {lastLeague:typeof value.lastLeague==='string'?value.lastLeague:undefined,zones:Object.fromEntries(Object.entries(value.zones??{}).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&validTimeZone(entry[1])))};}catch{return {zones:{}};}
}
export function saveTimeZone(league:string,zone:string){
 if(!validTimeZone(zone))throw Error('Enter a valid IANA timezone.');
 const preferences=readTimeZones();preferences.lastLeague=league;preferences.zones[league]=zone;
 try{window.localStorage.setItem(storageKey,JSON.stringify(preferences));return true;}catch{return false;}
}
export function useLiveSeason(live:boolean){
 const [data,setData]=useState<LiveSeasonData|null>(null),[timeZone,setTimeZone]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[needsAuth,setNeedsAuth]=useState(false),[storageWarning,setStorageWarning]=useState('');
 const active=useRef<AbortController|null>(null);
 const refresh=useCallback(async(zone:string,confirmedLeague?:string)=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;
  setBusy(true);setError('');setNeedsAuth(false);setData(null);setConfirmed(false);
  try{
   const response=await fetch(`/api/yahoo/season/live?timeZone=${encodeURIComponent(zone)}`,{cache:'no-store',signal:controller.signal});
   const result=await response.json();if(controller.signal.aborted)return;
   if(response.status===401){setNeedsAuth(true);throw Error(result.error??'Connect Yahoo to load your league.');}
   if(!response.ok||!result.success)throw Error(result.error??'Live Season refresh failed.');
   const saved=readTimeZones().zones[result.league.key];
   const accepted=confirmedLeague===result.league.key||saved===zone;
   // A different selected league must confirm its own calendar before calculations.
   if(confirmedLeague===result.league.key&&!saveTimeZone(result.league.key,zone))setStorageWarning('Timezone confirmed for this visit; local storage is unavailable, so it cannot be remembered.');
   setTimeZone(saved&&confirmedLeague!==result.league.key?saved:zone);setConfirmed(accepted);setData(result);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Live Season refresh failed.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 },[]);
 useEffect(()=>{
  if(!live)return;
  const saved=readTimeZones();const zone=(saved.lastLeague&&saved.zones[saved.lastLeague])||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const timer=setTimeout(()=>void refresh(zone),0);
  return ()=>{clearTimeout(timer);active.current?.abort();};
 },[live,refresh]);
 useEffect(()=>{
  if(!live||!needsAuth)return;
  const retry=()=>refresh(timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
  window.addEventListener('focus',retry);return ()=>window.removeEventListener('focus',retry);
 },[live,needsAuth,timeZone,refresh]);
 return {data,timeZone,setTimeZone,confirmed,setConfirmed,busy,error,needsAuth,storageWarning,refresh};
}
