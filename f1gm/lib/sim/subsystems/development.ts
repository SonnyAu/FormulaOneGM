import { TeamDecision, TeamState, TeamUpgradeProject } from "@/types/sim";

function nextProjectId(teamId: string, week: number, area: TeamUpgradeProject["area"]) {
  return `${teamId}-${area}-${week}-${Math.random().toString(16).slice(2, 6)}`;
}

export function processDevelopment(team: TeamState, decision: TeamDecision, week: number): TeamState {
  const queue = [...team.rd.queue];

  if (decision.rdSpend > 600_000) {
    const rdArea: TeamUpgradeProject["area"] = decision.focus === "balanced" ? "aero" : decision.focus;
    queue.push({
      id: nextProjectId(team.id, week, rdArea),
      teamId: team.id,
      area: rdArea,
      startedWeek: week,
      targetWeek: week + 2,
      progress: 0,
      cost: decision.rdSpend,
      gain: 1 + Math.round(decision.rdSpend / 750_000),
      completed: false,
    });
  }

  if (decision.reliabilitySpend > 350_000) {
    queue.push({
      id: nextProjectId(team.id, week, "reliability"),
      teamId: team.id,
      area: "reliability",
      startedWeek: week,
      targetWeek: week + 1,
      progress: 0,
      cost: decision.reliabilitySpend,
      gain: 1 + Math.round(decision.reliabilitySpend / 500_000),
      completed: false,
    });
  }

  const updatedQueue = queue.map((project) => {
    if (project.completed) return project;
    const progressGain = 40 + Math.round((team.staff.engineering + team.facilities.factory) / 8);
    const nextProgress = Math.min(100, project.progress + progressGain);
    return {
      ...project,
      progress: nextProgress,
      completed: nextProgress >= 100 || week >= project.targetWeek,
    };
  });

  let paceGain = 0;
  let reliabilityGain = 0;

  updatedQueue.forEach((project) => {
    if (!project.completed) return;
    if (project.area === "reliability") reliabilityGain += project.gain;
    else paceGain += project.gain;
  });

  return {
    ...team,
    rd: {
      ...team.rd,
      queue: updatedQueue,
      aero: team.rd.aero + (decision.focus === "aero" ? 1 : 0),
      power: team.rd.power + (decision.focus === "power" ? 1 : 0),
      mechanical: team.rd.mechanical + (decision.focus === "mechanical" ? 1 : 0),
      reliability: team.rd.reliability + Math.round(decision.reliabilitySpend / 350_000),
    },
    facilities: {
      ...team.facilities,
      factory: team.facilities.factory + Math.round(decision.facilitySpend / 2_000_000),
      simulator: team.facilities.simulator + Math.round(decision.staffSpend / 2_500_000),
      cfd: team.facilities.cfd + Math.round(decision.rdSpend / 3_000_000),
    },
    car: {
      ...team.car,
      pace: team.car.pace + paceGain,
      reliability: team.car.reliability + reliabilityGain,
    },
  };
}
