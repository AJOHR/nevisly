import Papa from "papaparse";
import type { SkaterProjection } from "@/types/player";

type ProjectionRow = {
  Player?: string;
  Age?: string | number;
  Pos?: string;
  Team?: string;
  GP?: string | number;
  Goals?: string | number;
  Assists?: string | number;
  Points?: string | number;
  "PP Points"?: string | number;
  SOG?: string | number;
  Hits?: string | number;
  BLK?: string | number;
};

function num(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseSkaterCsv(
  file: File
): Promise<SkaterProjection[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<ProjectionRow>(file, {
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        const players = results.data
          .filter((row) => row.Player)
          .map((row, index) => ({
            id: `${row.Player}-${row.Team}-${index}`,

            name: row.Player?.trim() ?? "",

            age: num(row.Age),

            team: row.Team?.trim() ?? "",

            positions:
              row.Pos?.split(/[,/]/)
                .map((position) => position.trim())
                .filter(Boolean) ?? [],

            gp: num(row.GP),
            goals: num(row.Goals),
            assists: num(row.Assists),
            points: num(row.Points),
            ppp: num(row["PP Points"]),
            sog: num(row.SOG),
            hits: num(row.Hits),
            blocks: num(row.BLK),
          }));

        resolve(players);
      },

      error: (error) => {
        reject(error);
      },
    });
  });
}