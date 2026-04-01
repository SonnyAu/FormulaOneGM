import { SeasonState, TeamDecision, TeamState } from "@/types/sim";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function aiDecisionForTeam(team: TeamState, week: number, tick: number): TeamDecision {
  const profile = team.strategyProfile;
  const budgetHealth = clamp(team.budget / 200_000_000, 0, 1);
  const aggressiveFactor = profile.aggression * 0.7 + profile.riskTolerance * 0.3;
  const disciplineFactor = profile.budgetDiscipline;

  const totalWeeklySpend = Math.round((1_500_000 + aggressiveFactor * 1_800_000) * (0.6 + budgetHealth * 0.8));
  const rdSpend = Math.round(totalWeeklySpend * (0.44 + (profile.developmentBias === "aero" ? 0.08 : 0)));
  const reliabilitySpend = Math.round(totalWeeklySpend * (0.12 + (team.car.reliability < 65 ? 0.08 : 0)));
  const facilitySpend = Math.round(totalWeeklySpend * (0.22 - disciplineFactor * 0.05));
  const staffSpend = Math.max(0, totalWeeklySpend - rdSpend - reliabilitySpend - facilitySpend);

  return {
    teamId: team.id,
    week,
    tick,
    rdSpend,
    reliabilitySpend,
    facilitySpend,
    staffSpend,
    focus: profile.developmentBias,
    sponsorRisk: aggressiveFactor > 0.65 ? "high" : aggressiveFactor > 0.4 ? "balanced" : "low",
    source: "ai",
    notes: "Auto-generated AI decision",
  };
}

export function generateAiDecisions(season: SeasonState, playerTeamId: string): TeamDecision[] {
  return Object.values(season.teams)
    .filter((team) => team.id !== playerTeamId)
    .map((team) => aiDecisionForTeam(team, season.currentWeek, season.tick + 1));
}
