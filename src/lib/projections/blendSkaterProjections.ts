import type { SkaterProjection } from "@/types/player";

import {
  getProjectionPlayerKey,
} from "@/lib/projections/parseSkaterCsv";

export type ProjectionSource = {
  id: string;
  name: string;
  weight: number;
  players: SkaterProjection[];
};

export type ProjectionSourceDiagnostic = {
  sourceId: string;
  sourceName: string;
  playerCount: number;
  matchedPlayers: number;
  uniquePlayers: number;
  matchPercentage: number;
  uniquePlayerNames: string[];
};

export type ProjectionDiagnostics = {
  activeSourceCount: number;
  totalUniquePlayers: number;
  matchedAcrossAllSources: number;
  matchedAcrossMultipleSources: number;
  sources: ProjectionSourceDiagnostic[];
};

const weightedFields = [
  "gp",
  "goals",
  "assists",
  "points",
  "ppp",
  "sog",
  "hits",
  "blocks",
] as const;

type WeightedField =
  (typeof weightedFields)[number];

  type PlayerEntry = {
    source: ProjectionSource;
    player: SkaterProjection;
  };


function normalizeTeam(team: string) {
  const map: Record<string,string> = {
    "ANAHEIM": "ANA",
    "ARIZONA": "ARI",
    "BOSTON": "BOS",
    "BUFFALO": "BUF",
    "CALGARY": "CGY",
    "CAROLINA": "CAR",
    "CHICAGO": "CHI",
    "COLORADO": "COL",
    "COLUMBUS": "CBJ",
    "DALLAS": "DAL",
    "DETROIT": "DET",
    "EDMONTON": "EDM",
    "FLORIDA": "FLA",
    "LOS ANGELES": "LAK",
    "MINNESOTA": "MIN",
    "MONTREAL": "MTL",
    "NASHVILLE": "NSH",
    "NEW JERSEY": "NJD",
    "NEW YORK ISLANDERS": "NYI",
    "NEW YORK RANGERS": "NYR",
    "OTTAWA": "OTT",
    "PHILADELPHIA": "PHI",
    "PITTSBURGH": "PIT",
    "SEATTLE": "SEA",
    "SAN JOSE": "SJS",
    "ST. LOUIS": "STL",
    "TAMPA BAY": "TBL",
    "TORONTO": "TOR",
    "UTAH": "UTA",
    "VANCOUVER": "VAN",
    "VEGAS": "VGK",
    "WASHINGTON": "WSH",
    "WINNIPEG": "WPG",
  };

  const normalized =
    team.trim().toUpperCase();

  return map[normalized] ?? normalized;
}


function round(
  value:number,
  decimals = 2
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}


