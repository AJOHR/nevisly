export type GoalieProjection = {
  id:string;
  name:string;
  team:string;
  gp:number;
  wins:number;
  svPct:number;
  shutouts:number;
};

export type GoalieRole = 'STARTER' | 'TANDEM' | 'BACKUP';

export type RankedGoalie = GoalieProjection & {
  score:number;
  zWins:number;
  zSvPct:number;
  zShutouts:number;
  role:GoalieRole;
  workloadShare:number;
  teamLeadGp:number;
  teamGapGp:number;
};
