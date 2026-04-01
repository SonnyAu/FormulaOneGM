import { TeamDecision, TeamState } from "@/types/sim";

export function processEconomy(team: TeamState, decision: TeamDecision): TeamState {
  const spend = decision.rdSpend + decision.reliabilitySpend + decision.facilitySpend + decision.staffSpend;
  const sponsorMultiplier = decision.sponsorRisk === "high" ? 1.08 : decision.sponsorRisk === "balanced" ? 1.03 : 1;
  const sponsorConfidenceDelta = decision.sponsorRisk === "high" ? -2 : decision.sponsorRisk === "balanced" ? 0 : 1;

  const nextBudget = team.budget + team.weeklyIncome + team.sponsors.basePayout * sponsorMultiplier - team.weeklyCosts - spend;

  return {
    ...team,
    budget: nextBudget,
    sponsors: {
      ...team.sponsors,
      confidence: Math.max(0, Math.min(100, team.sponsors.confidence + sponsorConfidenceDelta)),
    },
    morale: Math.max(0, Math.min(100, team.morale + (nextBudget > 0 ? 1 : -2))),
  };
}
