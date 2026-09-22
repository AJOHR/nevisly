import Papa from 'papaparse';
import type { GoalieProjection } from '@/types/goalie';
import { normalizeTeam } from './parseSkaterCsv';
import { normalizePlayerName } from './identity';

const key=(s:string)=>s.trim().toLowerCase().replace(/[\s_.%-]+/g,'');
const clean=(v:unknown)=>v==null?'':String(v).trim();
const aliases={
  name:['player','name','playername'],
  team:['team','tm'],
  gp:['gp','games','gamesplayed'],
  wins:['w','wins'],
  svPct:['sv','svpct','savepercentage','savepct'],
  shutouts:['so','shutouts'],
};
function find(headers:string[],row:string[],names:string[]){
  const wanted=new Set(names.map(key));
  for(let i=0;i<headers.length;i++)if(wanted.has(headers[i]))return clean(row[i]);
  return '';
}
export function parseGoalieCsv(file:File|string):Promise<GoalieProjection[]>{
  return new Promise((resolve,reject)=>{
    Papa.parse<string[]>(file as File,{header:false,skipEmptyLines:'greedy',
      complete(results){
        try{
          if(results.errors.length)throw new Error(`CSV error: ${results.errors[0].message}`);
          const [rawHeaders,...rows]=results.data;
          if(!rawHeaders)throw new Error('CSV has no header row.');
          const headers=rawHeaders.map(key);
          const out:GoalieProjection[]=[];
          const ids=new Set<string>();
          for(const [i,row] of rows.entries()){
            if(row.length!==headers.length)throw new Error(`CSV row ${i+2}: expected ${headers.length} fields, found ${row.length}.`);
            const name=find(headers,row,aliases.name)
              .replace(/&#x27;|&#39;|&apos;/gi,"'")
              .replace(/&quot;/gi,'"').replace(/&amp;/gi,'&');
            if(!name)continue;
            const rawTeam=find(headers,row,aliases.team)
              .replace(/^N\.Y\. Islanders$/i,'NY Islanders')
              .replace(/^N\.Y\. Rangers$/i,'NY Rangers');
            const team=normalizeTeam(rawTeam);
            const gp=Number(find(headers,row,aliases.gp));
            const wins=Number(find(headers,row,aliases.wins));
            const svPct=Number(find(headers,row,aliases.svPct));
            const shutouts=Number(find(headers,row,aliases.shutouts));
            if(!team)throw new Error(`${name}: missing team.`);
            if(!Number.isFinite(gp)||gp<0)throw new Error(`${name}: invalid GP.`);
            if(!Number.isFinite(wins)||wins<0)throw new Error(`${name}: invalid wins.`);
            if(!Number.isFinite(svPct)||svPct<=0||svPct>=1)throw new Error(`${name}: invalid SV%.`);
            if(!Number.isFinite(shutouts)||shutouts<0)throw new Error(`${name}: invalid shutouts.`);
            const id=`goalie:${normalizePlayerName(name)}`;
            if(ids.has(id))throw new Error(`Duplicate goalie identity: ${name}.`);
            ids.add(id);
            out.push({id,name,team,gp,wins,svPct,shutouts});
          }
          if(!out.length)throw new Error('No goalie projections found. Expected PLAYER, TEAM, GP, W, SV%, and SO.');
          resolve(out);
        }catch(e){reject(e);}
      },error:reject});
  });
}
