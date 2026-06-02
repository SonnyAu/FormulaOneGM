import { teams as teamData } from "@/data/teams";
import { driverMap } from "@/data/drivers";
import { getDriverProfile } from "@/data/driverProfiles";
import { carProfiles, getCarProfile } from "@/data/carProfiles";
import { activeDriversForTeam } from "@/lib/sim/roster";
import { createRaceWeekend } from "@/lib/sim/raceweekend/raceWeekendEngine";
import { CarProfile, RaceEntry, RaceWeekendResult, RaceWeekendState, StrategyPersonality } from "@/lib/sim/raceweekend/raceTypes";
import { CalendarEvent, DriverRaceResult, RaceResult, SeasonState, TeamState } from "@/types/sim";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Reference baselines roughly matching a freshly-created team in factory.ts, so season
// development of TeamState.car nudges the static CarProfile (and therefore race pace).
const BASE_PACE = 60;
const BASE_EFFICIENCY = 58;
const BASE_RELIABILITY = 65;

/** Shift a static CarProfile by how far the team's developed car stats have moved from baseline. */
function developCar(base: CarProfile, car: TeamState["car"]): CarProfile {
  const paceDelta = (car.pace - BASE_PACE) * 0.5;
  const efficiencyDelta = (car.efficiency - BASE_EFFICIENCY) * 0.4;
  const reliabilityDelta = (car.reliability - BASE_RELIABILITY) * 0.5;

  return {
    ...base,
    overall: clamp(base.overall + paceDelta * 0.6, 40, 99),
    topSpeed: clamp(base.topSpeed + paceDelta, 40, 99),
    downforce: clamp(base.downforce + paceDelta, 40, 99),
    mechanicalGrip: clamp(base.mechanicalGrip + paceDelta, 40, 99),
    tireWear: clamp(base.tireWear + efficiencyDelta, 40, 99),
    cooling: clamp(base.cooling + efficiencyDelta * 0.5, 40, 99),
    reliability: clamp(base.reliability + reliabilityDelta, 40, 99),
  };
}

function personalityFor(team: TeamState): StrategyPersonality {
  const { aggression, riskTolerance } = team.strategyProfile;
  if (riskTolerance > 0.75 && aggression > 0.6) return "GAMBLER";
  if (aggression > 0.62) return "AGGRESSIVE";
  if (aggression < 0.45) return "CONSERVATIVE";
  return "BALANCED";
}

const teamDataById = new Map(teamData.map((team) => [team.id, team]));

function driverIdsForTeam(season: SeasonState, teamId: string): string[] {
  if (season.roster && Object.keys(season.roster).length > 0) {
    const fromRoster = activeDriversForTeam(season.roster, teamId);
    if (fromRoster.length > 0) return fromRoster;
  }
  const data = teamDataById.get(teamId);
  if (data) return [...data.driverIds];
  return [`${teamId}-d1`, `${teamId}-d2`];
}

/**
 * The CarProfile actually used in races: the tuned static profile for known teams nudged by
 * season development, or the live-derived profile for unknown teams (e.g. custom player).
 */
export function getEffectiveCarProfile(teamState: TeamState): CarProfile {
  const baseCar = getCarProfile(teamState.id, teamState.car);
  return carProfiles[teamState.id] ? developCar(baseCar, teamState.car) : baseCar;
}

function buildEntry(season: SeasonState, teamState: TeamState, driverId: string, isPlayer: boolean): RaceEntry {
  const car = getEffectiveCarProfile(teamState);
  const rosterDriver = season.roster?.[driverId];
  const driverInfo = driverMap.get(driverId);
  const driver =
    rosterDriver?.profile ??
    getDriverProfile(driverId, driverInfo?.name ?? rosterDriver?.name ?? `${teamState.abbreviation} Driver`, 75);
  const personality = personalityFor(teamState);
  // Stronger overall packages make sharper strategy calls.
  const skill = clamp((car.overall * 0.6 + driver.overall * 0.4 - 58) / 40, 0.2, 1);

  return {
    driverId,
    teamId: teamState.id,
    driverName: rosterDriver?.name ?? driver.name,
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
    for (const driverId of driverIdsForTeam(season, teamState.id)) {
      entries.push(buildEntry(season, teamState, driverId, isPlayer));
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
  const driverResults: DriverRaceResult[] = [];

  for (const row of result.classification) {
    const agg = aggregates.get(row.teamId) ?? { teamId: row.teamId, points: 0, bestPosition: Infinity, allDnf: true };
    agg.points += row.points;
    if (!row.dnf) {
      agg.allDnf = false;
      if (row.position < agg.bestPosition) agg.bestPosition = row.position;
    }
    aggregates.set(row.teamId, agg);

    driverResults.push({
      driverId: row.driverId,
      teamId: row.teamId,
      position: row.position,
      points: row.points,
      dnf: row.dnf,
      hasFastestLap: row.hasFastestLap,
    });

    // World Drivers' Championship.
    const entry = season.driverStandings[row.driverId] ?? { driverId: row.driverId, points: 0, wins: 0, podiums: 0 };
    entry.points += row.points;
    if (!row.dnf && row.position === 1) entry.wins += 1;
    if (!row.dnf && row.position <= 3) entry.podiums += 1;
    season.driverStandings[row.driverId] = entry;
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

  const poleDriverId = weekend.qualifying?.grid[0];
  let fastestPitStop: RaceResult["fastestPitStop"];
  const pitEvents = weekend.race?.pitEvents ?? [];
  if (pitEvents.length > 0) {
    const best = pitEvents.reduce((a, b) => (a.stopTimeSeconds < b.stopTimeSeconds ? a : b));
    const entry = weekend.entries.find((e) => e.driverId === best.driverId);
    fastestPitStop = {
      driverId: best.driverId,
      teamId: entry?.teamId ?? "",
      stopTimeSeconds: best.stopTimeSeconds,
    };
  }

  return {
    seasonYear: season.seasonYear,
    round: weekend.round,
    raceName: weekend.raceName,
    week: season.currentWeek,
    finishingOrder,
    driverResults,
    poleDriverId,
    fastestPitStop,
  };
}
