const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {lateDraftWatchTargets,findWatchTargetPick}=load('src/lib/draft/lateDraftWatchlist.ts');

test('late-draft watchlist contains the requested sleeper and streamer targets',()=>{
 const names=lateDraftWatchTargets.map(x=>x.name);
 for(const name of [
  'Gabe Perreault','Devon Levi','Tristan Jarry','Justin Hryckowian','Porter Martone',
  'Matvei Gridin','Will Smith','Yegor Chinakhov','Carter Yakemchuk','Matvei Michkov',
  'Luke Hughes','Bowen Byram','Dmitry Orlov'
 ])assert.ok(names.includes(name),name);
 assert.equal(lateDraftWatchTargets.length,13);
});

test('watchlist marks full-name Yahoo history rows as drafted',()=>{
 const target=lateDraftWatchTargets.find(x=>x.name==='Porter Martone');
 const pick={playerId:'selection:1',playerName:'Porter Martone',pickNumber:121,fantasyTeamId:'team-8',source:'yahoo'};
 assert.equal(findWatchTargetPick(target,[pick]),pick);
});

test('watchlist also recognizes Yahoo first-initial renderings',()=>{
 const target=lateDraftWatchTargets.find(x=>x.name==='Gabe Perreault');
 const pick={playerId:'selection:2',playerName:'G. Perreault',pickNumber:139,fantasyTeamId:'team-2',source:'yahoo'};
 assert.equal(findWatchTargetPick(target,[pick]),pick);
});

test('watchlist does not fuzzy-match a different full first name',()=>{
 const target=lateDraftWatchTargets.find(x=>x.name==='Will Smith');
 const pick={playerId:'selection:3',playerName:'Walter Smith',pickNumber:140,fantasyTeamId:'team-3',source:'yahoo'};
 assert.equal(findWatchTargetPick(target,[pick]),undefined);
});


test('watchlist UI is projection/ADP focused and hides drafted targets instead of showing status rows',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../src/components/LateDraftWatchlist.tsx'),'utf8');
 for(const label of ['ADP','GP','G','A','PPP','SOG','HIT','BLK','OFF','PO','SV%','SO'])assert.ok(source.includes(label),label);
 assert.ok(source.includes("lateDraftWatchTargets.filter(target=>!findWatchTargetPick(target,draftPicks))"));
 assert.ok(!source.includes('AVAILABLE / TAKEN / MINE'));
 assert.ok(!source.includes('<th className="p-3">Status</th>'));
 assert.ok(!source.includes('<th className="p-3">Why</th>'));
});

test('Yahoo ADP snapshot matches watch targets by canonical identity aliases',()=>{
 const {defaultMarketSnapshot,matchMarketPlayers}=load('src/lib/model/marketDemand.ts');
 const targets=lateDraftWatchTargets.map(target=>({id:target.name,name:target.name}));
 const matches=matchMarketPlayers(targets,defaultMarketSnapshot);
 assert.equal(matches.get('Gabe Perreault')?.adp,127.3);
 assert.equal(matches.get('Yegor Chinakhov')?.name,'Egor Chinakhov');
 assert.equal(matches.get('Tristan Jarry')?.adp,136.3);
});
