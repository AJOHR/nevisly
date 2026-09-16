import type { BaseRankedPlayer, RankedPlayer } from './legacy';

/** Legacy display shape, without running the former scoring heuristics. */
export function initializeRankedPlayer(player:BaseRankedPlayer):RankedPlayer {
  return {...player,score:player.vor,needBonus:0,tierDrop:0,cappedTierDrop:0,tierScarcityBonus:0,h2hGain:0,
    scarcityBonus:0,scarcityReasons:[],returnRisk:'SAFE',returnProbability:0,returnReason:'',picksUntilNext:0,
    seasonOffNightGames:0,playoffGames:0,playoffOffNightGames:0,playoffWeekGames:[0,0,0],playoffWeekOffNights:[0,0,0],scheduleBonus:0};
}
