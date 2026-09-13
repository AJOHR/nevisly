(() => {
  if(globalThis.__nevislyDestinationV2)return;globalThis.__nevislyDestinationV2=true;
  let ready=null;
  const send=detail=>browser.runtime.sendMessage(detail).then(response=>{if(response?.error)throw Error(response.error)}).catch(error=>window.dispatchEvent(new CustomEvent('nevisly-bridge-v2',{detail:JSON.stringify({type:'transport-error',message:error.message})})));
  window.addEventListener('nevisly-bridge-request-v2',event=>{
    try{const m=JSON.parse(event.detail);if(!m||!['READY_V2','BIND_V2','ACK_V2','REQUEST_V2','DISCONNECT_V2'].includes(m.type))return;
      if(m.type==='READY_V2')ready=m;
      send(m);
    }catch{}
  });
  browser.runtime.onMessage.addListener(message=>{
    if(message?.schemaVersion===2)window.dispatchEvent(new CustomEvent('nevisly-bridge-v2',{detail:JSON.stringify(message)}));
  });
  // React may mount after document_idle, and this script may mount after React.
  setInterval(()=>{if(ready)send(ready);else window.dispatchEvent(new CustomEvent('nevisly-bridge-content-ready-v2'));},2000);
  window.dispatchEvent(new CustomEvent('nevisly-bridge-content-ready-v2'));
})();
