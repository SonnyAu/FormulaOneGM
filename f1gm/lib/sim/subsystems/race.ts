import { RaceResult, SeasonState, TeamState } from "@/types/sim";

const pointsScale = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function raceScore(team: TeamState): number {
  const noise = Math.random() * 8 - 4;
  return team.car.pace * 0.6 + team.car.efficiency * 0.2 + team.car.reliability * 0.2 + noise;
}

export function simulateRaceWeekend(season: SeasonState, raceName: string): RaceResult {
  const entries = Object.values(season.teams)
    .map((team) => ({ team, score: raceScore(team) }))
    .sort((a, b) => b.score - a.score);

  const finishingOrder = entries.map(({ team }, index) => {
    const dnfChance = Math.max(0.02, (100 - team.car.reliability) / 350);
    const dnf = Math.random() < dnfChance;
    return {
      teamId: team.id,
      points: dnf ? 0 : (pointsScale[index] ?? 0),
      dnf,
    };
  });

  finishingOrder.forEach((result, index) => {
    const team = season.teams[result.teamId];
    team.standings.points += result.points;
    if (index === 0 && !result.dnf) team.standings.wins += 1;
    if (index < 3 && !result.dnf) team.standings.podiums += 1;
  });

  return {
    seasonYear: season.seasonYear,
    round: season.currentRound,
    raceName,
    week: season.currentWeek,
    finishingOrder,
  };
}
