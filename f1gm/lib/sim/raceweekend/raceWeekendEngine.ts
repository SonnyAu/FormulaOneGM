import {
  PaceMode,
  RaceClassificationRow,
  RaceEntry,
  RaceWeekendResult,
  RaceWeekendState,
  StrategyDecision,
  TireCompound,
} from "@/lib/sim/raceweekend/raceTypes";
import { resolveTrackProfile } from "@/lib/sim/raceweekend/trackProfiles";
import { createRng } from "@/lib/sim/raceweekend/rng";
import { runPractice } from "@/lib/sim/raceweekend/practiceSessionEngine";
import { runQualifying } from "@/lib/sim/raceweekend/qualifyingSessionEngine";
import { advanceRaceLap, advanceRaceLaps, initializeRaceState } from "@/lib/sim/raceweekend/raceSessionEngine";

const POINTS_SCALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const FASTEST_LAP_BONUS = 1;

export type CreateRaceWeekendInput = {
  id: string;
  seasonYear: number;
  round: number;
  raceName: string;
  trackId?: string;
  playerTeamId: string;
  entries: RaceEntry[];
  seed: number;
};

/** Build a weekend in the practice phase, running the (lighter) practice session immediately. */
export function createRaceWeekend(input: CreateRaceWeekendInput): RaceWeekendState {
  const track = resolveTrackProfile(input.trackId ?? input.raceName);
  const rng = createRng(input.seed);

  const weekend: RaceWeekendState = {
    id: input.id,
    seasonYear: input.seasonYear,
    round: input.round,
    raceName: input.raceName,
    trackId: track.id,
    track,
    phase: "practice",
    playerTeamId: input.playerTeamId,
    entries: input.entries,
    grid: input.entries.map((entry) => entry.driverId),
    practice: null,
    qualifying: null,
    race: null,
    result: null,
    rng,
  };

  weekend.practice = runPractice(weekend.entries, track, weekend.rng);
  return weekend;
}

/**
 * Move to the next session. practice -> qualifying (runs quali), qualifying -> race (grids up),
 * race -> complete (only once the race has finished; produces the result).
 */
export function advancePhase(weekend: RaceWeekendState): RaceWeekendState {
  switch (weekend.phase) {
    case "practice": {
      weekend.qualifying = runQualifying(weekend.entries, weekend.track, weekend.rng);
      weekend.grid = weekend.qualifying.grid;
      weekend.phase = "qualifying";
      return weekend;
    }
    case "qualifying": {
      weekend.race = initializeRaceState(weekend.entries, weekend.grid, weekend.track);
      weekend.phase = "race";
      return weekend;
    }
    case "race": {
      if (weekend.race && weekend.race.finished) {
        weekend.result = buildResult(weekend);
        weekend.phase = "complete";
      }
      return weekend;
    }
    default:
      return weekend;
  }
}

/** Tick the race by one lap. No-op unless in the race phase. */
export function advanceRace(weekend: RaceWeekendState, laps = 1): RaceWeekendState {
  if (weekend.phase !== "race" || !weekend.race) return weekend;
  if (laps <= 1) {
    advanceRaceLap(weekend.race, weekend.entries, weekend.track, weekend.rng);
  } else {
    advanceRaceLaps(weekend.race, weekend.entries, weekend.track, weekend.rng, laps);
  }
  if (weekend.race.finished && !weekend.result) {
    weekend.result = buildResult(weekend);
    weekend.phase = "complete";
  }
  return weekend;
}

/** Apply a player's strategy decision to one of their drivers' live race state. */
export function applyPlayerDecision(weekend: RaceWeekendState, decision: StrategyDecision): RaceWeekendState {
  if (!weekend.race) return weekend;
  const driver = weekend.race.drivers.find((d) => d.driverId === decision.driverId);
  if (!driver || driver.dnf) return weekend;

  if (decision.paceMode) driver.paceMode = decision.paceMode as PaceMode;
  if (decision.pit && decision.nextCompound) {
    driver.pendingPitCompound = decision.nextCompound as TireCompound;
  } else if (!decision.pit) {
    driver.pendingPitCompound = null;
  }
  return weekend;
}

function buildResult(weekend: RaceWeekendState): RaceWeekendResult {
  const race = weekend.race;
  const rows: RaceClassificationRow[] = [];

  if (race) {
    const ordered = [...race.drivers].sort((a, b) => a.position - b.position);
    ordered.forEach((driver) => {
      const finishingIndex = driver.position - 1;
      const points = driver.dnf ? 0 : POINTS_SCALE[finishingIndex] ?? 0;
      rows.push({
        position: driver.position,
        driverId: driver.driverId,
        teamId: driver.teamId,
        totalTimeSeconds: driver.totalTimeSeconds,
        lapsCompleted: driver.lapsCompleted,
        dnf: driver.dnf,
        points,
        hasFastestLap: driver.hasFastestLap,
      });
    });

    // Fastest lap bonus point if the holder finished in the top 10.
    if (race.fastestLap) {
      const flRow = rows.find((row) => row.driverId === race.fastestLap!.driverId);
      if (flRow && !flRow.dnf && flRow.position <= 10) flRow.points += FASTEST_LAP_BONUS;
    }
  }

  return { trackId: weekend.trackId, raceName: weekend.raceName, classification: rows };
}

/** Auto-play the remaining race to completion (used by demo / quick-sim). */
export function autoFinishRace(weekend: RaceWeekendState): RaceWeekendState {
  if (weekend.phase !== "race" || !weekend.race) return weekend;
  while (!weekend.race.finished) {
    advanceRaceLap(weekend.race, weekend.entries, weekend.track, weekend.rng);
  }
  weekend.result = buildResult(weekend);
  weekend.phase = "complete";
  return weekend;
}
