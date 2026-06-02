import { teams as teamData } from "@/data/teams";
import { driverMap } from "@/data/drivers";
import { getDriverProfile } from "@/data/driverProfiles";
import { getCarProfile } from "@/data/carProfiles";
import { createRaceWeekend } from "@/lib/sim/raceweekend/raceWeekendEngine";
import { RaceEntry, RaceWeekendResult, RaceWeekendState, StrategyPersonality } from "@/lib/sim/raceweekend/raceTypes";
import { CalendarEvent, RaceResult, SeasonState, TeamState } from "@/types/sim";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function personalityFor(team: TeamState): StrategyPersonality {
  const { aggression, riskTolerance } = team.strategyProfile;
  if (riskTolerance > 0.75 && aggression > 0.6) return "GAMBLER";
  if (aggression > 0.62) return "AGGRESSIVE";
  if (aggression < 0.45) return "CONSERVATIVE";
  return "BALANCED";
}

const teamDataById = new Map(teamData.map((team) => [team.id, team]));

function driverIdsForTeam(teamId: string): string[] {
  const data = teamDataById.get(teamId);
  if (data) return [...data.driverIds];
  // Custom player team etc.: synthesize two entries.
  return [`${teamId}-d1`, `${teamId}-d2`];
}

function buildEntry(teamState: TeamState, driverId: string, isPlayer: boolean): RaceEntry {
  const car = getCarProfile(teamState.id, teamState.car);
  const driverInfo = driverMap.get(driverId);
  const driver = getDriverProfile(driverId, driverInfo?.name ?? `${teamState.abbreviation} Driver`, 75);
  const personality = personalityFor(teamState);
  // Stronger overall packages make sharper strategy calls.
  const skill = clamp((car.overall * 0.6 + driver.overall * 0.4 - 58) / 40, 0.2, 1);

  return {
    driverId,
    teamId: teamState.id,
    driverName: driver.name,
    abbreviation: teamState.abbreviation,
    carNumber: driverInfo?.number ?? 0,
    isPlayer,
    personality,
    skill,
    setupBonus: 0,
    driver,
    car,
  };
}

/** Build race entries for every car in the season. */
export function buildEntriesFromSeason(season: SeasonState, playerTeamId: string): RaceEntry[] {
  const entries: RaceEntry[] = [];
  for (const teamState of Object.values(season.teams)) {
    const isPlayer = teamState.id === playerTeamId;
    for (const driverId of driverIdsForTeam(teamState.id)) {
      entries.push(buildEntry(teamState, driverId, isPlayer));
    }
  }
  return entries;
}

/** Create an interactive race weekend from the current season + a calendar race event. */
export function createRaceWeekendFromSeason(
  season: SeasonState,
  calendarEvent: CalendarEvent,
  playerTeamId: string,
  seed: number,
): RaceWeekendState {
  const entries = buildEntriesFromSeason(season, playerTeamId);
  return createRaceWeekend({
    id: `rw-${season.seasonYear}-${calendarEvent.round}-${seed.toString(16)}`,
    seasonYear: season.seasonYear,
    round: calendarEvent.round,
    raceName: calendarEvent.name,
    trackId: calendarEvent.trackId,
    playerTeamId,
    entries,
    seed,
  });
}

type TeamAggregate = {
  teamId: string;
  points: number;
  bestPosition: number;
  allDnf: boolean;
};

/**
 * Write a completed weekend back into the season: aggregate each team's two drivers into the
 * existing team-level RaceResult, update standings, and return the RaceResult to be recorded.
 */
export function applyRaceWeekendResult(season: SeasonState, weekend: RaceWeekendState): RaceResult {
  const result: RaceWeekendResult = weekend.result ?? { trackId: weekend.trackId, raceName: weekend.raceName, classification: [] };

  const aggregates = new Map<string, TeamAggregate>();
  for (const row of result.classification) {
    const agg = aggregates.get(row.teamId) ?? { teamId: row.teamId, points: 0, bestPosition: Infinity, allDnf: true };
    agg.points += row.points;
    if (!row.dnf) {
      agg.allDnf = false;
      if (row.position < agg.bestPosition) agg.bestPosition = row.position;
    }
    aggregates.set(row.teamId, agg);
  }

  const ranked = [...aggregates.values()].sort((a, b) => a.bestPosition - b.bestPosition);

  const finishingOrder = ranked.map((agg) => ({
    teamId: agg.teamId,
    points: agg.points,
    dnf: agg.allDnf,
  }));

  ranked.forEach((agg) => {
    const team = season.teams[agg.teamId];
    if (!team) return;
    team.standings.points += agg.points;
    if (!agg.allDnf && agg.bestPosition === 1) team.standings.wins += 1;
    if (!agg.allDnf && agg.bestPosition <= 3) team.standings.podiums += 1;
  });

  return {
    seasonYear: season.seasonYear,
    round: weekend.round,
    raceName: weekend.raceName,
    week: season.currentWeek,
    finishingOrder,
  };
}
