const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const {load}=require('./load.cjs');
exports.bridge=(players,initial=[])=>{
 let session={version:1,id:'manual',leagueTeams:12,myDraftSlot:1,projectionSources:[],draftPicks:initial};
 const boundary=path.resolve(__dirname,'../src/lib/draft/yahoo.ts');
 if(fs.existsSync(boundary)){const {applyYahooMessage}=load('src/lib/draft/yahoo.ts');return {send:(kind,data)=>{session=applyYahooMessage(session,data,kind,players,1000);},get picks(){return session.draftPicks;},get session(){return session;}};}
 const source=fs.readFileSync(path.resolve(__dirname,'../src/components/ProjectionUpload.tsx'),'utf8');const ast=ts.createSourceFile('ui.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const names=['handleYahooPick','handleYahooSnapshot','matchesYahooPlayerName','normalizePlayerName','normalizeNamePart','normalizeYahooNhlTeam'];const code=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))code.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
 const deps={players,leagueTeams:12,draftedIds:new Set(initial.map(p=>p.playerId)),fantasyTeams:Array.from({length:12},(_,i)=>({id:`team-${i+1}`})),setDraftPicks:v=>session.draftPicks=typeof v==='function'?v(session.draftPicks):v,getSnakeTeamIdForPick:load('src/lib/draft/state.ts').getSnakeTeamIdForPick,console:{log(){},warn(){}}};
 const js=ts.transpileModule(code.join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const handlers=new Function(...Object.keys(deps),js+';return {pick:handleYahooPick,snapshot:handleYahooSnapshot};')(...Object.values(deps));
 return {send:(kind,data)=>handlers[kind]({detail:JSON.stringify(data)}),get picks(){return session.draftPicks;},get session(){return session;}};
};
