const {test}=require('node:test');const assert=require('node:assert/strict');const {load,actions}=require('./load.cjs');
const {calculateReturnRisk}=load('src/lib/draft/returnRisk.ts');
const player={id:'candidate',score:5,vor:3,positions:['D'],zScores:{goals:1,assists:1,points:1,ppp:1,sog:1,hits:1,blocks:1}};
function owner(p,n){const r=Math.floor((p-1)/n),i=(p-1)%n;return r%2?n-i:i+1;}
function risk(n,slot,picks){return calculateReturnRisk({player,allPlayers:[player],draftPicks:picks,fantasyTeams:Array.from({length:n},(_,i)=>({id:`team-${i+1}`,isMyTeam:i+1===slot})),leagueTeams:n,myDraftSlot:slot});}
function history(k,n){return Array.from({length:k},(_,i)=>({playerId:`p${i}`,pickNumber:i+1,fantasyTeamId:`team-${owner(i+1,n)}`}));}
test('consecutive turn selections cannot lose a player to an opponent',()=>{for(const n of [8,10,12,14,16])for(const [slot,pick] of [[n,n],[1,n*2]]){const r=risk(n,slot,history(pick-1,n));assert.equal(r.teamsBeforeNextPick,0);assert.equal(r.probability,0);assert.equal(r.picksUntilNext,0);}});
test('all slots and four rounds count the current opponent when off clock',()=>{for(const n of [8,10,12,14,16])for(let slot=1;slot<=n;slot++)for(let cur=1;cur<=n*4;cur++){let next=cur+1;while(owner(next,n)!==slot)next++;const start=owner(cur,n)===slot?cur+1:cur;const expected=next-start;const r=risk(n,slot,history(cur-1,n));assert.equal(r.teamsBeforeNextPick,expected,`${n}/${slot}/${cur}`);assert.equal(r.picksUntilNext,expected);}});
test('manual entry follows highest authoritative pick, not array length',()=>{const a=actions([{playerId:'p3',pickNumber:3,fantasyTeamId:'team-3'}]);a.draftPlayer('p4','team-4');assert.equal(a.picks.at(-1).pickNumber,4);assert.equal(a.selected,'team-5');});
test('individual undo preserves later Yahoo pick numbers and owners',()=>{const a=actions(history(3,12));a.undoDraftPlayer('p1');assert.deepEqual(a.picks.map(p=>[p.pickNumber,p.fantasyTeamId]),[[1,'team-1'],[3,'team-3']]);});
