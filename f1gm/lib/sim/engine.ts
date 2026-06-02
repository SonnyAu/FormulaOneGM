import { processDevelopment } from "@/lib/sim/subsystems/development";
import { aiWeekendPlan, defaultWeekendPlan, recommendWeekendPlan, weekendPlanToDecision } from "@/lib/sim/subsystems/weekendPlan";
import { buildRaceHeadlines } from "@/lib/sim/news";
import { applyRaceWeekendResult, createRaceWeekendFromSeason } from "@/lib/sim/raceweekend/adapter";
import { EventLogEntry, SaveData, SaveDifficulty, SeasonState, SimulationDelta, TeamDecision, TeamState, WeekendPlan } from "@/types/sim";

function event(category: EventLogEntry["category"], message: string, week: number, tick: number, teamId?: string): EventLogEntry {
  return {
    id: `${category}-${week}-${tick}-${Math.random().toString(16).slice(2, 6)}`,
    category,
    message,
    week,
    tick,
    teamId,
    createdAt: new Date().toISOString(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function raceSeed(save: SaveData, round: number): number {
  let hash = 2166136261;
  const source = `${save.meta.id}-${save.season.seasonYear}-${round}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Passive weekly cash flow: income + base sponsor payout - running costs. No discretionary spend. */
function applyPassiveWeeklyEconomy(team: TeamState): TeamState {
  const nextBudget = team.budget + team.weeklyIncome + team.sponsors.basePayout - team.weeklyCosts;
  return {
    ...team,
    budget: nextBudget,
    morale: clamp(team.morale + (nextBudget >= team.budget ? 1 : -2), 0, 100),
  };
}

/** Apply a weekend plan's discretionary spend and sponsor-risk effect (income is handled weekly). */
function applyWeekendSpendAndSponsor(team: TeamState, decision: TeamDecision): TeamState {
  const spend = decision.rdSpend + decision.reliabilitySpend + decision.facilitySpend + decision.staffSpend;
  const sponsorMultiplier = decision.sponsorRisk === "high" ? 1.08 : decision.sponsorRisk === "balanced" ? 1.03 : 1;
  const sponsorConfidenceDelta = decision.sponsorRisk === "high" ? -2 : decision.sponsorRisk === "balanced" ? 0 : 1;
  const sponsorBonus = Math.round(team.sponsors.basePayout * (sponsorMultiplier - 1));

  return {
    ...team,
    budget: team.budget - spend + sponsorBonus,
    sponsors: {
      ...team.sponsors,
      confidence: clamp(team.sponsors.confidence + sponsorConfidenceDelta, 0, 100),
    },
  };
}

function resolvePlayerPlan(season: SeasonState, team: TeamState, difficulty: SaveDifficulty): WeekendPlan {
  const committed = season.pendingWeekendPlan;
  if (committed && !committed.autoManaged) return committed;
  if (committed && committed.autoManaged) return recommendWeekendPlan(team, season).plan;
  return difficulty === "easy" ? recommendWeekendPlan(team, season).plan : defaultWeekendPlan();
}

/**
 * Resolve the per-weekend factory development for every team: the player's committed plan
 * (or the advisor's recommendation when auto-managed / on easy), and AI plans from personality.
 * Applies discretionary spend + R&D progress, then clears the committed plan.
 */
function applyWeekendDevelopment(season: SeasonState, playerTeamId: string, difficulty: SaveDifficulty): EventLogEntry[] {
  const events: EventLogEntry[] = [];
  const week = season.currentWeek;

  for (const team of Object.values(season.teams)) {
    const plan = team.id === playerTeamId ? resolvePlayerPlan(season, team, difficulty) : aiWeekendPlan(team);
    const decision = weekendPlanToDecision(team, plan, week, season.tick, team.id === playerTeamId ? "player" : "ai");

    let updated = applyWeekendSpendAndSponsor(team, decision);
    updated = processDevelopment(updated, decision, week);
    season.teams[team.id] = updated;
    season.decisionHistory.push(decision);
  }

  const player = season.teams[playerTeamId];
  if (player) {
    events.push(event("rd", `${player.abbreviation} development plan applied for the race weekend.`, week, season.tick, playerTeamId));
  }

  season.pendingWeekendPlan = null;
  return events;
}

/**
 * Advance the season by one week. Runs passive economy for all teams. On a race week it launches
 * the interactive race weekend (set on `season.activeRaceWeekend`) and does NOT advance the
 * week/round - the player plays it out, after which `finalizeRaceWeekend` resolves development,
 * records the result and advances time.
 */
export function runSimulationTick(save: SaveData, playerDecisions: TeamDecision[]): { save: SaveData; delta: SimulationDelta } {
  const next = structuredClone(save) as SaveData;
  const season = next.season;

  // A race weekend already in progress must be completed before time advances again.
  if (season.activeRaceWeekend) {
    const delta: SimulationDelta = { tick: season.tick, week: season.currentWeek, appliedDecisions: [], events: [] };
    return { save: next, delta };
  }

  season.tick += 1;
  if (playerDecisions.length) season.decisionHistory.push(...playerDecisions);
  season.pendingDecisions = [];

  const events: EventLogEntry[] = [];

  for (const team of Object.values(season.teams)) {
    season.teams[team.id] = applyPassiveWeeklyEconomy(team);
  }

  const calendarEvent = season.calendar.find((entry) => entry.week === season.currentWeek) ?? null;

  if (calendarEvent?.type === "race") {
    // Launch the interactive race weekend; week/round advance only after it is played out.
    season.activeRaceWeekend = createRaceWeekendFromSeason(season, calendarEvent, next.meta.playerTeamId, raceSeed(next, calendarEvent.round));
    events.push(event("race", `Race weekend underway: ${calendarEvent.name}.`, season.currentWeek, season.tick));
    next.meta.updatedAt = new Date().toISOString();
    season.eventLog.push(...events);
    const delta: SimulationDelta = { tick: season.tick, week: season.currentWeek, appliedDecisions: [], events };
    return { save: next, delta };
  }

  season.currentWeek += 1;
  next.meta.week = season.currentWeek;
  next.meta.updatedAt = new Date().toISOString();
  season.eventLog.push(...events);

  const delta: SimulationDelta = {
    tick: season.tick,
    week: season.currentWeek,
    appliedDecisions: [],
    events,
  };

  return { save: next, delta };
}

/**
 * Finalize a completed (or skipped) race weekend: resolve the weekend's factory development,
 * write race results into the season, append the RaceResult, clear the active weekend, then
 * advance the week and round.
 */
export function finalizeRaceWeekend(save: SaveData): { save: SaveData; delta: SimulationDelta } {
  const next = structuredClone(save) as SaveData;
  const season = next.season;
  const weekend = season.activeRaceWeekend;

  const events: EventLogEntry[] = [];

  if (weekend) {
    const raceResult = applyRaceWeekendResult(season, weekend);
    season.raceHistory.push(raceResult);
    season.currentRound += 1;
    events.push(event("race", `Race weekend completed: ${weekend.raceName}.`, season.currentWeek, season.tick));
    events.push(...buildRaceHeadlines(season, raceResult, weekend, next.meta.playerTeamId));
  }

  events.push(...applyWeekendDevelopment(season, next.meta.playerTeamId, next.meta.difficulty));

  season.activeRaceWeekend = null;
  season.currentWeek += 1;
  next.meta.week = season.currentWeek;
  next.meta.updatedAt = new Date().toISOString();
  season.eventLog.push(...events);

  const delta: SimulationDelta = {
    tick: season.tick,
    week: season.currentWeek,
    raceResult: season.raceHistory[season.raceHistory.length - 1],
    appliedDecisions: [],
    events,
  };

  return { save: next, delta };
}
