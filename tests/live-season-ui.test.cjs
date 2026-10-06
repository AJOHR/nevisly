const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),fs=require('node:fs'),ts=require('typescript');
const {load}=require('./load.cjs');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const hook=load('src/hooks/useLiveSeason.ts');
function harness(){
 const original={useState:React.useState,useRef:React.useRef,useCallback:React.useCallback,useEffect:React.useEffect,window:global.window,fetch:global.fetch};
 const values=[],effects=[],listeners={},storage=new Map();let index=0;
 React.useState=initial=>{const i=index++;if(!(i in values))values[i]=initial;return [values[i],v=>values[i]=v];};
 React.useRef=initial=>{const i=index++;return values[i]??(values[i]={current:initial});};
 React.useCallback=f=>f;React.useEffect=f=>effects.push(f);
 global.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},addEventListener:(k,f)=>listeners[k]=f,removeEventListener:k=>delete listeners[k]};
 return {storage,listeners,effects,render:(live=true)=>{index=0;return hook.useLiveSeason(live);},restore:()=>{Object.assign(React,{useState:original.useState,useRef:original.useRef,useCallback:original.useCallback,useEffect:original.useEffect});global.window=original.window;global.fetch=original.fetch;}};
}
const payload=key=>({success:true,league:{key,name:'Real league'},snapshot:{},facts:{},scheduleErrors:{},schedules:{}});
test('opening live mode automatically fetches; first use requires league-specific confirmation; saved visits reuse it',async()=>{
 const h=harness();let calls=[];global.fetch=async url=>{calls.push(url);return {ok:true,status:200,json:async()=>payload('nhl.l.1')};};
 try{h.render();h.effects[0]();await new Promise(r=>setTimeout(r,10));let state=h.render();assert.equal(calls.length,1);assert.equal(state.confirmed,false);assert.ok(state.timeZone);
  await state.refresh('America/Vancouver','nhl.l.1');state=h.render();assert.equal(state.confirmed,true);assert.equal(hook.readTimeZones().zones['nhl.l.1'],'America/Vancouver');
  await state.refresh('America/Vancouver');assert.equal(h.render().confirmed,true);
  global.fetch=async()=>({ok:true,status:200,json:async()=>payload('nhl.l.2')});await state.refresh('America/Vancouver','nhl.l.1');assert.equal(h.render().confirmed,false);assert.equal(hook.readTimeZones().zones['nhl.l.2'],undefined);
 }finally{h.restore();}
});
test('401 requests connection and returning from authentication retries automatically',async()=>{
 const h=harness();global.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Connect Yahoo'})});
 try{let state=h.render();await state.refresh('UTC');state=h.render();assert.equal(state.needsAuth,true);h.effects.at(-1)();assert.ok(h.listeners.focus);
  global.fetch=async()=>({ok:true,status:200,json:async()=>payload('nhl.l.1')});await h.listeners.focus();state=h.render();assert.equal(state.needsAuth,false);assert.equal(state.data.league.key,'nhl.l.1');
 }finally{h.restore();}
});
test('errors preserve provider failure; manual source does not start a fetch; stale responses cannot replace newer data',async()=>{
 const h=harness();try{h.render(false);h.effects[0]();assert.equal(h.render(false).data,null);
  global.fetch=async()=>({ok:false,status:502,json:async()=>({error:'Yahoo request failed (502)'})});await h.render().refresh('UTC');assert.match(h.render().error,/Yahoo request failed/);assert.equal(h.render().data,null);
  let finish;global.fetch=()=>new Promise(r=>finish=r);const old=h.render().refresh('UTC');global.fetch=async()=>({ok:true,status:200,json:async()=>payload('new')});await h.render().refresh('UTC');finish({ok:true,status:200,json:async()=>payload('old')});await old;assert.equal(h.render().data.league.key,'new');
 }finally{h.restore();}
});
test('timezone validation and unavailable storage never fabricate confirmation persistence',()=>{
 const h=harness();try{assert.equal(hook.validTimeZone('Made/Up'),false);assert.throws(()=>hook.saveTimeZone('league','Made/Up'));window.localStorage.setItem=()=>{throw Error('blocked');};assert.equal(hook.saveTimeZone('league','UTC'),false);}finally{h.restore();}
});
test('live view exposes auth/loading/missing projections and reuses existing session without another upload',()=>{
 const {renderToStaticMarkup}=require('react-dom/server');const original=hook.useLiveSeason;
 hook.useLiveSeason=()=>({data:null,timeZone:'UTC',confirmed:false,busy:true,error:'Connect Yahoo',needsAuth:true,storageWarning:'',refresh(){},setConfirmed(){},setTimeZone(){}});
 try{const Component=load('src/components/LiveSeasonMode.tsx').default;const html=renderToStaticMarkup(React.createElement(Component));for(const text of ['Connect Yahoo','/api/auth/yahoo','Loading Yahoo','Projections missing','Manual/mock fixture'])assert.ok(html.includes(text),text);
  const source=fs.readFileSync('src/components/LiveSeasonMode.tsx','utf8');assert.ok(source.includes('useDraftSession()'));assert.ok(source.includes('data&&confirmed?composeLiveSeason'));assert.ok(!source.includes('type="file"'));
 }finally{hook.useLiveSeason=original;}
});
