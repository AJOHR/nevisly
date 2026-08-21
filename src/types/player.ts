export type SkaterProjection = {
    id: string;
    name: string;
    age: number;
    team: string;
    positions: string[];
  
    gp: number;
    goals: number;
    assists: number;
    points: number;
    ppp: number;
    sog: number;
    hits: number;
    blocks: number;
  
    projectionSources?: number;

    projectionConfidence?: 
      | "HIGH"
      | "MEDIUM"
      | "LOW";
  
    projectionVariance?: number;
  };