import { SeasonState, TeamDecision } from "@/types/sim";

export function mergeDecisions(season: SeasonState, decisions: TeamDecision[]): TeamDecision[] {
  const key = (d: TeamDecision) => `${d.teamId}:${d.week}:${d.tick}`;
  const decisionMap = new Map(season.pendingDecisions.map((d) => [key(d), d]));

  decisions.forEach((decision) => {
    decisionMap.set(key(decision), decision);
  });

  return Array.from(decisionMap.values());
}

export function validateDecision(decision: TeamDecision) {
  const spends = [decision.rdSpend, decision.reliabilitySpend, decision.facilitySpend, decision.staffSpend];
  return spends.every((value) => value >= 0);
}
