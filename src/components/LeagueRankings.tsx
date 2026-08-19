"use client";

type FantasyTeam = {
  id: string;
  name: string;
  isMyTeam: boolean;
};

type LeagueSkater = {
  id: string;
  name: string;
  goals: number;
  assists: number;
  points: number;
  ppp: number;
  sog: number;
  hits: number;
  blocks: number;
};

type Props = {
  fantasyTeams: FantasyTeam[];
  leagueTeamPlayers: Map<string, LeagueSkater[]>;
};

export default function LeagueRankings({
  fantasyTeams,
}: Props) {
  return (
    <div className="mb-6 rounded-xl border border-violet-900/60 bg-zinc-900 p-5">
      <h2 className="text-2xl font-bold">
        League Rankings
      </h2>

      <p className="mt-2 text-zinc-400">
        {fantasyTeams.length} fantasy teams loaded.
      </p>
    </div>
  );
}