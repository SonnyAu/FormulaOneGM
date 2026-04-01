import { DashboardSummary, SaveData } from "@/types/sim";

export function getDashboardSummary(save: SaveData): DashboardSummary {
  const playerTeam = save.season.teams[save.meta.playerTeamId];
  const standings = Object.values(save.season.teams)
    .map((team) => ({ teamId: team.id, abbreviation: team.abbreviation, points: team.standings.points }))
    .sort((a, b) => b.points - a.points);

  return {
    meta: save.meta,
    playerTeam: {
      id: playerTeam.id,
      name: playerTeam.name,
      abbreviation: playerTeam.abbreviation,
      budget: playerTeam.budget,
      points: playerTeam.standings.points,
      pace: playerTeam.car.pace,
      reliability: playerTeam.car.reliability,
    },
    standings,
    upcomingEvent: save.season.calendar.find((entry) => entry.week === save.season.currentWeek) ?? null,
    recentEvents: save.season.eventLog.slice(-8).reverse(),
  };
}
