'use client';
import { refreshProjectionLinks } from '@/lib/draft/yahoo';
import { blendSkaterProjections } from '@/lib/projections/blendSkaterProjections';
import { useSyncExternalStore } from 'react';
import { createSessionStore, DEFAULT_SESSION, type Session } from '@/lib/session/session';
const serverSnapshot={data:DEFAULT_SESSION,warning:''};
let store:ReturnType<typeof createSessionStore>|undefined;
function getStore(){if(!store){let storage:Storage;try{storage=window.localStorage;}catch{storage={getItem(){throw new Error('Unavailable');},setItem(){throw new Error('Unavailable');}} as unknown as Storage;}store=createSessionStore(storage);}return store;}
const subscribe=(listener:()=>void)=>getStore().subscribe(listener);
const getSnapshot=()=>getStore().getSnapshot();
const getServerSnapshot=()=>serverSnapshot;
function setField<K extends keyof Session>(key:K,value:Session[K]|((current:Session[K])=>Session[K])){getStore().update(s=>{
 const next={...s,[key]:typeof value==='function'?(value as (v:Session[K])=>Session[K])(s[key]):value};
 return key==='projectionSources' ? refreshProjectionLinks(next,blendSkaterProjections(next.projectionSources)) : next;
});}
function update(change:(s:Session)=>Session){getStore().update(change);}
export function useDraftSession(){
 const snapshot=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
 return {...snapshot,setField,recover:()=>getStore().recover(),update};
}
