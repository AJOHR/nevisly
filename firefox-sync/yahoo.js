(() => {
  if(globalThis.__nevislyCaptureV2)return;globalThis.__nevislyCaptureV2=true;
  let scheduled=false;
  function capture(){
    scheduled=false;
    const observation=NevislyExtractor.extract(document);
    browser.runtime.sendMessage({type:'CAPTURE_V2',capture:observation}).catch(error=>console.warn('[Nevisly] Capture delivery failed; retrying',error.message));
  }
  new MutationObserver(()=>{if(!scheduled){scheduled=true;setTimeout(capture,150);}}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-id','title']});
  browser.runtime.onMessage.addListener(message=>{if(message?.type==='REQUEST_CAPTURE_V2')capture();});
  setInterval(capture,1000);capture();
})();
