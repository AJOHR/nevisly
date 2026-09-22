/** Independent dimensions; urgency and uncertainty are not intrinsic player production. */
export type DecisionAssessment = {
 playerValue: {score:number};
 teamFit: {adjustment:number};
 draftUrgency: {opponentSelections:number; level:'LOW'|'MODERATE'|'HIGH'|'VERY HIGH'|'UNKNOWN'; calibrated:false; adjustment:number};
 uncertainty: {warnings:string[]};
};
