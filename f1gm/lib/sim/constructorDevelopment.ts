import type {
  ConstructorDevelopmentReport,
  ConstructorDevelopmentTier,
  EventLogEntry,
  SaveData,
  TeamState,
} from "@/types/sim";

type RankedTeam = {
  team: TeamState;
  position: number;
  count: number;
};

type RollProfile = {
  tier: ConstructorDevelopmentTier;
  totalCarDelta: number;
  staffDelta: number;
  facilityDelta: number;
};

const MIN_RATING = 35;
const MAX_RATING = 99;

function clamp(value: number, min = MIN_RATING, max = MAX_RATING): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(source: string): number {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function teamQuality(team: TeamState): number {
  const car = average([team.car.pace, team.car.efficiency, team.car.reliability]) / 100;
  const staff = average([team.staff.engineering, team.staff.aeroLead, team.staff.operations]) / 100;
  const facilities = average([team.facilities.factory, team.facilities.cfd, team.facilities.simulator]) / 100;
  const budget = clamp(team.budget / 220_000_000, 0, 1);
  const culture = average([team.morale, team.sponsors.confidence]) / 100;

  return car * 0.26 + staff * 0.22 + facilities * 0.2 + budget * 0.18 + culture * 0.14;
}

function pickTier(ranked: RankedTeam, rng: () => number): ConstructorDevelopmentTier {
  const { team, position, count } = ranked;
  const quality = teamQuality(team);
  const gridPercentile = count <= 1 ? 1 : 1 - (position - 1) / (count - 1);
  const frontrunnerPressure = Math.max(0, gridPercentile - 0.72);
  const underdogUpside = Math.max(0, 0.45 - gridPercentile);
  const budgetStress = team.budget < 65_000_000 ? 0.1 : team.budget < 100_000_000 ? 0.045 : 0;
  const riskStress = team.strategyProfile.riskTolerance > 0.68 && team.strategyProfile.budgetDiscipline < 0.58 ? 0.045 : 0;
  const weakCulture = average([team.morale, team.sponsors.confidence]) < 52 ? 0.055 : 0;
  const excellence = Math.max(0, quality - 0.68);

  const weights: Record<ConstructorDevelopmentTier, number> = {
    breakthrough: 0.045 + underdogUpside * 0.12 + excellence * 0.08,
    gain: 0.27 + quality * 0.16 + underdogUpside * 0.06,
    stable: 0.43 + Math.max(0, quality - 0.5) * 0.08,
    setback: 0.2 + budgetStress + riskStress + weakCulture + frontrunnerPressure * 0.12,
    collapse: 0.025 + budgetStress * 0.35 + riskStress * 0.5 + weakCulture * 0.35 + frontrunnerPressure * 0.04,
  };

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  let cursor = rng() * total;
  for (const tier of ["breakthrough", "gain", "stable", "setback", "collapse"] as const) {
    cursor -= weights[tier];
    if (cursor <= 0) return tier;
  }
  return "stable";
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function rollProfile(tier: ConstructorDevelopmentTier, rng: () => number): RollProfile {
  switch (tier) {
    case "breakthrough":
      return { tier, totalCarDelta: randomInt(rng, 3, 7), staffDelta: randomInt(rng, 0, 2), facilityDelta: randomInt(rng, 0, 2) };
    case "gain":
      return { tier, totalCarDelta: randomInt(rng, 1, 3), staffDelta: rng() > 0.65 ? 1 : 0, facilityDelta: rng() > 0.75 ? 1 : 0 };
    case "setback":
      return { tier, totalCarDelta: -randomInt(rng, 2, 5), staffDelta: rng() > 0.7 ? -1 : 0, facilityDelta: rng() > 0.82 ? -1 : 0 };
    case "collapse":
      return { tier, totalCarDelta: -randomInt(rng, 5, 9), staffDelta: -randomInt(rng, 1, 2), facilityDelta: rng() > 0.45 ? -1 : -2 };
    case "stable":
    default:
      return { tier, totalCarDelta: randomInt(rng, -1, 1), staffDelta: 0, facilityDelta: 0 };
  }
}

function splitCarDelta(total: number, team: TeamState, rng: () => number) {
  if (total === 0) return { paceDelta: 0, efficiencyDelta: 0, reliabilityDelta: 0 };

  const sign = total > 0 ? 1 : -1;
  let remaining = Math.abs(total);
  let paceDelta = 0;
  let efficiencyDelta = 0;
  let reliabilityDelta = 0;

  while (remaining > 0) {
    const draw = rng();
    const reliabilityNeed = team.car.reliability < 65 ? 0.28 : 0.2;
    if (draw < 0.48) paceDelta += sign;
    else if (draw < 0.48 + reliabilityNeed) reliabilityDelta += sign;
    else efficiencyDelta += sign;
    remaining -= 1;
  }

  return { paceDelta, efficiencyDelta, reliabilityDelta };
}

function buildHeadline(team: TeamState, profile: RollProfile, paceDelta: number, reliabilityDelta: number): string {
  const movement = `pace ${signed(paceDelta)}, reliability ${signed(reliabilityDelta)}`;
  switch (profile.tier) {
    case "breakthrough":
      return `${team.name} found a winter breakthrough: ${movement}.`;
    case "gain":
      return `${team.name} made useful winter gains: ${movement}.`;
    case "setback":
      return `${team.name} missed its winter targets: ${movement}.`;
    case "collapse":
      return `${team.name} has a troubled new concept: ${movement}.`;
    case "stable":
    default:
      return `${team.name} enters the new season largely stable: ${movement}.`;
  }
}

function reportEvent(report: ConstructorDevelopmentReport, week: number, tick: number): EventLogEntry {
  return {
    id: `winter-${report.seasonYear}-${report.teamId}`,
    week,
    tick,
    teamId: report.teamId,
    category: "news",
    message: report.headline,
    createdAt: new Date().toISOString(),
  };
}

function rankedTeams(save: SaveData): RankedTeam[] {
  const teams = Object.values(save.season.teams).sort(
    (a, b) => b.standings.points - a.standings.points || b.standings.wins - a.standings.wins || a.name.localeCompare(b.name),
  );
  return teams.map((team, index) => ({ team, position: index + 1, count: teams.length }));
}

export function applyOffseasonConstructorDevelopment(save: SaveData, newSeasonYear: number): ConstructorDevelopmentReport[] {
  const reports: ConstructorDevelopmentReport[] = [];

  for (const ranked of rankedTeams(save)) {
    const team = ranked.team;
    const rng = createRng(`${save.meta.id}:${save.season.seasonYear}:${newSeasonYear}:${team.id}:constructor-development`);
    const profile = rollProfile(pickTier(ranked, rng), rng);
    const { paceDelta, efficiencyDelta, reliabilityDelta } = splitCarDelta(profile.totalCarDelta, team, rng);

    team.car = {
      pace: clamp(team.car.pace + paceDelta),
      efficiency: clamp(team.car.efficiency + efficiencyDelta),
      reliability: clamp(team.car.reliability + reliabilityDelta),
    };
    team.staff = {
      engineering: clamp(team.staff.engineering + profile.staffDelta),
      operations: clamp(team.staff.operations + Math.sign(profile.staffDelta), 35, 99),
      aeroLead: clamp(team.staff.aeroLead + profile.staffDelta),
    };
    team.facilities = {
      factory: clamp(team.facilities.factory + profile.facilityDelta),
      cfd: clamp(team.facilities.cfd + profile.facilityDelta),
      simulator: clamp(team.facilities.simulator + Math.sign(profile.facilityDelta), 35, 99),
    };
    team.morale = clamp(team.morale + (profile.tier === "breakthrough" ? 4 : profile.tier === "collapse" ? -5 : Math.sign(profile.totalCarDelta)), 0, 100);
    team.budget = Math.max(0, team.budget - (profile.tier === "collapse" ? 7_500_000 : profile.tier === "setback" ? 3_000_000 : 0));

    reports.push({
      seasonYear: newSeasonYear,
      teamId: team.id,
      teamName: team.name,
      paceDelta,
      efficiencyDelta,
      reliabilityDelta,
      staffDelta: profile.staffDelta,
      facilityDelta: profile.facilityDelta,
      tier: profile.tier,
      headline: buildHeadline(team, profile, paceDelta, reliabilityDelta),
    });
  }

  save.season.constructorDevelopmentHistory.push(...reports);
  save.season.eventLog.push(...reports.map((report) => reportEvent(report, 1, save.season.tick)));
  return reports;
}
