const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
 return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
exports.load = file => require(path.join(root,file));
// Run existing UI action bodies against deterministic state, without copying their logic.
exports.actions = initial => {
 const source=fs.readFileSync(path.join(root,'src/components/ProjectionUpload.tsx'),'utf8');
 const ast=ts.createSourceFile('ui.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const names=['draftPlayer','undoDraftPlayer','undoLastPick','getSnakeTeamIdForPick','resetDraftForProjectionChange'];const found=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))found.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
 let picks=initial;let selected='team-1';
 const deps={players:[],draftedIds:new Set(initial.map(p=>p.playerId)),leagueTeams:12,myTeamId:'team-1',setDraftPicks:f=>picks=typeof f==="function"?f(picks):f,setSelectedDraftTeamId:id=>selected=id};
 if(fs.existsSync(path.join(root,'src/lib/draft/state.ts')))Object.assign(deps,exports.load('src/lib/draft/state.ts'));
 const js=ts.transpileModule(found.join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 return {...new Function(...Object.keys(deps),js+';return {draftPlayer,undoDraftPlayer,undoLastPick,resetDraftForProjectionChange};')(...Object.values(deps)),get picks(){return picks;},get selected(){return selected;}};
};
