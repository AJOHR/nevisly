/* Storage and message handling are serialized; captureSequence is local observation order,
   not a Yahoo revision. It is persisted with its exact content and never advanced on replay. */
const stateKey='nevisly.bridge.v2';
let queue=Promise.resolve();
const yahooPath=url=>{try{const u=new URL(url);return u.origin==='https://sports-fantasy.media.yahoo.com' && /^\/draft\/hockey\/\d+\/\d+\/?$/.test(u.pathname)?u.pathname:null;}catch{return null;}};
const appUrl=url=>{try{return ['https://nevisly.vercel.app','http://localhost:3000'].includes(new URL(url).origin);}catch{return false;}};
async function deliver(tabId,message){try{await browser.tabs.sendMessage(Number(tabId),message);return true;}catch{return false;}}
async function handle(message,sender){
  if(!sender.tab?.id || sender.frameId!==0)return;
  const tab=String(sender.tab.id),path=yahooPath(sender.url||sender.tab.url);
  const currentDocument=await browser.webNavigation.getFrame({tabId:sender.tab.id,frameId:0});
  if(!sender.documentId||!currentDocument?.documentId)return {error:'This browser does not expose required document identity; update Firefox and reload both pages.'};
  if(currentDocument.documentId!==sender.documentId||sender.id!==browser.runtime.id)return;
  const saved=(await browser.storage.local.get(stateKey))[stateKey];
  if(saved && saved.version!==2)throw Error('Unsupported saved bridge version; manual recovery required');
  const state=saved||{version:2,sources:{},destinations:{}};
  if(message?.type==='CAPTURE_V2' && path){
    const capture=message.capture;if(!capture || !Array.isArray(capture.rows)||capture.rows.length>10000)return;
    let source=state.sources[tab];
    if(!source || source.roomPath!==path)source={roomPath:path,stream:crypto.randomUUID(),sequence:0,fingerprint:'',capture:null,capturedAt:0};
    const fingerprint=JSON.stringify(capture);
    if(fingerprint!==source.fingerprint){source.sequence++;source.fingerprint=fingerprint;source.capture=capture;}
    source.capturedAt=Date.now();state.sources[tab]=source;
    await browser.storage.local.set({[stateKey]:state});
    for(const [id,d] of Object.entries(state.destinations)){
      if(d.sourceTab===tab && d.stream===source.stream)await deliver(id,{schemaVersion:2,type:'observation',destinationSessionId:d.sessionId,...source});
      else if(!d.stream)await deliver(id,{schemaVersion:2,type:'offer',sourceTab:tab,roomPath:path,stream:source.stream,capture, capturedAt:source.capturedAt});
    }
    return;
  }
  if(!appUrl(sender.url||sender.tab.url)||typeof message?.sessionId!=='string'||!message.sessionId)return;
  let dest=state.destinations[tab];
  if(message.type==='READY_V2'){
    if(!dest||dest.sessionId!==message.sessionId)dest={sessionId:message.sessionId};
    if(message.stream && dest.stream && message.stream!==dest.stream)dest={sessionId:message.sessionId};
    state.destinations[tab]=dest;
    await browser.storage.local.set({[stateKey]:state});
    for(const [sourceTab,s] of Object.entries(state.sources)){
      // Closed/navigated Yahoo tabs never qualify as active offers/recovery sources.
      let live;try{live=await browser.tabs.get(Number(sourceTab));}catch{continue;}
      if(yahooPath(live.url)!==s.roomPath)continue;
      if(dest.stream===s.stream && dest.sourceTab===sourceTab){
        await deliver(tab,{schemaVersion:2,type:'observation',destinationSessionId:dest.sessionId,...s});
        await deliver(sourceTab,{type:'REQUEST_CAPTURE_V2'});
      }else if(!dest.stream)await deliver(tab,{schemaVersion:2,type:'offer',sourceTab,roomPath:s.roomPath,stream:s.stream,capture:s.capture,capturedAt:s.capturedAt});
    }
  }else if(message.type==='BIND_V2'){
    const source=state.sources[message.sourceTab];if(!source||source.stream!==message.stream)return;
    const live=await browser.tabs.get(Number(message.sourceTab));if(yahooPath(live.url)!==source.roomPath)return;
    state.destinations[tab]={sessionId:message.sessionId,sourceTab:message.sourceTab,stream:source.stream};
    await browser.storage.local.set({[stateKey]:state});
    await deliver(tab,{schemaVersion:2,type:'observation',destinationSessionId:message.sessionId,...source});
    await deliver(message.sourceTab,{type:'REQUEST_CAPTURE_V2'});
  }else if(dest?.sessionId===message.sessionId && message.type==='ACK_V2'){
    if(message.stream!==dest.stream)return;
    dest.lastAck={sequence:message.sequence,status:message.status,at:Date.now()};
    await browser.storage.local.set({[stateKey]:state});
  }else if(dest?.sessionId===message.sessionId && message.type==='REQUEST_V2'){
    if(dest.sourceTab)await deliver(dest.sourceTab,{type:'REQUEST_CAPTURE_V2'});
  }else if(message.type==='DISCONNECT_V2'){
    delete state.destinations[tab];await browser.storage.local.set({[stateKey]:state});
  }
}
browser.runtime.onMessage.addListener((message,sender)=>{
  const task=queue.then(()=>handle(message,sender));queue=task.catch(error=>console.warn('[Nevisly] Bridge operation failed; retained state will retry',error.message));return task;
});

// MV2 content scripts may need reinjection after an extension reload. Guards in each
// script make reinjection idempotent within the current extension document context.
if(browser.tabs.query && browser.tabs.executeScript){
  (async()=>{
    const tabs=await browser.tabs.query({url:['https://sports-fantasy.media.yahoo.com/draft/hockey/*','https://nevisly.vercel.app/*','http://localhost:3000/*']});
    for(const tab of tabs){
      const files=yahooPath(tab.url)?['extractor.js','yahoo.js']:appUrl(tab.url)?['nevisly.js']:[];
      for(const file of files)try{await browser.tabs.executeScript(tab.id,{file,runAt:'document_idle'});}catch(error){console.warn('[Nevisly] Reload injection unavailable; refresh the page',error.message);}
    }
  })().catch(error=>console.warn('[Nevisly] Reload recovery unavailable',error.message));
}
if(browser.tabs.onRemoved)browser.tabs.onRemoved.addListener(tabId=>{
  const task=queue.then(async()=>{const state=(await browser.storage.local.get(stateKey))[stateKey];if(!state)return;delete state.sources[String(tabId)];delete state.destinations[String(tabId)];await browser.storage.local.set({[stateKey]:state});});
  queue=task.catch(error=>console.warn('[Nevisly] Closed-tab cleanup failed',error.message));
});
