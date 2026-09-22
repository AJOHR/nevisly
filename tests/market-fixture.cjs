const {load}=require('./load.cjs');
const {defaultMarketSnapshot}=load('src/lib/model/marketDemand.ts');
// Explicit synthetic market, initially ordered like the legacy demand fixture.
exports.snapshotFor=players=>({...defaultMarketSnapshot,players:[...players].sort((a,b)=>b.vor-a.vor||a.id.localeCompare(b.id)).map((p,i)=>({yahooPlayerId:String(i+1),name:p.name,team:p.team,positions:p.positions,adp:i+1}))});
