import { generateAiDecisions } from "@/lib/sim/subsystems/ai";
import { mergeDecisions, validateDecision } from "@/lib/sim/subsystems/decision";
import { processDevelopment } from "@/lib/sim/subsystems/development";
import { processEconomy } from "@/lib/sim/subsystems/economy";
import { applyRaceWeekendResult, createRaceWeekendFromSeason } from "@/lib/sim/raceweekend/adapter";
import { EventLogEntry, SaveData, SimulationDelta, TeamDecision } from "@/types/sim";

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

function raceSeed(save: SaveData, round: number): number {
  let hash = 2166136261;
  const source = `${save.meta.id}-${save.season.seasonYear}-${round}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Advance the season by one tick. Processes weekly decisions/economy/development. When the
 * current week is a race week, instead of auto-simulating it launches an interactive race
 * weekend (set on `season.activeRaceWeekend`) and does NOT advance the week/round - the player
 * must play it out, after which `finalizeRaceWeekend` records the result and advances time.
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

  const aiDecisions = generateAiDecisions(season, next.meta.playerTeamId);
  const mergedDecisions = mergeDecisions(season, [...playerDecisions, ...aiDecisions]).filter(validateDecision);

  season.pendingDecisions = [];
  season.decisionHistory.push(...mergedDecisions);

  const events: EventLogEntry[] = [];

  mergedDecisions.forEach((decision) => {
    const team = season.teams[decision.teamId];
    if (!team) return;

    let updated = processEconomy(team, decision);
    updated = processDevelopment(updated, decision, season.currentWeek);
    season.teams[team.id] = updated;
    events.push(event("finance", `${team.abbreviation} budget updated after decision processing.`, season.currentWeek, season.tick, team.id));
  });

  const calendarEvent = season.calendar.find((entry) => entry.week === season.currentWeek) ?? null;

  if (calendarEvent?.type === "race") {
    // Launch the interactive race weekend; week/round advance only after it is played out.
    season.activeRaceWeekend = createRaceWeekendFromSeason(season, calendarEvent, next.meta.playerTeamId, raceSeed(next, calendarEvent.round));
    events.push(event("race", `Race weekend underway: ${calendarEvent.name}.`, season.currentWeek, season.tick));
    next.meta.updatedAt = new Date().toISOString();
    season.eventLog.push(...events);
    const delta: SimulationDelta = { tick: season.tick, week: season.currentWeek, appliedDecisions: mergedDecisions, events };
    return { save: next, delta };
  }

  season.currentWeek += 1;
  next.meta.week = season.currentWeek;
  next.meta.updatedAt = new Date().toISOString();
  season.eventLog.push(...events);

  const delta: SimulationDelta = {
    tick: season.tick,
    week: season.currentWeek,
    appliedDecisions: mergedDecisions,
    events,
  };

  return { save: next, delta };
}

/**
 * Record a completed (or skipped) race weekend back into the season: applies points/standings,
 * appends the RaceResult, clears the active weekend, then advances the week and round.
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
  }

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
