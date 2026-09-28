// Temporary preview-only source diagnostic. Never merge into production.
import { DAILY_FACEOFF_TEAMS, parseDailyFaceoffPowerPlayPage } from '@/lib/nhl/powerPlay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function record(value: unknown): Record<string,unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
}

function parseInjuryNews(html:string) {
  const embedded = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if(!embedded)return {status:'invalid',reason:'Missing structured page data'};
  try {
    const root=record(JSON.parse(embedded));
    const props=record(record(root.props).pageProps);
    const category=record(record(props.options).category);
    const data=record(props.data);
    if(category.slug!=='injuries'||data.page!==1||!Array.isArray(data.data)||!data.data.length||data.itemCount!==data.data.length)
      return {status:'invalid',reason:'Unexpected injury page schema or pagination'};
    const seen=new Set<string>();
    const rows=data.data.map(raw=>{
      const row=record(raw);
      if(typeof row.id!=='number'||!Number.isFinite(row.id)||typeof row.playerId!=='number'||!Number.isFinite(row.playerId)
        ||typeof row.playerName!=='string'||!row.playerName.trim()||typeof row.teamAbbreviation!=='string'||!row.teamAbbreviation.trim()
        ||typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))
        ||typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt))||row.newsCategoryName!=='Injury'||row.recordType!=='news')
        throw Error('Invalid injury record');
      const id=String(row.id);if(seen.has(id))throw Error('Duplicate news identity');seen.add(id);
      return {id:row.id,playerId:row.playerId,name:row.playerName,team:row.teamAbbreviation,date:row.date,updatedAt:row.updatedAt};
    });
    return {status:'ok',page:data.page,lastPage:data.lastPage,count:rows.length,rows,
      meaning:'Dated injury news; not a complete active-injury status list'};
  } catch {return {status:'invalid',reason:'Malformed structured injury records'};}
}

async function probe(url:string, team?:string, slug?:string) {
  const requestedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: {
        Accept:'text/html,application/xhtml+xml',
        'User-Agent':'Mozilla/5.0 (compatible; Nevisly/1.0; fantasy-hockey draft assistant)',
      },
      cache:'no-store',
      signal:AbortSignal.timeout(10000),
    });
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,200);
    const result = {url,team,requestedAt,status:response.status,finalUrl:response.url,
      contentType:response.headers.get('content-type'),bytes:Buffer.byteLength(html),title};
    if (!response.ok) return {...result,bodyExcerpt:html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,200)};
    if(team && slug) {
      const parsed = parseDailyFaceoffPowerPlayPage(html,team,slug);
      return {...result,parseStatus:parsed.status,updatedAt:parsed.updatedAt,assignmentCount:parsed.players.length};
    }
    return {...result,injuryNews:parseInjuryNews(html)};
  } catch(error) {
    return {url,team,requestedAt,status:null,error:error instanceof Error?error.name:'fetch-error'};
  }
}

export async function GET() {
  if(process.env.VERCEL_ENV!=='preview')return Response.json({error:'Preview only'},{status:404});
  const injury = await probe('https://www.dailyfaceoff.com/hockey-player-news/injuries/1');
  const lineCombinations = [];
  for(let i=0;i<DAILY_FACEOFF_TEAMS.length;i+=8) {
    lineCombinations.push(...await Promise.all(DAILY_FACEOFF_TEAMS.slice(i,i+8).map(([team,slug])=>
      probe(`https://www.dailyfaceoff.com/teams/${slug}/line-combinations`,team,slug))));
  }
  return Response.json({checkedAt:new Date().toISOString(),environment:process.env.VERCEL_ENV,
    commit:process.env.VERCEL_GIT_COMMIT_SHA,region:process.env.VERCEL_REGION??null,
    cache:'no-store',injury,lineCombinations},{headers:{'Cache-Control':'no-store'}});
}
