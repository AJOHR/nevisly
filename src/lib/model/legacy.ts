import type { SkaterProjection } from '@/types/player';
import type { DraftPick, FantasyTeam } from '@/types/draft';
import { projectionAgeAdjustment } from '@/lib/projections/quality';
import { calculateH2HImpact } from '@/lib/draft/h2hImpact';
import { calculateDraftRoomScarcity } from '@/lib/draft/draftRoomScarcity';
import { calculateScheduleBonus, type PlayoffScheduleMap, type ScheduleAverages } from '@/lib/draft/playoffSchedule';
import { calculateReturnRisk, type ReturnRiskLevel } from '@/lib/draft/returnRisk';
const categoryKeys = [
    "goals",
    "assists",
    "points",
    "ppp",
    "sog",
    "hits",
    "blocks",
] as const;
const STARTERS_PER_TEAM: Record<string, number> = {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
};
const SCHEDULE_TEAM_ALIASES: Record<string, string> = {
    TB: "TBL",
    LA: "LAK",
    NJ: "NJD",
    SJ: "SJS",
    WAS: "WSH",
    CLB: "CBJ",
    MON: "MTL",
};
type CategoryKey = (typeof categoryKeys)[number];
export type BaseRankedPlayer = SkaterProjection & {
    rawScore: number;
    vor: number;
    replacementPosition: string;
    zScores: Record<CategoryKey, number>;
    projectionSources?: number;
    projectionConfidence?: "HIGH" | "MEDIUM" | "LOW";
    projectionVariance?: number;
};
export type RankedPlayer = BaseRankedPlayer & {
    needBonus: number;
    tierDrop: number;
    cappedTierDrop: number;
    tierScarcityBonus: number;
    h2hGain: number;
    scarcityBonus: number;
    scarcityReasons: string[];
    returnRisk: ReturnRiskLevel;
    returnProbability: number;
    returnReason: string;
    picksUntilNext: number;
    seasonOffNightGames: number;
    playoffGames: number;
    playoffOffNightGames: number;
    playoffWeekGames: [
        number,
        number,
        number
    ];
    playoffWeekOffNights: [
        number,
        number,
        number
    ];
    scheduleBonus: number;
    projectionSources?: number;
    projectionConfidence?: "HIGH" | "MEDIUM" | "LOW";
    projectionVariance?: number;
    score: number;
    contributions?: Record<string, number>;
    appliedScarcityBonus?: number; appliedNeedBonus?: number; categoryBreadthScore?: number; categoryBreadthBonus?: number; powerForwardRaw?: number; powerForwardBonus?: number; draftStrategyBonus?: number;
};
function getTierGroup(player: BaseRankedPlayer) {
    if (player.positions.includes("D")) {
        return "D";
    }
    if (player.positions.includes("G")) {
        return "G";
    }
    return "F";
}
function getTeamSchedule(schedule: PlayoffScheduleMap, team: string) {
    const normalized = team
        .trim()
        .toUpperCase();
    const direct = schedule[normalized];
    if (direct) {
        return direct;
    }
    const alias = SCHEDULE_TEAM_ALIASES[normalized];
    if (alias) {
        return schedule[alias];
    }
    return undefined;
}
export type FinalContext = {
    rankedPlayers: RankedPlayer[];
    draftedIds: Set<string>;
    fantasyTeams: FantasyTeam[];
    leagueTeamPlayers: Map<string, RankedPlayer[]>;
    draftPicks: DraftPick[];
    leagueTeams: number;
    myDraftSlot: number;
    openStarterPositions: string[];
    playoffSchedule: PlayoffScheduleMap;
    scheduleAverages: ScheduleAverages;
    currentRound: number;
    myTeamPlayers: RankedPlayer[];
};
export function legacyBase(players: SkaterProjection[], leagueTeams: number) {
    if (players.length === 0) {
        return [];
    }
    // ... your existing stats calculation above ...
    // rest of your VOR logic continues here...
    const fantasyPool = [
        ...players,
    ]
        .sort((a, b) => b.points -
        a.points)
        .slice(0, 250);
    const stats = {} as Record<CategoryKey, {
        mean: number;
        stdDev: number;
    }>;
    for (const category of categoryKeys) {
        const values = fantasyPool.map((player) => player[category]);
        const mean = values.reduce((sum, value) => sum +
            value, 0) /
            values.length;
        const variance = values.reduce((sum, value) => sum +
            Math.pow(value -
                mean, 2), 0) /
            values.length;
        stats[category] = {
            mean,
            stdDev: Math.sqrt(variance),
        };
    }
    const basePlayers = players.map((player) => {
        const zScores = {} as Record<CategoryKey, number>;
        let rawScore = 0;
        for (const category of categoryKeys) {
            const { mean, stdDev, } = stats[category];
            const zScore = stdDev ===
                0
                ? 0
                : (player[category] -
                    mean) /
                    stdDev;
            zScores[category] =
                zScore;
            rawScore +=
                zScore;
        }
        return {
            ...player,
            rawScore,
            zScores,
        };
    });
    /*
     * Overall skater replacement baseline.
     *
     * 10 starting skater spots per team:
     * C x2, LW x2, RW x2, D x4.
     *
     * This gives us a neutral market baseline so
     * positional replacement does not completely
     * dominate VOR.
     */
    const overallStarterCount = leagueTeams * 10;
    const overallPlayers = [...basePlayers].sort((a, b) => b.rawScore -
        a.rawScore);
    const overallReplacementIndex = Math.max(0, Math.min(overallStarterCount - 1, overallPlayers.length - 1));
    const overallReplacementScore = overallPlayers[overallReplacementIndex]?.rawScore ?? 0;
    const replacementScores: Record<string, number> = {};
    for (const position of [
        "C",
        "LW",
        "RW",
        "D",
    ]) {
        const requiredStarters = leagueTeams *
            STARTERS_PER_TEAM[position];
        const positionalPlayers = basePlayers
            .filter((player) => player.positions.includes(position))
            .sort((a, b) => b.rawScore -
            a.rawScore);
        const replacementIndex = Math.max(0, Math.min(requiredStarters -
            1, positionalPlayers.length -
            1));
        replacementScores[position] =
            positionalPlayers[replacementIndex]?.rawScore ??
                0;
    }
    return basePlayers.map((player) => {
        const eligiblePositions = player.positions.filter((position) => replacementScores[position] !==
            undefined);
        let bestVor = Number.NEGATIVE_INFINITY;
        let bestPosition = eligiblePositions[0] ??
            "—";
        for (const position of eligiblePositions) {
            const positionalReplacement = replacementScores[position];
            /*
             * Blend positional replacement with the
             * overall skater market.
             *
             * 55% positional:
             * preserves legitimate position scarcity.
             *
             * 45% overall:
             * prevents a weak D48 replacement player
             * from making every good defenseman look
             * overwhelmingly more valuable than elite
             * forwards.
             */
            const blendedReplacement = positionalReplacement *
                0.55 +
                overallReplacementScore *
                    0.45;
            const vor = player.rawScore -
                blendedReplacement;
            if (vor >
                bestVor) {
                bestVor =
                    vor;
                bestPosition =
                    position;
            }
        }
        if (!Number.isFinite(bestVor)) {
            bestVor =
                player.rawScore;
        }
        return {
            ...player,
            vor: bestVor,
            replacementPosition: bestPosition,
        };
    });
}
export function legacyStrength(baseMyTeamPlayers: BaseRankedPlayer[]) {
    const result = {} as Record<CategoryKey, number>;
    for (const category of categoryKeys) {
        if (baseMyTeamPlayers.length ===
            0) {
            result[category] =
                0;
            continue;
        }
        result[category] =
            baseMyTeamPlayers.reduce((sum, player) => sum +
                player.zScores[category], 0) /
                baseMyTeamPlayers.length;
    }
    return result;
}
export function legacyWeights(baseMyTeamPlayers: BaseRankedPlayer[], teamCategoryStrength: Record<CategoryKey, number>) {
    const result = {} as Record<CategoryKey, number>;
    if (baseMyTeamPlayers.length ===
        0) {
        for (const category of categoryKeys) {
            result[category] =
                1;
        }
        return result;
    }
    const strengths = categoryKeys.map((category) => teamCategoryStrength[category]);
    const averageStrength = strengths.reduce((sum, value) => sum +
        value, 0) /
        strengths.length;
    for (const category of categoryKeys) {
        const relativeStrength = teamCategoryStrength[category] -
            averageStrength;
        result[category] =
            Math.max(0.75, Math.min(1.35, 1 -
                relativeStrength *
                    0.18));
    }
    return result;
}
export function legacyTiers(baseRankedPlayers: BaseRankedPlayer[], draftedIds: Set<string>) {
    const availableForTierAnalysis = baseRankedPlayers.filter((player) => !draftedIds.has(player.id));
    return {
        F: availableForTierAnalysis
            .filter((player) => getTierGroup(player) ===
            "F")
            .sort((a, b) => b.vor - a.vor),
        D: availableForTierAnalysis
            .filter((player) => getTierGroup(player) ===
            "D")
            .sort((a, b) => b.vor - a.vor),
        G: availableForTierAnalysis
            .filter((player) => getTierGroup(player) ===
            "G")
            .sort((a, b) => b.vor - a.vor),
    };
}
export function legacyFirstPass(baseRankedPlayers: BaseRankedPlayer[], currentRound: number, tierGroups: ReturnType<typeof legacyTiers>, teamNeedWeights: Record<CategoryKey, number>): RankedPlayer[] {
    return baseRankedPlayers.map((player) => {
        let needBonus = 0;
        const tierGroup = getTierGroup(player);
        const positionTier = tierGroups[tierGroup];
        const playerTierIndex = positionTier.findIndex((candidate) => candidate.id ===
            player.id);
        let tierDrop = 0;
        if (playerTierIndex >= 0) {
            /*
             * Look at the next three available players
             * at the same broad position.
             */
            const nextPlayers = positionTier.slice(playerTierIndex + 1, playerTierIndex + 4);
            if (nextPlayers.length > 0) {
                const nextAverageVor = nextPlayers.reduce((total, candidate) => total +
                    candidate.vor, 0) /
                    nextPlayers.length;
                tierDrop =
                    Math.max(0, player.vor -
                        nextAverageVor);
            }
        }
        /*
         * Prevent extreme projection differences from
         * producing absurd scarcity bonuses.
         */
        const cappedTierDrop = Math.min(tierDrop, 2.5);
        let tierScarcityBonus = 0;
        /*
         * Round 1:
         * virtually ignore tier scarcity.
         *
         * We want the elite foundation player first.
         */
        if (currentRound === 1) {
            tierScarcityBonus =
                cappedTierDrop *
                    0.1;
        }
        /*
         * Rounds 2-3:
         * tier cliffs matter A LOT.
         *
         * This is where elite D can jump because
         * passing on them may mean a huge drop by
         * the next turn.
         */
        else if (currentRound >= 2 &&
            currentRound <= 3) {
            tierScarcityBonus =
                cappedTierDrop *
                    0.65;
        }
        /*
         * Rounds 4-5:
         * still important, but category construction
         * begins becoming more relevant.
         */
        else if (currentRound >= 4 &&
            currentRound <= 5) {
            tierScarcityBonus =
                cappedTierDrop *
                    0.65;
        }
        /*
         * Round 6+:
         * tier drop remains useful but shouldn't
         * dominate category needs.
         */
        else {
            tierScarcityBonus =
                cappedTierDrop *
                    0.35;
        }
        /*
         * Goalies will eventually get their own model.
         * Don't let tier scarcity accidentally push
         * them up early yet.
         */
        if (tierGroup === "G" &&
            currentRound <= 8) {
            tierScarcityBonus *=
                0.25;
        }
        for (const category of categoryKeys) {
            needBonus +=
                player.zScores[category] *
                    (teamNeedWeights[category] -
                        1);
        }
        needBonus *=
            0.75;
        return {
            ...player,
            needBonus,
            tierDrop,
            cappedTierDrop,
            tierScarcityBonus,
            h2hGain: 0,
            scarcityBonus: 0,
            scarcityReasons: [],
            returnRisk: "SAFE",
            returnProbability: 0,
            returnReason: "",
            picksUntilNext: 0,
            seasonOffNightGames: 0,
            playoffGames: 0,
            playoffOffNightGames: 0,
            playoffWeekGames: [
                0,
                0,
                0,
            ] as [
                number,
                number,
                number
            ],
            playoffWeekOffNights: [
                0,
                0,
                0,
            ] as [
                number,
                number,
                number
            ],
            scheduleBonus: 0,
            score: player.vor +
                needBonus +
                tierScarcityBonus,
        };
    });
}
export function legacyFinal(context: FinalContext): RankedPlayer[] {
    const { rankedPlayers, draftedIds, fantasyTeams, leagueTeamPlayers, draftPicks, leagueTeams, myDraftSlot, openStarterPositions, playoffSchedule, scheduleAverages, currentRound, myTeamPlayers } = context;
    return rankedPlayers.map<RankedPlayer>((player): RankedPlayer => {
        const teamSchedule = getTeamSchedule(playoffSchedule, player.team);
        const seasonOffNightGames = teamSchedule
            ?.seasonOffNightGames ??
            0;
        const playoffGames = teamSchedule
            ?.playoffGames ??
            0;
        const playoffOffNightGames = teamSchedule
            ?.playoffOffNightGames ??
            0;
        const playoffWeekGames: [
            number,
            number,
            number
        ] = [
            teamSchedule
                ?.playoffByWeek?.["24"]?.games ??
                0,
            teamSchedule
                ?.playoffByWeek?.["25"]?.games ??
                0,
            teamSchedule
                ?.playoffByWeek?.["26"]?.games ??
                0,
        ];
        const playoffWeekOffNights: [
            number,
            number,
            number
        ] = [
            teamSchedule
                ?.playoffByWeek?.["24"]
                ?.offNightGames ??
                0,
            teamSchedule
                ?.playoffByWeek?.["25"]
                ?.offNightGames ??
                0,
            teamSchedule
                ?.playoffByWeek?.["26"]
                ?.offNightGames ??
                0,
        ];
        const scheduleBonus = calculateScheduleBonus(teamSchedule, scheduleAverages);
        const ageRiskBonus = projectionAgeAdjustment(player);
        if (draftedIds.has(player.id)) {
            return {
                ...player,
                h2hGain: 0,
                scarcityBonus: 0,
                scarcityReasons: [],
                returnRisk: "SAFE",
                returnProbability: 0,
                returnReason: "",
                picksUntilNext: 0,
                seasonOffNightGames,
                playoffGames,
                playoffOffNightGames,
                playoffWeekGames,
                playoffWeekOffNights,
                scheduleBonus,
                contributions: { vor: player.vor, categoryNeed: player.needBonus, schedule: scheduleBonus, age: ageRiskBonus },
                score: player.vor +
                    player.needBonus +
                    scheduleBonus +
                    ageRiskBonus,
            };
        }
        const h2h = calculateH2HImpact({
            player,
            fantasyTeams,
            leagueTeamPlayers,
        });
        const scarcity = calculateDraftRoomScarcity({
            player,
            allPlayers: rankedPlayers,
            draftPicks,
            fantasyTeams,
        });
        let flexibilityBonus = 0;
        if (player.positions.length ===
            2) {
            flexibilityBonus =
                0.1;
        }
        else if (player.positions.length >=
            3) {
            flexibilityBonus =
                0.18;
        }
        const coversOpenPosition = player.positions.some((position) => openStarterPositions.includes(position as "C" | "LW" | "RW" | "D"));
        if (coversOpenPosition &&
            player.positions.length >
                1) {
            flexibilityBonus +=
                0.08;
        }
        flexibilityBonus =
            Math.min(flexibilityBonus, 0.25);
        const returnRisk = calculateReturnRisk({
            player,
            allPlayers: rankedPlayers,
            draftPicks,
            fantasyTeams,
            leagueTeams,
            myDraftSlot,
        });
        const isGoalie = player.positions.includes("G");
        const isDefenseman = player.positions.includes("D");
        const isForward = player.positions.some((position) => position === "C" ||
            position === "LW" ||
            position === "RW");
        let draftStrategyBonus = 0;
        /*
         * ROUND 1 — FOUNDATION
         *
         * Prefer an elite forward as the roster anchor.
         * Defense is still allowed if the value gap is
         * genuinely large, but D should not win Round 1
         * simply because of positional scarcity.
         */
        if (currentRound === 1) {
            if (isForward) {
                draftStrategyBonus += 1.75;
            }
            if (isDefenseman) {
                draftStrategyBonus -= 1.75;
            }
            if (isGoalie) {
                draftStrategyBonus -= 4;
            }
        }
        /*
         * ROUNDS 2–3 — ATTACK PREMIUM DEFENSE
         *
         * Once the elite forward foundation is secured,
         * aggressively target the high-end D tier.
         */
        if (currentRound >= 2 &&
            currentRound <= 3) {
            if (isDefenseman) {
                /*
                 * Early D strategy should help premium D,
                 * not automatically push every defenseman
                 * above elite forwards.
                 */
                draftStrategyBonus +=
                    player.cappedTierDrop >= 0.75
                        ? 0.9
                        : 0.35;
            }
            if (isGoalie) {
                draftStrategyBonus -= 3;
            }
        }
        /*
         * ROUNDS 4–5 — CONTINUE D BUILD,
         * BUT WITH LESS FORCE
         */
        if (currentRound >= 4 &&
            currentRound <= 5) {
            if (isDefenseman) {
                draftStrategyBonus += 0.8;
            }
            if (isGoalie) {
                draftStrategyBonus -= 2.25;
            }
        }
        /*
         * ROUNDS 6–8 — TRANSITION
         *
         * Strategy becomes less positional and
         * increasingly about value/category needs.
         */
        if (currentRound >= 6 &&
            currentRound <= 8) {
            if (isDefenseman) {
                draftStrategyBonus += 0.25;
            }
            if (isGoalie) {
                draftStrategyBonus -= 1;
            }
        }
        /*
         * ROUND 9+
         *
         * No generic skater-position bonus.
         * Goalies are now allowed to compete normally.
         */
        /*
         * ROUND-AWARE SCARCITY
         *
         * Positional scarcity should barely influence
         * the first pick. VOR already contains a lot of
         * replacement-level positional information.
         *
         * Scarcity becomes more important after the
         * foundation pick and as tiers begin disappearing.
         */
        let appliedScarcityBonus = scarcity.scarcityBonus;
        if (currentRound === 1) {
            appliedScarcityBonus =
                scarcity.scarcityBonus *
                    0.2;
        }
        else if (currentRound >= 2 &&
            currentRound <= 3) {
            appliedScarcityBonus =
                scarcity.scarcityBonus *
                    0.65;
        }
        else if (currentRound >= 4 &&
            currentRound <= 5) {
            appliedScarcityBonus =
                scarcity.scarcityBonus *
                    0.85;
        }
        /*
         * ROUND-AWARE ROSTER NEED
         *
         * Early in the draft almost every roster slot
         * is empty, so "fills D", "fills LW", etc. should
         * not meaningfully drive the first selections.
         *
         * Roster need becomes increasingly important
         * once the team actually has a shape.
         */
        let appliedNeedBonus = player.needBonus;
        const mySkaterCount = myTeamPlayers.filter((teamPlayer) => !teamPlayer.positions.includes("G")).length;
        /*
         * Category needs are unreliable when the roster
         * is barely formed.
         */
        if (mySkaterCount <= 2) {
            appliedNeedBonus = 0;
        }
        else if (mySkaterCount <= 4) {
            appliedNeedBonus =
                player.needBonus * 0.25;
        }
        else if (currentRound <= 5) {
            appliedNeedBonus =
                player.needBonus * 0.6;
        }
        /*
         * CATEGORY BREADTH
         *
         * Early-round anchors should help across several
         * categories rather than being narrow specialists.
         *
         * We cap each Z-score so one enormous category
         * cannot dominate the breadth calculation.
         */
        const cappedCategoryZScores = [
            player.zScores.goals,
            player.zScores.assists,
            player.zScores.points,
            player.zScores.ppp,
            player.zScores.sog,
            player.zScores.hits,
            player.zScores.blocks,
        ].map((value) => Math.max(-2, Math.min(2, value)));
        const positiveCategoryCount = cappedCategoryZScores.filter((value) => value >= 0.5).length;
        const eliteCategoryCount = cappedCategoryZScores.filter((value) => value >= 1).length;
        /*
         * Breadth rewards contributing meaningfully
         * in several categories.
         *
         * Example:
         * 6 useful cats + 3 elite cats
         * receives much more credit than a player
         * who is elite in only one category.
         */
        const categoryBreadthScore = positiveCategoryCount *
            0.12 +
            eliteCategoryCount *
                0.08;
        let categoryBreadthBonus = 0;
        /*
         * Breadth matters most when establishing
         * the team's foundation.
         */
        if (currentRound === 1) {
            categoryBreadthBonus =
                categoryBreadthScore *
                    (isForward
                        ? 1
                        : 0.4);
        }
        else if (currentRound >= 2 &&
            currentRound <= 3) {
            categoryBreadthBonus =
                categoryBreadthScore *
                    0.7;
        }
        else if (currentRound >= 4 &&
            currentRound <= 5) {
            categoryBreadthBonus =
                categoryBreadthScore *
                    0.4;
        }
        else {
            categoryBreadthBonus =
                categoryBreadthScore *
                    0.15;
        }
        /*
         * POWER FORWARD SCORE
         *
         * In this league, the rare archetype is a
         * forward who supplies elite offense while
         * ALSO contributing SOG + HIT.
         *
         * We intentionally allow negative Z-scores
         * here. A pure scorer with terrible HIT
         * should not receive the same bonus as a
         * true multi-category power forward.
         */
        const powerForwardRaw = player.zScores.goals *
            0.20 +
            player.zScores.points *
                0.20 +
            player.zScores.ppp *
                0.15 +
            player.zScores.sog *
                0.20 +
            player.zScores.hits *
                0.25;
        let powerForwardBonus = 0;
        if (isForward) {
            if (currentRound === 1) {
                powerForwardBonus =
                    Math.max(0, powerForwardRaw) *
                        0.75;
            }
            else if (currentRound >= 2 &&
                currentRound <= 3) {
                powerForwardBonus =
                    Math.max(0, powerForwardRaw) *
                        0.5;
            }
            else if (currentRound >= 4 &&
                currentRound <= 5) {
                powerForwardBonus =
                    Math.max(0, powerForwardRaw) *
                        0.3;
            }
            else {
                powerForwardBonus =
                    Math.max(0, powerForwardRaw) *
                        0.1;
            }
        }
        return {
            ...player,
            h2hGain: h2h.matchupGain,
            scarcityBonus: scarcity.scarcityBonus,
            appliedScarcityBonus,
            appliedNeedBonus,
            categoryBreadthScore,
            categoryBreadthBonus,
            powerForwardRaw,
            powerForwardBonus,
            scarcityReasons: scarcity.reasons,
            returnRisk: returnRisk.level,
            returnProbability: returnRisk.probability,
            returnReason: returnRisk.reason,
            picksUntilNext: returnRisk.picksUntilNext,
            seasonOffNightGames,
            playoffGames,
            playoffOffNightGames,
            playoffWeekGames,
            playoffWeekOffNights,
            scheduleBonus,
            draftStrategyBonus,
            contributions: { vor: player.vor, categoryNeed: appliedNeedBonus, h2h: h2h.matchupGain * 1.25, scarcity: appliedScarcityBonus, tier: player.tierScarcityBonus, flexibility: flexibilityBonus, schedule: scheduleBonus, age: ageRiskBonus, roundStrategy: draftStrategyBonus, breadth: categoryBreadthBonus, powerForward: powerForwardBonus },
            score: player.vor +
                appliedNeedBonus +
                h2h.matchupGain *
                    1.25 +
                appliedScarcityBonus +
                player.tierScarcityBonus +
                flexibilityBonus +
                scheduleBonus +
                ageRiskBonus +
                draftStrategyBonus +
                categoryBreadthBonus +
                powerForwardBonus,
        };
    });
}
