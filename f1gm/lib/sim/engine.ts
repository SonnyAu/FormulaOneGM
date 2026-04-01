import { generateAiDecisions } from "@/lib/sim/subsystems/ai";
import { mergeDecisions, validateDecision } from "@/lib/sim/subsystems/decision";
import { processDevelopment } from "@/lib/sim/subsystems/development";
import { processEconomy } from "@/lib/sim/subsystems/economy";
import { simulateRaceWeekend } from "@/lib/sim/subsystems/race";
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

export function runSimulationTick(save: SaveData, playerDecisions: TeamDecision[]): { save: SaveData; delta: SimulationDelta } {
  const next = structuredClone(save) as SaveData;
  const season = next.season;
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
  let raceResult;
  if (calendarEvent?.type === "race") {
    raceResult = simulateRaceWeekend(season, calendarEvent.name);
    season.raceHistory.push(raceResult);
    season.currentRound += 1;
    events.push(event("race", `Race weekend simulated: ${calendarEvent.name}.`, season.currentWeek, season.tick));
  }

  season.currentWeek += 1;
  next.meta.week = season.currentWeek;
  next.meta.updatedAt = new Date().toISOString();
  season.eventLog.push(...events);

  const delta: SimulationDelta = {
    tick: season.tick,
    week: season.currentWeek,
    raceResult,
    appliedDecisions: mergedDecisions,
    events,
  };

  return { save: next, delta };
}
