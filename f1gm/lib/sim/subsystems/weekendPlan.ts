import { getCarProfile } from "@/data/carProfiles";
import { resolveTrackProfile } from "@/lib/sim/raceweekend/trackProfiles";
import { SeasonState, TeamDecision, TeamState, WeekendPlan } from "@/types/sim";

export function defaultWeekendPlan(): WeekendPlan {
  return {
    developmentFocus: "balanced",
    investmentLevel: "steady",
    facilityUpgrade: "none",
    sponsorRisk: "balanced",
    autoManaged: false,
  };
}

// Per-weekend discretionary spend is sized off weekly income so it scales for works and
// back-marker teams alike, while staying close to the old weekly balance.
const INVESTMENT_MULTIPLIER: Record<WeekendPlan["investmentLevel"], number> = {
  save: 0.3,
  steady: 0.6,
  push: 1.0,
};

/** Translate a casual WeekendPlan into the existing TeamDecision simulation contract. */
export function weekendPlanToDecision(
  team: TeamState,
  plan: WeekendPlan,
  week: number,
  tick: number,
  source: TeamDecision["source"] = "player",
): TeamDecision {
  const totalSpend = Math.max(0, Math.round(team.weeklyIncome * INVESTMENT_MULTIPLIER[plan.investmentLevel]));

  const facilityPortion = plan.facilityUpgrade === "none" ? 0 : Math.round(totalSpend * 0.35);
  const devPortion = totalSpend - facilityPortion;

  let rdSpend = 0;
  let reliabilitySpend = 0;
  let facilitySpend = 0;
  let staffSpend = 0;
  let focus: TeamDecision["focus"] = "balanced";

  switch (plan.developmentFocus) {
    case "reliability":
      reliabilitySpend = Math.round(devPortion * 0.7);
      rdSpend = devPortion - reliabilitySpend;
      focus = "balanced";
      break;
    case "balanced":
      rdSpend = Math.round(devPortion * 0.6);
      reliabilitySpend = Math.round(devPortion * 0.2);
      staffSpend = devPortion - rdSpend - reliabilitySpend;
      focus = "balanced";
      break;
    default:
      rdSpend = Math.round(devPortion * 0.8);
      reliabilitySpend = devPortion - rdSpend;
      focus = plan.developmentFocus;
      break;
  }

  // Facility/CFD/simulator upgrades route the reserved portion to the matching bucket
  // (processDevelopment maps facilitySpend->factory, staffSpend->simulator, rdSpend->cfd).
  if (plan.facilityUpgrade === "factory") facilitySpend += facilityPortion;
  else if (plan.facilityUpgrade === "simulator") staffSpend += facilityPortion;
  else if (plan.facilityUpgrade === "cfd") rdSpend += facilityPortion;

  return {
    teamId: team.id,
    week,
    tick,
    rdSpend,
    reliabilitySpend,
    facilitySpend,
    staffSpend,
    sponsorRisk: plan.sponsorRisk,
    focus,
    source,
    notes: source === "ai" ? "AI weekend development plan" : "Weekend development plan",
  };
}

/** Derive an AI team's weekend plan from its strategy personality and car state. */
export function aiWeekendPlan(team: TeamState): WeekendPlan {
  const profile = team.strategyProfile;
  const investmentLevel: WeekendPlan["investmentLevel"] =
    profile.aggression > 0.6 && profile.budgetDiscipline < 0.7 ? "push" : profile.aggression > 0.4 ? "steady" : "save";
  const sponsorRisk: WeekendPlan["sponsorRisk"] = profile.riskTolerance > 0.65 ? "high" : profile.riskTolerance > 0.4 ? "balanced" : "low";
  const developmentFocus: WeekendPlan["developmentFocus"] =
    team.car.reliability < 65 ? "reliability" : profile.developmentBias;

  return { developmentFocus, investmentLevel, facilityUpgrade: "none", sponsorRisk, autoManaged: false };
}

type FocusScore = {
  focus: WeekendPlan["developmentFocus"];
  capability: string;
  weakness: number;
  importance: number;
  priority: number;
};

function upcomingRaceTracks(season: SeasonState) {
  return season.calendar
    .filter((entry) => entry.type === "race" && entry.week >= season.currentWeek)
    .slice(0, 3)
    .map((entry) => resolveTrackProfile(entry.trackId ?? entry.name));
}

function average(values: number[]): number {
  if (values.length === 0) return 0.5;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Race Engineer advisor: inspect the team's car weaknesses against the demands of the next
 * few circuits and recommend a plan, with a plain-English rationale.
 */
export function recommendWeekendPlan(team: TeamState, season: SeasonState): { plan: WeekendPlan; rationale: string } {
  const car = getCarProfile(team.id, team.car);
  const tracks = upcomingRaceTracks(season);

  const topSpeedDemand = average(tracks.map((t) => t.demands.topSpeed));
  const downforceDemand = average(tracks.map((t) => t.demands.downforce));
  const gripDemand = average(tracks.map((t) => (t.demands.lowSpeed + t.demands.traction) / 2));

  const scores: FocusScore[] = [
    { focus: "power", capability: "top speed", weakness: 90 - car.topSpeed, importance: topSpeedDemand, priority: (90 - car.topSpeed) * topSpeedDemand },
    { focus: "aero", capability: "downforce", weakness: 90 - car.downforce, importance: downforceDemand, priority: (90 - car.downforce) * downforceDemand },
    { focus: "mechanical", capability: "mechanical grip", weakness: 90 - car.mechanicalGrip, importance: gripDemand, priority: (90 - car.mechanicalGrip) * gripDemand },
    { focus: "reliability", capability: "reliability", weakness: 90 - car.reliability, importance: 0.7, priority: (90 - car.reliability) * 0.7 },
  ];

  scores.sort((a, b) => b.priority - a.priority);
  const top = scores[0];

  const budget = team.budget;
  const investmentLevel: WeekendPlan["investmentLevel"] = budget > 140_000_000 ? "push" : budget > 80_000_000 ? "steady" : "save";
  const sponsorRisk: WeekendPlan["sponsorRisk"] = budget < 70_000_000 ? "high" : "balanced";

  const facilityUpgrade: WeekendPlan["facilityUpgrade"] =
    investmentLevel === "push" && team.facilities.factory < 70 ? "factory" : "none";

  const plan: WeekendPlan = {
    developmentFocus: top.focus,
    investmentLevel,
    facilityUpgrade,
    sponsorRisk,
    autoManaged: false,
  };

  const trackNames = tracks.map((t) => t.raceName).join(", ") || "the upcoming races";
  const focusLabel = top.focus === "reliability" ? "reliability" : `${top.capability} (${top.focus})`;
  const rationale =
    budget < 70_000_000
      ? `Budget is tight, so we should chase bigger sponsor payouts and invest carefully. Your ${top.capability} is the weakest area heading into ${trackNames}.`
      : `Your ${top.capability} is our weakest area and ${trackNames} reward it - recommend a ${focusLabel} ${investmentLevel} this weekend.`;

  return { plan, rationale };
}
