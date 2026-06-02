import {
  CarProfile,
  DriverProfile,
  PaceMode,
  RngState,
  TireCompound,
  TireState,
  TrackProfile,
} from "@/lib/sim/raceweekend/raceTypes";
import { computeTrackFitScore } from "@/lib/sim/raceweekend/trackProfiles";
import { gaussian } from "@/lib/sim/raceweekend/rng";

export type CompoundInfo = {
  /** Fractional lap-time offset vs the medium baseline (negative = faster). */
  pacePct: number;
  /** Base wear units accumulated per lap before track/car/pace scaling. */
  wearPerLap: number;
  label: string;
};

export const COMPOUND_INFO: Record<TireCompound, CompoundInfo> = {
  SOFT: { pacePct: -0.007, wearPerLap: 2.4, label: "Softs" },
  MEDIUM: { pacePct: 0, wearPerLap: 1.6, label: "Mediums" },
  HARD: { pacePct: 0.006, wearPerLap: 1.05, label: "Hards" },
  INTERMEDIATE: { pacePct: 0.045, wearPerLap: 1.8, label: "Intermediates" },
  WET: { pacePct: 0.09, wearPerLap: 1.5, label: "Wets" },
};

export const DRY_COMPOUNDS: TireCompound[] = ["SOFT", "MEDIUM", "HARD"];

const PACE_MODE_PCT: Record<PaceMode, number> = { PUSH: -0.004, BALANCED: 0, CONSERVE: 0.006 };
const PACE_MODE_WEAR: Record<PaceMode, number> = { PUSH: 1.35, BALANCED: 1, CONSERVE: 0.7 };

export function freshTire(compound: TireCompound): TireState {
  return { compound, ageLaps: 0, wear: 0, health: 100 };
}

/** Wear units added for one lap, scaled by track deg, car tire handling, and pace mode. */
export function lapWear(tire: TireState, track: TrackProfile, car: CarProfile, paceMode: PaceMode): number {
  const compound = COMPOUND_INFO[tire.compound];
  // Better tireWear rating reduces degradation (range ~0.75x..1.2x around a 85 reference).
  const carFactor = 1.2 - (car.tireWear - 60) / 130;
  const trackFactor = 0.6 + track.tireDeg * 1.1;
  return compound.wearPerLap * trackFactor * Math.max(0.6, carFactor) * PACE_MODE_WEAR[paceMode];
}

/** Apply one lap of wear, returning a new tire state. */
export function ageTire(tire: TireState, track: TrackProfile, car: CarProfile, paceMode: PaceMode): TireState {
  const added = lapWear(tire, track, car, paceMode);
  const wear = Math.min(140, tire.wear + added);
  return {
    compound: tire.compound,
    ageLaps: tire.ageLaps + 1,
    wear,
    health: Math.max(0, 100 - wear),
  };
}

/** Fractional lap-time penalty from current tire wear (grows quadratically, with a cliff past ~80% wear). */
export function tireWearPenalty(tire: TireState): number {
  const w = tire.wear / 100;
  const base = w * w * 0.03;
  const cliff = tire.wear > 80 ? (tire.wear - 80) / 100 * 0.05 : 0;
  return base + cliff;
}

export type LapTimeContext = {
  driver: DriverProfile;
  car: CarProfile;
  track: TrackProfile;
  tire: TireState;
  paceMode: PaceMode;
  lapsRemaining: number;
  totalLaps: number;
  setupBonus?: number;
  rng: RngState;
};

/**
 * Pure base lap time in seconds (excludes live traffic/DRS, which the tick applies via gaps).
 * Combines car+driver fit, compound, tire wear, pace mode, fuel load, and seeded randomness.
 */
export function computeLapTime(ctx: LapTimeContext): number {
  const { driver, car, track, tire, paceMode, lapsRemaining, totalLaps, rng } = ctx;

  const fit = computeTrackFitScore(driver, car, track);
  // Reference fit ~85; each point off reference is ~0.16% of base lap time.
  const carDelta = (85 - fit) * 0.0016;
  const compoundPct = COMPOUND_INFO[tire.compound].pacePct;
  const wearPct = tireWearPenalty(tire);
  const paceModePct = PACE_MODE_PCT[paceMode];
  // Heavier early-race fuel load slows the car; ~1.8% at lights out, 0 at the flag.
  const fuelPct = totalLaps > 0 ? (lapsRemaining / totalLaps) * 0.018 : 0;
  // Driver consistency narrows lap-to-lap variance.
  const variance = (1.1 - driver.consistency / 130) * 0.003;
  const randomPct = gaussian(rng) * variance;
  const setupPct = -(ctx.setupBonus ?? 0);

  const multiplier = 1 + carDelta + compoundPct + wearPct + paceModePct + fuelPct + setupPct + randomPct;
  return track.baseLapTimeSeconds * Math.max(0.9, multiplier);
}

/** Single-lap qualifying/practice pace (low fuel, fresh-ish tire), used by quali & practice. */
export function computeQualifyingLap(
  driver: DriverProfile,
  car: CarProfile,
  track: TrackProfile,
  tire: TireState,
  rng: RngState,
): number {
  const fit = computeTrackFitScore(driver, car, track);
  const carDelta = (85 - fit) * 0.0016;
  // Qualifying precision rewards the qualifying trait directly.
  const qualiBonus = -(driver.qualifying - 80) * 0.0004 * (0.6 + track.demands.qualifyingPrecision);
  const compoundPct = COMPOUND_INFO[tire.compound].pacePct;
  const wearPct = tireWearPenalty(tire);
  const variance = (1.1 - driver.consistency / 130) * 0.0025;
  const randomPct = gaussian(rng) * variance;
  const multiplier = 1 + carDelta + qualiBonus + compoundPct + wearPct - 0.012 + randomPct; // low fuel ~ -1.2%
  return track.baseLapTimeSeconds * Math.max(0.88, multiplier);
}
