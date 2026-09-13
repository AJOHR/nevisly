'use client';
import {useEffect,useState} from 'react';
import {useDraftSession,getDraftSessionSnapshot} from '@/hooks/useDraftSession';
import {bindYahooBridge,receiveYahooV2,validOffer,type Offer} from '@/lib/draft/yahooV2';
import {blendSkaterProjections} from '@/lib/projections/blendSkaterProjections';

const request=(message:Record<string,unknown>)=>window.dispatchEvent(new CustomEvent('nevisly-bridge-request-v2',{detail:JSON.stringify(message)}));
export default function YahooBridgePanel(){
  const session=useDraftSession();const [offers,setOffers]=useState<Offer[]>([]);const [error,setError]=useState('');const [clock,setClock]=useState(0);
  const id=session.data.id,stream=session.data.bridge?.stream,update=session.update;
  useEffect(()=>{
    const ready=()=>request({type:'READY_V2',sessionId:id,stream});
    const receive=(event:Event)=>{
      try{
        const raw=JSON.parse((event as CustomEvent<string>).detail);
        if(validOffer(raw)){setOffers(current=>[...current.filter(o=>o.sourceTab!==raw.sourceTab),raw]);return;}
        if(raw?.type==='transport-error'){setError(String(raw.message));return;}
        let status='rejected',reason='Local session update was blocked';
        update(current=>{const result=receiveYahooV2(current,raw,blendSkaterProjections(current.projectionSources));status=result.status;reason=result.reason??'';return result.session;});
        if(status==='rejected'&&reason)setError(reason);else setError('');
        const saved=getDraftSessionSnapshot();
        request({type:'ACK_V2',sessionId:id,stream:raw?.stream,sequence:raw?.sequence,status:saved.warning&&status!=='rejected'?'memory-only':status,reason});
      }catch{setError('Invalid bridge message');}
    };
    window.addEventListener('nevisly-bridge-v2',receive);window.addEventListener('nevisly-bridge-content-ready-v2',ready);ready();
    const timer=window.setInterval(()=>setClock(Date.now()),1000);
    return()=>{window.removeEventListener('nevisly-bridge-v2',receive);window.removeEventListener('nevisly-bridge-content-ready-v2',ready);window.clearInterval(timer);};
  },[id,stream,update]);
  function connect(offer:Offer){
    try{
      if(session.data.draftPicks.length&&!window.confirm('Connect this Yahoo room to the current draft? Conflicting history will require review.'))return;
      let bound=false;
      update(current=>{const next=bindYahooBridge(current,offer);bound=true;return next;});
      if(bound)request({type:'BIND_V2',sessionId:id,sourceTab:offer.sourceTab,stream:offer.stream});
    }catch(e){setError(e instanceof Error?e.message:'Connection failed');}
  }
  const bridge=session.data.bridge;
  return <div className="mb-3 rounded border border-blue-900 p-3 text-sm">
    <strong>Yahoo bridge v2</strong>
    {!bridge&&<><p>Open Yahoo Results → Round by Round, then connect the intended room. Manual drafting remains available.</p>{offers.map(o=><button className="mr-2 mt-2 border p-2" key={o.sourceTab} onClick={()=>connect(o)}>Connect {o.roomPath} · {o.capture.rows.length} observed picks</button>)}</>}
    {bridge&&<>
      <div>Room: {bridge.roomPath}</div>
      <div>Transport: {clock-bridge.lastReceivedAt>6000?'no recent delivery':'receiving'} · Capture age: {bridge.capturedAt?Math.max(0,Math.floor((clock-bridge.capturedAt)/1000))+'s':'unknown'} · Extraction: {bridge.extraction}</div>
      <div>History: {bridge.coverage} · Matching: {session.data.draftPicks.filter(p=>p.resolution==='unresolved'||p.resolution==='ambiguous').length} unresolved · Owner mapping: {session.data.draftPicks.filter(p=>p.fantasyTeamId==='unassigned').length} unresolved</div>
      <p className="text-xs text-zinc-400">Coverage is cross-checked against the observed Yahoo header. It is not a server revision or proof that Yahoo has not changed.</p>
      {bridge.issues.length>0&&<details><summary>{bridge.issues.length} extraction/reconciliation issues</summary><ul>{bridge.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}
      <button className="mr-3 mt-2 underline" onClick={()=>request({type:'REQUEST_V2',sessionId:id})}>Request fresh history</button>
      <button className="mr-3 underline" onClick={()=>{request({type:'DISCONNECT_V2',sessionId:id});update(s=>({...s,bridge:undefined}));}}>Disconnect</button>
      {bridge.pendingFrame&&<button className="text-amber-300 underline" onClick={()=>{
        if(!window.confirm('Replace retained history with this pending Yahoo observation? Verify the current Yahoo history first. Later selections absent from it will be removed.'))return;
        update(current=>{const frame=current.bridge?.pendingFrame;if(!frame)return current;const r=receiveYahooV2(current,JSON.parse(frame),blendSkaterProjections(current.projectionSources),Date.now(),true);if(r.reason)setError(r.reason);return r.session;});
      }}>Reviewed Yahoo correction: apply</button>}
    </>}
    {error&&<p role="alert" className="text-amber-300">{error}</p>}
  </div>;
}
