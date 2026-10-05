import {NextRequest,NextResponse} from 'next/server';
import {readYahooSeason,YahooSeasonError} from '@/lib/yahoo/season';
import {composeSeasonState} from '@/lib/season/provider';
import {seasonConfiguration} from '@/lib/season/config';

export async function GET(request:NextRequest){
  const headers={'Cache-Control':'private, no-store'};
  const token=request.cookies.get('yahoo_access_token')?.value;
  if(!token)return NextResponse.json({success:false,error:'Connect to Yahoo on this host first.'},{status:401,headers});
  try{
    const result=await readYahooSeason(async path=>{
      const response=await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/${path}?format=json`,{
        headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(15000),
      });
      if(!response.ok)throw new YahooSeasonError(`Yahoo request failed (${response.status}): ${path}`,response.status===401||response.status===403?response.status:502);
      try{return await response.json();}catch{throw new YahooSeasonError('Yahoo returned invalid JSON',502);}
    },2026); // Explicit 2026–27 scope; never fall back to a historical league.
    const composition=composeSeasonState(result.snapshot,seasonConfiguration);
    return NextResponse.json({success:true,...result,
      rosterCounts:{mine:result.snapshot.myTeam?.roster?.length,opponent:result.snapshot.opponent?.roster?.length},
      composition:composition.available?{available:true}:{available:false,missing:composition.missing,errors:composition.errors},
    },{headers});
  }catch(error){
    // Never return raw provider payloads, tokens, request headers or arbitrary fetch errors.
    return NextResponse.json({success:false,error:error instanceof YahooSeasonError?error.message:'Yahoo Season request could not complete.',
      choices:error instanceof YahooSeasonError?error.choices:undefined},
      {status:error instanceof YahooSeasonError?error.status:502,headers});
  }
}
