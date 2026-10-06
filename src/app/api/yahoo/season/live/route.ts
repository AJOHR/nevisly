import {NextRequest,NextResponse} from 'next/server';
import {readYahooLive} from '@/lib/yahoo/live';
import {YahooSeasonError} from '@/lib/yahoo/season';
import {leagueDate,readSchedules} from '@/lib/nhl/seasonSchedule';
export const maxDuration=300;
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'private, no-store'},token=request.cookies.get('yahoo_access_token')?.value;
 if(!token)return NextResponse.json({success:false,error:'Connect Yahoo on this host first.'},{status:401,headers});
 let calendarDate:string;const timeZone=request.nextUrl.searchParams.get('timeZone')??'';
 try{calendarDate=leagueDate(new Date(),timeZone);}catch{return NextResponse.json({success:false,error:'Supply the confirmed league calendar IANA timezone.'},{status:400,headers});}
 try{
  const result=await readYahooLive(async path=>{
   const response=await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/${path}?format=json`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new YahooSeasonError(`Yahoo request failed (${response.status}): ${path}`,[401,403].includes(response.status)?response.status:502);
   return response.json();
  },new Date().toISOString(),calendarDate);
  const players=[...(result.snapshot.myTeam?.roster??[]),...(result.snapshot.opponent?.roster??[]),...(result.snapshot.freeAgents??[])];
  const schedule=await readSchedules(players.map(p=>p.team),async team=>{
   const response=await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${team}/20262027`,{next:{revalidate:21600},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('NHL schedule request failed');return response.json();
  });
  return NextResponse.json({success:true,...result,schedules:schedule.schedules,scheduleErrors:schedule.errors,calendarDate,timeZone,
   diagnostics:{availablePlayers:result.availableCount,rosterCounts:{mine:result.snapshot.myTeam?.roster?.length,opponent:result.snapshot.opponent?.roster?.length},
    scheduleTeams:Object.keys(schedule.schedules).length,projectionJoin:'Performed locally from the existing uploaded blend; see Season coverage.',
    recommendationReadiness:'Pending local projection join and guarded composition',refresh:'Yahoo refreshed on request; NHL cached 6 hours'}},{headers});
 }catch(error){return NextResponse.json({success:false,error:error instanceof YahooSeasonError?error.message:'Live Season refresh failed; no mock data substituted.',choices:error instanceof YahooSeasonError?error.choices:undefined},{status:error instanceof YahooSeasonError?error.status:502,headers});}
}
