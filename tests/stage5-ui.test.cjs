const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./load.cjs');
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const Board=load('src/components/DecisionBoard.tsx').default;
const Explanation=load('src/components/PlayerExplanationCard.tsx').default;
const {rankRecommendations}=load('src/lib/model/engine.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {players,context}=require('./model-scenarios.cjs');
const market=replacementValues(players,12);
const recommendations=rankRecommendations(context(market.ranked,0),market).slice(0,5);
test('decision UI renders separate dimensions, explicit actions and uncertainty',()=>{
 const html=renderToStaticMarkup(React.createElement(Board,{players:recommendations,onInspect:()=>{},onDraft:()=>{},rosterFull:false}));
 for(const label of ['Player Value','Team Fit','Draft urgency:','Uncertainty','Explain score','MY PICK','Goalie value is unmodeled'])assert.ok(html.includes(label),label);
 assert.equal((html.match(/aria-label="Draft [^"]+ to my team"/g)||[]).length,5);
 assert.ok(!html.includes('championship value rating'));
});
test('a full roster does not present another recommendation draft action',()=>{
 const html=renderToStaticMarkup(React.createElement(Board,{players:recommendations,onInspect:()=>{},onDraft:()=>{},rosterFull:true}));
 assert.ok(html.includes('roster is full'));assert.ok(!html.includes('MY PICK'));
});
test('explanation renders actual component values and feasible replacement names',()=>{
 const player=recommendations[0];
 const html=renderToStaticMarkup(React.createElement(Explanation,{player}));
 for(const value of Object.values(player.contributions))assert.ok(html.includes(value.toFixed(3)));
 for(const name of player.fit.replacementNames)assert.ok(html.includes(name));
 assert.ok(html.includes('utility scores, not probabilities'));
 assert.ok(html.includes('Draft Urgency'));assert.ok(html.includes('Uncertainty'));
});


test('player pool source exposes sortable Yahoo ADP beside Rank',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/components/ProjectionUpload.tsx'),'utf8');
 const rank=source.indexOf('label="Rank"');
 const adp=source.indexOf('label="ADP"');
 assert.ok(rank>=0&&adp>rank&&adp-rank<500,'ADP should appear immediately after Rank');
 assert.ok(source.includes('handleSort("adp")'));
 assert.ok(source.includes('player.adp.toFixed(1)'));
});
