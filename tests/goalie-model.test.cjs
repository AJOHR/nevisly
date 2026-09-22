const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {parseGoalieCsv}=load('src/lib/projections/parseGoalieCsv.ts');
const {rankGoalies}=load('src/lib/model/goalies.ts');

test('goalie CSV parses W/SV%/SO and normalizes New York team labels',async()=>{
 const csv='RANK,PLAYER,TEAM,POS,GP,W,AVG,SV%,SO\n1,Igor Example,N.Y. Rangers,G,55,30,2.50,0.910,4\n2,Backup Example,N.Y. Rangers,G,28,12,2.90,0.899,1\n';
 const rows=await parseGoalieCsv(csv);
 assert.equal(rows.length,2);
 assert.equal(rows[0].team,'NYR');
 assert.deepEqual([rows[0].gp,rows[0].wins,rows[0].svPct,rows[0].shutouts],[55,30,.910,4]);
});

test('goalie role requires a clear projected workload, not merely being team leader',()=>{
 const goalies=[
  {id:'g1',name:'Clear',team:'AAA',gp:55,wins:30,svPct:.91,shutouts:3},
  {id:'g2',name:'Backup',team:'AAA',gp:27,wins:12,svPct:.90,shutouts:1},
  {id:'g3',name:'One A',team:'BBB',gp:42,wins:23,svPct:.905,shutouts:2},
  {id:'g4',name:'One B',team:'BBB',gp:40,wins:22,svPct:.906,shutouts:2},
 ];
 const ranked=rankGoalies(goalies);
 assert.equal(ranked.find(g=>g.id==='g1').role,'STARTER');
 assert.equal(ranked.find(g=>g.id==='g2').role,'BACKUP');
 assert.equal(ranked.find(g=>g.id==='g3').role,'TANDEM');
 assert.equal(ranked.find(g=>g.id==='g4').role,'TANDEM');
});

test('goalie score uses exactly the three league categories, not GP',()=>{
 const a={id:'a',name:'A',team:'AAA',gp:60,wins:20,svPct:.900,shutouts:2};
 const b={id:'b',name:'B',team:'BBB',gp:40,wins:20,svPct:.900,shutouts:2};
 const ranked=rankGoalies([a,b]);
 assert.equal(ranked.find(g=>g.id==='a').score,ranked.find(g=>g.id==='b').score);
});