function getProjectionConfidence(
  entries: PlayerEntry[]
):
"HIGH" | "MEDIUM" | "LOW" {

  if(entries.length <= 1) {
    return "LOW";
  }

  const variance =
    calculateProjectionVariance(
      entries
    );

    if(variance <= 5) {
      return "HIGH";
    }
    
    if(variance <= 15) {
      return "MEDIUM";
    }
    
    return "LOW";

function calculateProjectionVariance(
  entries:PlayerEntry[]
) {

  if(entries.length <= 1) {
    return 0;
  }

  const points =
    entries.map(
      entry =>
        entry.player.points
    );

  const mean =
    points.reduce(
      (sum,value)=>
        sum + value,
      0
    ) / points.length;


  const variance =
    points.reduce(
      (sum,value)=>
        sum +
        Math.pow(
          value - mean,
          2
        ),
      0
    ) / points.length;


  return round(
    Math.sqrt(variance),
    1
  );
}


function getWeightedValue(
  entries:PlayerEntry[],
  field:WeightedField
) {

  const valid =
    entries.filter(
      entry =>
        entry.source.weight > 0
    );


  const totalWeight =
    valid.reduce(
      (sum,entry)=>
        sum + entry.source.weight,
      0
    );


  if(totalWeight <= 0) {
    return 0;
  }


  const total =
    valid.reduce(
      (sum,entry)=>
        sum +
        entry.player[field] *
        entry.source.weight,
      0
    );


  return round(
    total / totalWeight
  );
}



function getWeightedAge(
  entries:PlayerEntry[]
) {

  const weight =
    entries.reduce(
      (sum,entry)=>
        sum + entry.source.weight,
      0
    );


  if(weight <= 0) {
    return entries[0]?.player.age ?? 0;
  }


  return round(
    entries.reduce(
      (sum,entry)=>
        sum +
        entry.player.age *
        entry.source.weight,
      0
    ) / weight,
    1
  );
}



function getPrimaryEntry(
  entries:PlayerEntry[]
) {

  return [
    ...entries,
  ].sort(
    (a,b)=>
      b.source.weight -
      a.source.weight
  )[0];
}



function getCombinedPositions(
  entries:PlayerEntry[]
) {

  const set =
    new Set<string>();

  for(const entry of entries) {
    for(const pos of entry.player.positions) {
      set.add(pos);
    }
  }

  return [...set];
}



function buildPlayerMap(
  sources:ProjectionSource[]
) {

  const map =
    new Map<string,PlayerEntry[]>();


  for(const source of sources) {

    for(const player of source.players) {

      const key =
        getProjectionPlayerKey(player);


      const current =
        map.get(key) ?? [];


      current.push({
        source,
        player,
      });


      map.set(
        key,
        current
      );
    }
  }


  return map;
}



/*
 DIAGNOSTICS
*/

export function getProjectionDiagnostics(
  sources:ProjectionSource[]
):ProjectionDiagnostics {


  const active =
    sources.filter(
      source =>
        source.weight > 0 &&
        source.players.length > 0
    );


  if(active.length === 0) {
    return {
      activeSourceCount:0,
      totalUniquePlayers:0,
      matchedAcrossAllSources:0,
      matchedAcrossMultipleSources:0,
      sources:[]
    };
  }


  const map =
    buildPlayerMap(active);


  let matchedAll = 0;
  let matchedMultiple = 0;


  for(const entries of map.values()) {

    const ids =
      new Set(
        entries.map(
          e=>e.source.id
        )
      );


    if(ids.size > 1)
      matchedMultiple++;


    if(ids.size === active.length)
      matchedAll++;
  }



  const diagnostics =
    active.map(
      source => {

        let matched = 0;

        const unique:string[]=[];


        for(const player of source.players) {

          const entries =
            map.get(
              getProjectionPlayerKey(player)
            ) ?? [];


          const other =
            entries.some(
              e =>
                e.source.id !== source.id
            );


          if(other)
            matched++;
          else
            unique.push(player.name);
        }


        return {
          sourceId:source.id,
          sourceName:source.name,
          playerCount:source.players.length,
          matchedPlayers:matched,
          uniquePlayers:
            source.players.length - matched,
          matchPercentage:
            round(
              matched /
              source.players.length *
              100,
              1
            ),
          uniquePlayerNames:
            unique.sort()
        };
      }
    );


  return {
    activeSourceCount:active.length,
    totalUniquePlayers:map.size,
    matchedAcrossAllSources:matchedAll,
    matchedAcrossMultipleSources:matchedMultiple,
    sources:diagnostics
  };
}




/*
 BLEND
*/

export type BlendedSkaterProjection = SkaterProjection & {
  projectionSources?: number;
  projectionConfidence?: "HIGH" | "MEDIUM" | "LOW";
  projectionVariance?: number;
};


export function blendSkaterProjections(
  sources: ProjectionSource[]
): BlendedSkaterProjection[] {


  const active =
    sources.filter(
      source =>
        source.weight > 0 &&
        source.players.length > 0
    );


  if(active.length === 0)
    return [];


  if(active.length === 1) {
    return active[0].players.map(player => ({
      ...player,
  
      projectionSources: 1,
  
      projectionConfidence: "LOW",
  
      projectionVariance: 0,
    }));
  }



  const map =
    buildPlayerMap(active);


  const blended:BlendedSkaterProjection[]=[];


  for(const [key,entries] of map) {


    const primary =
      getPrimaryEntry(entries);


    if(!primary)
      continue;


    const ageEntries =
      entries.filter(
        e =>
          e.player.age > 0
      );


    blended.push({

      id:
        `blend-${key}`,

      name:
        primary.player.name,


      age:
        ageEntries.length
        ? getWeightedAge(ageEntries)
        : primary.player.age,


      team:
        normalizeTeam(
          primary.player.team
        ),


      positions:
        getCombinedPositions(entries),


        projectionSources:
        entries.length,
      
      projectionConfidence:
        getProjectionConfidence(
          entries
        ),
      
      projectionVariance:
        calculateProjectionVariance(
          entries
        ),


      gp:
        getWeightedValue(entries,"gp"),

      goals:
        getWeightedValue(entries,"goals"),

      assists:
        getWeightedValue(entries,"assists"),

      points:
        getWeightedValue(entries,"points"),

      ppp:
        getWeightedValue(entries,"ppp"),

      sog:
        getWeightedValue(entries,"sog"),

      hits:
        getWeightedValue(entries,"hits"),

      blocks:
        getWeightedValue(entries,"blocks"),

    });
  }


  return blended;
}