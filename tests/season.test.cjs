const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load,actions}=require('./load.cjs');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {normalizeSeasonState}=load('src/lib/season/state.ts');
const {manualSeasonFixture:fixture}=load('src/lib/season/fixture.ts');
const {classifyCategory,matchupRows,compareMove,seasonMoves}=load('src/lib/season/engine.ts');
const Season=load('src/components/SeasonMode.tsx').default;
const Modes=load('src/components/NevislyModes.tsx').default;

test('manual normalized state carries real roster and independent goalie records; missing stays missing',()=>{
 const s=normalizeSeasonState(fixture);
 assert.equal(s.myTeam.roster.length,16);assert.equal(s.myTeam.roster.filter(p=>p.kind==='goalie').length,2);
 assert.equal(s.myTeam.name,'Yzerplan');assert.equal(s.leagueTeams,10);
 assert.equal(s.myTeam.current['SV%'],.911);
 s.myTeam.roster[0].perGame.G=NaN;s.myTeam.roster[0].rosValue=Infinity;s.myTeam.remaining.G=NaN;
 const clean=normalizeSeasonState(s);
 assert.equal(clean.myTeam.roster[0].perGame.G,undefined);assert.equal(clean.myTeam.roster[0].rosValue,undefined);assert.equal(clean.myTeam.remaining.G,undefined);
 assert.equal(fixture.myTeam.roster[0].perGame.G,.5);
 assert.throws(()=>normalizeSeasonState({...fixture,freeAgents:[fixture.myTeam.roster[0]]}),/duplicate/);
 assert.throws(()=>normalizeSeasonState({...fixture,week:0}),/week/);
});
test('classification has deterministic boundaries, not probability; ratios never add',()=>{
 for(const [mine,status] of [[13,'Strong'],[12,'Close'],[10,'Close'],[8,'Close'],[7,'Swing'],[6,'Swing'],[5,'Behind']])assert.equal(classifyCategory(mine,10,2),status);
 assert.equal(classifyCategory(undefined,10,2),'Unknown');
 const s=structuredClone(fixture);s.myTeam.remaining['SV%']=.9;
 const sv=matchupRows(s).find(r=>r.category==='SV%');assert.equal(sv.mineFinish,undefined);assert.equal(sv.basis,'current totals');
 s.myTeam.remaining.G=undefined;assert.equal(matchupRows(s)[0].mineFinish,undefined);
});
test('weekly needs can outweigh ROS while the tradeoff and category arithmetic stay separate',()=>{
 const moves=seasonMoves(fixture);assert.equal(moves[0].add.id,'mock-wing');assert.ok(moves[0].rosChange<0);assert.ok(moves[0].weeklyFit>moves[1].weeklyFit);
 assert.equal(moves[0].gamesChange,2);assert.equal(moves[0].delta.HIT,7.5);assert.equal(moves[0].delta.SOG,4);
 const s=structuredClone(fixture);s.freeAgents[0].rosValue=999;
 assert.equal(seasonMoves(s)[0].weeklyFit,moves[0].weeklyFit);
 s.freeAgents[0].usableGames=undefined;assert.equal(compareMove(s,s.freeAgents[0],s.myTeam.roster[15]),null);
 assert.equal(compareMove(fixture,fixture.freeAgents[0],fixture.myTeam.roster[2]),null);
});
test('Season dashboard renders explicit mock provenance, all categories and supported next move',()=>{
 const html=renderToStaticMarkup(React.createElement(Season));
 for(const label of ['Your Next Move','League data:','Manual','not live','Example checking winger','Eeli Tolvanen','ROS value change','Goalie Situation','SV%','Waivers','Trades'])assert.ok(html.includes(label),label);
 const s=structuredClone(fixture);s.myTeam.remaining={};
 assert.ok(renderToStaticMarkup(React.createElement(Season,{state:s})).includes('Insufficient season-state data'));
});
test('mode buttons switch views while retaining the exact Draft subtree',()=>{
 const original=React.useState;let mode='Draft';
 React.useState=()=>[mode,v=>{mode=v;}];
 try{
  const draft=React.createElement('div',null,'uploaded projections');
  const render=()=>Modes({children:draft});
  let tree=render();const subtree=tree.props.children[1];assert.equal(subtree.props.hidden,false);assert.equal(subtree.props.children,draft);
  const buttons=tree.props.children[0].props.children[1].props.children;
  buttons[1].props.onClick();tree=render();assert.equal(tree.props.children[1].props.hidden,true);assert.equal(tree.props.children[1].props.children,draft);assert.ok(tree.props.children[2]);
  buttons[0].props.onClick();tree=render();assert.equal(tree.props.children[1].props.hidden,false);assert.equal(tree.props.children[1].props.children,draft);
 }finally{React.useState=original;}
});
test('existing Draft screen renders inside the mode shell and manual drafting still records a pick',()=>{
 const Page=load('src/app/page.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Page));
 assert.ok(html.includes('Nevisly mode'));assert.ok(html.includes('Start Nevisly'));assert.ok(html.includes('Championship Draft Assistant'));
 const ui=actions([]);ui.draftPlayer('test-player','team-1');assert.equal(ui.picks.length,1);ui.undoLastPick();assert.equal(ui.picks.length,0);
});
test('season engine has no provider or draft scoring imports',()=>{
 for(const file of ['state.ts','engine.ts','fixture.ts']){
  const source=fs.readFileSync(path.join(__dirname,'../src/lib/season',file),'utf8');
  const imports=[...source.matchAll(/from\s+['"]([^'"]+)/g)].map(m=>m[1]);
  assert.ok(imports.every(i=>i.startsWith('./')),imports.join(','));
  assert.ok(!/fetch\(|XMLHttpRequest|yahoo/i.test(source));
 }
});
test('Matchup and Waivers render details; unfinished tabs advertise no functionality',()=>{
 const original=React.useState;
 try{
  for(const [tab,labels] of [['Matchup',['Your remaining','Their remaining','SV% is current-only']],['Waivers',['Suggested Drop','ROS Value','Weekly Fit','Example checking winger']],['Trades',['Coming next','Not implemented in Phase 1']]]){
   React.useState=()=>[tab,()=>{}];
   const html=renderToStaticMarkup(React.createElement(Season));
   for(const label of labels)assert.ok(html.includes(label),`${tab}: ${label}`);
  }
 }finally{React.useState=original;}
});
