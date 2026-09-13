import type { ProjectionField } from '@/lib/projections/quality';
export type SkaterProjection = {
    /** Numeric placeholders for absent input are never used in scoring/blending. */
    missingFields?: ProjectionField[];
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