export type InjuryStatus = {
  id:string;
  name:string;
  team:string;
  status:string;
  injuryType:string|null;
  returnDate:string|null;
};

const TEAM_ALIASES:Record<string,string>={
  CLB:'CBJ',
  CBJ:'CBJ',
  LA:'LAK',
  LAA:'LAK',
  LAK:'LAK',
  MON:'MTL',
  MTL:'MTL',
  NJ:'NJD',
  NJD:'NJD',
  SJ:'SJS',
  SJS:'SJS',
  TB:'TBL',
  TBL:'TBL',
  UTAH:'UTA',
  UTA:'UTA',
  VEG:'VGK',
  VGK:'VGK',
  WAS:'WSH',
  WSH:'WSH',
};

const object=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value);

export function normalizeInjuryTeam(team:string){
  const key=team.trim().toUpperCase().replace(/[^A-Z]/g,'');
  return TEAM_ALIASES[key]??key;
}

/**
 * Returns null when the provider's expected injury-array schema is absent.
 * An actual empty array is valid and remains distinguishable from malformed data.
 */
export function parseBigBallsInjuries(value:unknown):InjuryStatus[]|null{
  if(!object(value))return null;
  const data=value.data;
  if(!object(data)||!Array.isArray(data.injuries))return null;

  const rows:InjuryStatus[]=[];
  for(const raw of data.injuries){
    if(!object(raw))continue;
    const player=object(raw.player)?raw.player:{};
    const team=object(player.team)?player.team:{};
    const name=typeof player.name==='string'?player.name.trim():'';
    if(!name)continue;

    const rawId=player.id;
    const id=typeof rawId==='string'||typeof rawId==='number'?String(rawId):'';
    const abbreviation=typeof team.abbreviation==='string'?team.abbreviation:'';
    const status=typeof raw.status==='string'&&raw.status.trim()?raw.status:'unknown';
    const injuryType=typeof raw.injury_type==='string'?raw.injury_type:null;
    const returnDate=typeof raw.return_date==='string'?raw.return_date:null;

    rows.push({
      id,
      name,
      team:normalizeInjuryTeam(abbreviation),
      status,
      injuryType,
      returnDate,
    });
  }
  return rows;
}
