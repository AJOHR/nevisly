// Offline preparation only. Never imported by the app or called during ranking.
// node scripts/refresh-yahoo-adp.mjs /path/to/new-yahoo-adp.json
import {writeFile} from 'node:fs/promises';
const output=process.argv[2];
if(!output)throw Error('Supply a NEW output JSON path, then upload it in Yahoo market timing settings.');
const sourceUrl='https://hockey.fantasysports.yahoo.com/hockey/draftanalysis';
async function get(url,json=false){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Yahoo HTTP ${r.status}`);return json?r.json():r.text();}
const html=await get(sourceUrl);
const gameId=html.match(/var gameId = "(\d+)"/)?.[1];
if(!gameId)throw Error('Yahoo page structure changed; no snapshot written.');
const players=[],ids=new Set();let season,complete=false;
for(let start=0;start<5000;start+=1000){
 const url=`https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/league/${gameId}.l.public;out=settings/players;position=ALL;start=${start};count=1000;sort=average_pick;search=;out=auction_values,ranks;ranks=o-rank;out=expert_ranks;expert_ranks.rank_type=projected_season_remaining/draft_analysis;cut_types=diamond;slices=last7days?format=json_f`;
 const league=(await get(url,true)).fantasy_content?.league;
 if(!league||league.game_code!=='nhl'||!Array.isArray(league.players))throw Error('Unexpected Yahoo response; no snapshot written.');
 season=String(league.season);
 for(const {player:p} of league.players){
  if(ids.has(p.player_id))throw Error('Duplicate paginated identity; no snapshot written.');ids.add(p.player_id);
  const adp=Number(p.draft_analysis?.average_pick);
  if(Number.isFinite(adp)&&adp>0)players.push({yahooPlayerId:String(p.player_id),name:p.name.full,team:p.editorial_team_abbr??'',positions:p.display_position.split(','),adp});
 }
 if(league.players.length<1000){complete=true;break;}
}
if(!complete||!players.length)throw Error('Incomplete or empty Yahoo snapshot; no file written.');
const retrievedAt=new Date().toISOString();
const snapshot={source:'Yahoo Sports Fantasy Hockey Draft Analysis',sourceUrl,sourceDate:retrievedAt.slice(0,10),retrievedAt,scoringContext:'Yahoo standard scoring ADP',season,players};
await writeFile(output,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
console.log(`Saved ${players.length} Yahoo ADP rows (${season}); upload this JSON in Nevisly market timing settings.`);
