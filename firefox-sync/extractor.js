/* Selectors grounded in the supplied Yahoo capture; no hashed _ys_* classes. */
(function(root) {
  const text = node => node?.textContent?.trim() || '';
  const integer = s => /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) && Number(s)>0 ? Number(s) : null;
  function extract(document) {
    const issues=[];
    const host=document.getElementById('main-0-DraftClientBootstrap-Proxy');
    if(!host)return {rows:[],issues:['Unsupported layout: Yahoo draft root is absent'],coverage:'partial',currentPick:null,round:null,teamCount:null};
    const tables=[...host.querySelectorAll('table')].filter(t=>['pick','player','team'].every(id=>t.querySelector(`th[data-id="${id}"]`)));
    if(tables.length!==1)return {rows:[],issues:['Open Results → Round by Round; expected one identified history table'],coverage:'partial',currentPick:null,round:null,teamCount:null};
    const table=tables[0],heads=[...table.querySelectorAll('tr')][0];
    const columns=[...heads.children].map(h=>h.getAttribute('data-id'));
    if(columns.join(',')!=='pick,player,team')return {rows:[],issues:['Unsupported history column layout'],coverage:'partial',currentPick:null,round:null,teamCount:null};
    const headers=[...host.querySelectorAll('span')].filter(e=>!e.children.length).map(text).map(t=>t.match(/Round\s+(\d+),\s*Pick\s+(\d+)$/)).filter(Boolean);
    const header=headers.length===1?headers[0]:null;
    const round=header?integer(header[1]):null,currentPick=header?integer(header[2]):null;
    if(!header)issues.push('Current overall-pick header absent or ambiguous');
    let rowRound=null;const rows=[],numbers=new Set();
    for(const tr of table.querySelectorAll('tr')) {
      const cells=[...tr.children];
      if(cells[0]?.tagName==='TH') {
        const m=text(tr).match(/^Round\s+(\d+)$/);if(m)rowRound=integer(m[1]);continue;
      }
      if(cells.length!==3){issues.push('Malformed history row');continue;}
      const pickNumber=integer(text(cells[0]));
      if(!pickNumber){issues.push('History row lacks an explicit overall number');continue;}
      if(numbers.has(pickNumber)){issues.push(`Conflicting/duplicate history row #${pickNumber}`);continue;}numbers.add(pickNumber);
      const player=cells[1].querySelector('.ys-player[data-id]');
      const rawId=player?.getAttribute('data-id');
      const yahooPlayerId=rawId && /^\d+$/.test(rawId)?rawId:undefined;
      const playerName=player?.querySelector('img[title]')?.getAttribute('title')?.trim() || '';
      const abbrs=[...(player?.querySelectorAll('ul abbr')||[])];
      const positionText=text(abbrs[0]);
      const positions=positionText.split(',').map(p=>p.trim()).filter(Boolean);
      const validPositions=positions.length&&positions.every(p=>['C','LW','RW','D','G'].includes(p));
      const nhlTeam=text(abbrs[1]);
      const ownerName=text(cells[2]);
      if(!player || !playerName || !yahooPlayerId)issues.push(`#${pickNumber}: player metadata incomplete`);
      if(!validPositions)issues.push(`#${pickNumber}: eligibility unavailable`);
      if(!nhlTeam)issues.push(`#${pickNumber}: NHL team unavailable`);
      if(!ownerName)issues.push(`#${pickNumber}: owner unavailable`);
      rows.push({pickNumber,round:rowRound,playerName,yahooPlayerId,positions:validPositions?positions:[],nhlTeam,ownerName});
    }
    rows.sort((a,b)=>a.pickNumber-b.pickNumber);
    const r1=rows.filter(p=>p.round===1),r2=rows.filter(p=>p.round===2);
    const teamCount=r1.length && r2.length && r1.every((p,i)=>p.pickNumber===i+1) && r2[0].pickNumber===r1.length+1 ? r1.length : null;
    if(teamCount && rows.some(p=>p.round!==Math.floor((p.pickNumber-1)/teamCount)+1))issues.push('Round labels disagree with overall numbers');
    if(teamCount && currentPick && round!==Math.floor((currentPick-1)/teamCount)+1)issues.push('Header round disagrees with history numbering');
    const ids=rows.map(p=>p.yahooPlayerId).filter(Boolean);if(new Set(ids).size!==ids.length)issues.push('Repeated Yahoo player ID across selection slots');
    const contiguous=rows.every((p,i)=>p.pickNumber===i+1);
    // Header is only a cross-check. NEVER assign a selection number from header minus one.
    const complete=!!currentPick && rows.length===currentPick-1 && contiguous && !!teamCount && !issues.length;
    return {rows,issues,coverage:complete?'complete':'partial',currentPick,round,teamCount};
  }
  root.NevislyExtractor={extract};
  if(typeof module==='object')module.exports={extract};
})(globalThis);
