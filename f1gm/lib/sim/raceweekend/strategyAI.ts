import {
  PaceMode,
  RaceEntry,
  RaceSessionState,
  RngState,
  StrategyDecision,
  StrategyPersonality,
  TireCompound,
  TrackProfile,
  DriverRaceState,
} from "@/lib/sim/raceweekend/raceTypes";
import { range, chance } from "@/lib/sim/raceweekend/rng";

type PersonalityTuning = {
  /** Wear level at which a stop becomes attractive. */
  pitWearThreshold: number;
  /** Eagerness (0..1) to trigger an undercut on the car ahead. */
  undercutBias: number;
  /** Eagerness (0..1) to pit under safety car. */
  safetyCarBias: number;
  /** Bias toward softer (negative) or harder (positive) compounds. */
  compoundBias: number;
};

const TUNING: Record<StrategyPersonality, PersonalityTuning> = {
  AGGRESSIVE: { pitWearThreshold: 62, undercutBias: 0.85, safetyCarBias: 0.85, compoundBias: -0.4 },
  BALANCED: { pitWearThreshold: 70, undercutBias: 0.5, safetyCarBias: 0.7, compoundBias: 0 },
  CONSERVATIVE: { pitWearThreshold: 80, undercutBias: 0.3, safetyCarBias: 0.55, compoundBias: 0.45 },
  GAMBLER: { pitWearThreshold: 68, undercutBias: 0.7, safetyCarBias: 0.95, compoundBias: -0.2 },
};

const MIN_LAPS_BETWEEN_STOPS = 8;

function chooseCompound(
  lapsRemaining: number,
  totalLaps: number,
  tuning: PersonalityTuning,
  track: TrackProfile,
  rng: RngState,
): TireCompound {
  const stintShare = lapsRemaining / Math.max(1, totalLaps);
  // Longer remaining distance and higher deg push toward harder rubber.
  let hardness = stintShare * 1.3 + track.tireDeg * 0.6 + tuning.compoundBias;
  hardness += range(rng, -0.15, 0.15);

  if (lapsRemaining <= Math.max(8, totalLaps * 0.18)) return "SOFT";
  if (hardness > 0.95) return "HARD";
  if (hardness > 0.45) return "MEDIUM";
  return "SOFT";
}

function choosePaceMode(driver: DriverRaceState, state: RaceSessionState): PaceMode {
  if (state.safetyCar.active) return "CONSERVE";
  if (driver.tire.wear > 75) return "CONSERVE";

  const ahead = state.drivers.find((d) => d.position === driver.position - 1 && !d.dnf);
  const behind = state.drivers.find((d) => d.position === driver.position + 1 && !d.dnf);
  // Attacking a car just ahead, or defending one just behind, warrants a push.
  if (ahead && driver.gapToAheadSeconds < 1.5 && driver.tire.wear < 60) return "PUSH";
  if (behind && Math.abs(behind.gapToLeaderSeconds - driver.gapToLeaderSeconds) < 1.2 && driver.tire.wear < 55) return "PUSH";
  return "BALANCED";
}

/**
 * Evaluate an AI driver's strategy for the current lap. Returns a decision when the
 * driver should change something (pit and/or pace), otherwise null. Imperfect by design:
 * lower-skill teams react later and choose less precisely.
 */
export function evaluateStrategy(params: {
  state: RaceSessionState;
  driver: DriverRaceState;
  entry: RaceEntry;
  track: TrackProfile;
  rng: RngState;
}): StrategyDecision | null {
  const { state, driver, entry, track, rng } = params;
  if (driver.dnf || driver.inPit) return null;

  const tuning = TUNING[entry.personality];
  const lapsRemaining = state.totalLaps - driver.lapsCompleted;
  if (lapsRemaining <= 1) return null;

  const lapsSinceStop = driver.lapsCompleted - lapStintStart(driver);

  // Weaker teams react late and noisily: raise the threshold and add jitter.
  const skillSlack = (1 - entry.skill) * 14;
  const jitter = range(rng, -4, 4) * (1.3 - entry.skill);
  const effectiveThreshold = tuning.pitWearThreshold + skillSlack + jitter;

  const paceMode = choosePaceMode(driver, state);
  const minStint = MIN_LAPS_BETWEEN_STOPS + Math.round((1 - entry.skill) * 3);

  // Cannot make a meaningful tire decision too soon after a stop (pace can still change).
  if (driver.tire.ageLaps < minStint) {
    return paceMode !== driver.paceMode ? decision(driver, false, null, paceMode) : null;
  }

  // 1) Safety car bargain stop.
  if (state.safetyCar.active && driver.tire.ageLaps > 5 && chance(rng, tuning.safetyCarBias * entry.skill + 0.1)) {
    return decision(driver, true, chooseCompound(lapsRemaining, state.totalLaps, tuning, track, rng), "BALANCED");
  }

  // 2) Tires worn past the personal threshold.
  if (driver.tire.wear >= effectiveThreshold) {
    return decision(driver, true, chooseCompound(lapsRemaining, state.totalLaps, tuning, track, rng), "BALANCED");
  }

  // 3) Undercut: rival just ahead, our tires a few laps older, worth trading track position.
  const ahead = state.drivers.find((d) => d.position === driver.position - 1 && !d.dnf);
  if (
    ahead &&
    driver.gapToAheadSeconds < 2.5 &&
    driver.tire.wear > 45 &&
    driver.tire.ageLaps > ahead.tire.ageLaps + 2 &&
    lapsRemaining > 12 &&
    chance(rng, tuning.undercutBias * entry.skill)
  ) {
    return decision(driver, true, chooseCompound(lapsRemaining, state.totalLaps, tuning, track, rng), "PUSH");
  }

  void lapsSinceStop;
  return paceMode !== driver.paceMode ? decision(driver, false, null, paceMode) : null;
}

function lapStintStart(driver: DriverRaceState): number {
  return driver.lapsCompleted - driver.tire.ageLaps;
}

function decision(
  driver: DriverRaceState,
  pit: boolean,
  nextCompound: TireCompound | null,
  paceMode: PaceMode | null,
): StrategyDecision {
  return {
    driverId: driver.driverId,
    pit,
    nextCompound,
    paceMode,
    source: "ai",
    lap: driver.lapsCompleted,
  };
}
