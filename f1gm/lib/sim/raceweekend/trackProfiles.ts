import {
  CarProfile,
  CarTraitWeights,
  DriverProfile,
  DriverTraitWeights,
  TrackDemands,
  TrackProfile,
} from "@/lib/sim/raceweekend/raceTypes";

type TrackSeed = {
  id: string;
  circuitName: string;
  raceName: string;
  laps: number;
  baseLapTimeSeconds: number;
  pitLossSeconds: number;
  overtakingDifficulty: number;
  tireDeg: number;
  trackEvolution: number;
  safetyCarChance: number;
  weatherVolatility: number;
  demands: TrackDemands;
};

// Driver/car trait weightings are derived from a track's demand profile so each
// circuit naturally rewards different strengths. Demands are the carefully tuned input.
function deriveDriverWeights(seed: TrackSeed): DriverTraitWeights {
  const d = seed.demands;
  return {
    qualifying: 0.6 + d.qualifyingPrecision * 0.9,
    racePace: 1.0,
    tireManagement: 0.5 + d.tirePreservation * 1.2,
    overtaking: 0.4 + (1 - seed.overtakingDifficulty) * 0.8,
    defending: 0.4 + (1 - seed.overtakingDifficulty) * 0.5,
    consistency: 0.4 + d.consistency * 1.0,
    wetWeather: 0.2 + seed.weatherVolatility * 1.4,
    braking: 0.3 + d.braking * 1.0,
    traction: 0.3 + d.traction * 1.0,
    lowSpeed: 0.2 + d.lowSpeed * 1.2,
    highSpeed: 0.2 + d.highSpeed * 1.2,
    adaptability: 0.3,
  };
}

function deriveCarWeights(seed: TrackSeed): CarTraitWeights {
  const d = seed.demands;
  return {
    topSpeed: 0.3 + d.topSpeed * 1.3,
    downforce: 0.3 + d.downforce * 1.3,
    mechanicalGrip: 0.3 + d.lowSpeed * 0.7 + d.traction * 0.5,
    tireWear: 0.4 + d.tirePreservation * 1.2,
    reliability: 0.35,
    cooling: 0.2,
    pitCrew: 0.2,
  };
}

function build(seed: TrackSeed): TrackProfile {
  return {
    ...seed,
    driverTraitWeights: deriveDriverWeights(seed),
    carTraitWeights: deriveCarWeights(seed),
  };
}

// demands order: topSpeed, downforce, braking, traction, lowSpeed, highSpeed, tirePreservation, consistency, qualifyingPrecision
function demands(
  topSpeed: number,
  downforce: number,
  braking: number,
  traction: number,
  lowSpeed: number,
  highSpeed: number,
  tirePreservation: number,
  consistency: number,
  qualifyingPrecision: number,
): TrackDemands {
  return { topSpeed, downforce, braking, traction, lowSpeed, highSpeed, tirePreservation, consistency, qualifyingPrecision };
}

const seeds: TrackSeed[] = [
  { id: "melbourne", circuitName: "Melbourne Grand Prix Circuit", raceName: "Australian GP", laps: 58, baseLapTimeSeconds: 79, pitLossSeconds: 21, overtakingDifficulty: 0.55, tireDeg: 0.5, trackEvolution: 0.6, safetyCarChance: 0.35, weatherVolatility: 0.3, demands: demands(0.6, 0.6, 0.6, 0.55, 0.55, 0.6, 0.5, 0.6, 0.6) },
  { id: "shanghai", circuitName: "Shanghai International Circuit", raceName: "Chinese GP", laps: 56, baseLapTimeSeconds: 94, pitLossSeconds: 22, overtakingDifficulty: 0.45, tireDeg: 0.6, trackEvolution: 0.5, safetyCarChance: 0.3, weatherVolatility: 0.4, demands: demands(0.65, 0.6, 0.65, 0.55, 0.55, 0.55, 0.6, 0.55, 0.5) },
  { id: "suzuka", circuitName: "Suzuka International Racing Course", raceName: "Japanese GP", laps: 53, baseLapTimeSeconds: 91, pitLossSeconds: 22, overtakingDifficulty: 0.6, tireDeg: 0.55, trackEvolution: 0.5, safetyCarChance: 0.3, weatherVolatility: 0.45, demands: demands(0.5, 0.85, 0.55, 0.55, 0.45, 0.85, 0.55, 0.8, 0.7) },
  { id: "bahrain", circuitName: "Bahrain International Circuit", raceName: "Bahrain GP", laps: 57, baseLapTimeSeconds: 92, pitLossSeconds: 23, overtakingDifficulty: 0.4, tireDeg: 0.85, trackEvolution: 0.45, safetyCarChance: 0.25, weatherVolatility: 0.2, demands: demands(0.6, 0.55, 0.8, 0.8, 0.55, 0.5, 0.85, 0.55, 0.5) },
  { id: "jeddah", circuitName: "Jeddah Corniche Circuit", raceName: "Saudi Arabian GP", laps: 50, baseLapTimeSeconds: 89, pitLossSeconds: 20, overtakingDifficulty: 0.45, tireDeg: 0.45, trackEvolution: 0.55, safetyCarChance: 0.55, weatherVolatility: 0.15, demands: demands(0.8, 0.7, 0.55, 0.5, 0.4, 0.9, 0.45, 0.7, 0.75) },
  { id: "miami", circuitName: "Miami International Autodrome", raceName: "Miami GP", laps: 57, baseLapTimeSeconds: 90, pitLossSeconds: 21, overtakingDifficulty: 0.5, tireDeg: 0.55, trackEvolution: 0.6, safetyCarChance: 0.4, weatherVolatility: 0.35, demands: demands(0.7, 0.6, 0.6, 0.55, 0.5, 0.6, 0.55, 0.55, 0.55) },
  { id: "montreal", circuitName: "Circuit Gilles-Villeneuve", raceName: "Canadian GP", laps: 70, baseLapTimeSeconds: 74, pitLossSeconds: 18, overtakingDifficulty: 0.5, tireDeg: 0.5, trackEvolution: 0.55, safetyCarChance: 0.5, weatherVolatility: 0.45, demands: demands(0.75, 0.5, 0.85, 0.7, 0.5, 0.5, 0.5, 0.55, 0.55) },
  { id: "monaco", circuitName: "Circuit de Monaco", raceName: "Monaco GP", laps: 78, baseLapTimeSeconds: 73, pitLossSeconds: 19, overtakingDifficulty: 0.95, tireDeg: 0.35, trackEvolution: 0.7, safetyCarChance: 0.6, weatherVolatility: 0.35, demands: demands(0.3, 0.85, 0.6, 0.7, 0.95, 0.3, 0.4, 0.7, 0.95) },
  { id: "catalunya", circuitName: "Circuit de Barcelona-Catalunya", raceName: "Barcelona-Catalunya GP", laps: 66, baseLapTimeSeconds: 76, pitLossSeconds: 21, overtakingDifficulty: 0.55, tireDeg: 0.7, trackEvolution: 0.5, safetyCarChance: 0.2, weatherVolatility: 0.3, demands: demands(0.55, 0.8, 0.55, 0.65, 0.55, 0.75, 0.7, 0.7, 0.6) },
  { id: "red-bull-ring", circuitName: "Red Bull Ring", raceName: "Austrian GP", laps: 71, baseLapTimeSeconds: 65, pitLossSeconds: 19, overtakingDifficulty: 0.45, tireDeg: 0.6, trackEvolution: 0.5, safetyCarChance: 0.4, weatherVolatility: 0.45, demands: demands(0.7, 0.55, 0.75, 0.7, 0.6, 0.55, 0.55, 0.5, 0.6) },
  { id: "silverstone", circuitName: "Silverstone Circuit", raceName: "British GP", laps: 52, baseLapTimeSeconds: 87, pitLossSeconds: 20, overtakingDifficulty: 0.5, tireDeg: 0.65, trackEvolution: 0.5, safetyCarChance: 0.35, weatherVolatility: 0.5, demands: demands(0.55, 0.85, 0.55, 0.6, 0.45, 0.9, 0.6, 0.7, 0.65) },
  { id: "spa", circuitName: "Circuit de Spa-Francorchamps", raceName: "Belgian GP", laps: 44, baseLapTimeSeconds: 104, pitLossSeconds: 19, overtakingDifficulty: 0.45, tireDeg: 0.6, trackEvolution: 0.5, safetyCarChance: 0.45, weatherVolatility: 0.65, demands: demands(0.8, 0.7, 0.6, 0.55, 0.45, 0.9, 0.55, 0.65, 0.6) },
  { id: "hungaroring", circuitName: "Hungaroring", raceName: "Hungarian GP", laps: 70, baseLapTimeSeconds: 76, pitLossSeconds: 20, overtakingDifficulty: 0.85, tireDeg: 0.6, trackEvolution: 0.6, safetyCarChance: 0.3, weatherVolatility: 0.35, demands: demands(0.35, 0.85, 0.55, 0.7, 0.8, 0.45, 0.6, 0.7, 0.8) },
  { id: "zandvoort", circuitName: "Circuit Park Zandvoort", raceName: "Dutch GP", laps: 72, baseLapTimeSeconds: 71, pitLossSeconds: 21, overtakingDifficulty: 0.8, tireDeg: 0.6, trackEvolution: 0.55, safetyCarChance: 0.4, weatherVolatility: 0.45, demands: demands(0.45, 0.8, 0.55, 0.7, 0.65, 0.7, 0.6, 0.7, 0.8) },
  { id: "monza", circuitName: "Autodromo Nazionale Monza", raceName: "Italian GP", laps: 53, baseLapTimeSeconds: 81, pitLossSeconds: 22, overtakingDifficulty: 0.3, tireDeg: 0.45, trackEvolution: 0.5, safetyCarChance: 0.35, weatherVolatility: 0.3, demands: demands(0.95, 0.3, 0.8, 0.5, 0.4, 0.75, 0.45, 0.5, 0.6) },
  { id: "madring", circuitName: "Madring", raceName: "Spanish GP", laps: 57, baseLapTimeSeconds: 85, pitLossSeconds: 21, overtakingDifficulty: 0.5, tireDeg: 0.55, trackEvolution: 0.65, safetyCarChance: 0.4, weatherVolatility: 0.3, demands: demands(0.65, 0.6, 0.6, 0.6, 0.55, 0.6, 0.55, 0.6, 0.6) },
  { id: "baku", circuitName: "Baku City Circuit", raceName: "Azerbaijan GP", laps: 51, baseLapTimeSeconds: 102, pitLossSeconds: 18, overtakingDifficulty: 0.45, tireDeg: 0.45, trackEvolution: 0.6, safetyCarChance: 0.6, weatherVolatility: 0.2, demands: demands(0.85, 0.45, 0.8, 0.55, 0.6, 0.65, 0.45, 0.55, 0.7) },
  { id: "marina-bay", circuitName: "Marina Bay Street Circuit", raceName: "Singapore GP", laps: 62, baseLapTimeSeconds: 95, pitLossSeconds: 27, overtakingDifficulty: 0.8, tireDeg: 0.55, trackEvolution: 0.6, safetyCarChance: 0.65, weatherVolatility: 0.45, demands: demands(0.4, 0.8, 0.7, 0.75, 0.85, 0.4, 0.55, 0.75, 0.8) },
  { id: "cota", circuitName: "Circuit of the Americas", raceName: "United States GP", laps: 56, baseLapTimeSeconds: 94, pitLossSeconds: 21, overtakingDifficulty: 0.5, tireDeg: 0.6, trackEvolution: 0.5, safetyCarChance: 0.4, weatherVolatility: 0.4, demands: demands(0.6, 0.75, 0.65, 0.6, 0.55, 0.75, 0.6, 0.65, 0.6) },
  { id: "mexico-city", circuitName: "Autodromo Hermanos Rodriguez", raceName: "Mexico City GP", laps: 71, baseLapTimeSeconds: 78, pitLossSeconds: 22, overtakingDifficulty: 0.55, tireDeg: 0.5, trackEvolution: 0.5, safetyCarChance: 0.45, weatherVolatility: 0.3, demands: demands(0.8, 0.6, 0.7, 0.6, 0.55, 0.55, 0.5, 0.55, 0.6) },
  { id: "interlagos", circuitName: "Autodromo Jose Carlos Pace", raceName: "Sao Paulo GP", laps: 71, baseLapTimeSeconds: 71, pitLossSeconds: 20, overtakingDifficulty: 0.45, tireDeg: 0.6, trackEvolution: 0.55, safetyCarChance: 0.5, weatherVolatility: 0.65, demands: demands(0.65, 0.7, 0.6, 0.6, 0.55, 0.65, 0.55, 0.6, 0.6) },
  { id: "las-vegas", circuitName: "Las Vegas Street Circuit", raceName: "Las Vegas GP", laps: 50, baseLapTimeSeconds: 95, pitLossSeconds: 19, overtakingDifficulty: 0.5, tireDeg: 0.5, trackEvolution: 0.65, safetyCarChance: 0.55, weatherVolatility: 0.25, demands: demands(0.9, 0.4, 0.7, 0.5, 0.5, 0.7, 0.5, 0.55, 0.65) },
  { id: "losail", circuitName: "Losail International Circuit", raceName: "Qatar GP", laps: 57, baseLapTimeSeconds: 83, pitLossSeconds: 22, overtakingDifficulty: 0.55, tireDeg: 0.75, trackEvolution: 0.5, safetyCarChance: 0.25, weatherVolatility: 0.2, demands: demands(0.55, 0.8, 0.55, 0.6, 0.5, 0.8, 0.8, 0.7, 0.65) },
  { id: "yas-marina", circuitName: "Yas Marina Circuit", raceName: "Abu Dhabi GP", laps: 58, baseLapTimeSeconds: 86, pitLossSeconds: 21, overtakingDifficulty: 0.55, tireDeg: 0.5, trackEvolution: 0.55, safetyCarChance: 0.35, weatherVolatility: 0.15, demands: demands(0.7, 0.6, 0.65, 0.6, 0.55, 0.6, 0.55, 0.6, 0.65) },
];

export const trackProfiles: Record<string, TrackProfile> = Object.fromEntries(
  seeds.map((seed) => [seed.id, build(seed)]),
);

export const DEFAULT_TRACK: TrackProfile = trackProfiles.melbourne;

/** Resolve by stable track id first, then by a fuzzy match on race name. */
export function resolveTrackProfile(trackIdOrName: string | undefined | null): TrackProfile {
  if (!trackIdOrName) return DEFAULT_TRACK;

  const direct = trackProfiles[trackIdOrName];
  if (direct) return direct;

  const needle = trackIdOrName.toLowerCase();
  const byName = Object.values(trackProfiles).find(
    (track) => track.raceName.toLowerCase() === needle || needle.includes(track.raceName.toLowerCase().replace(" gp", "")),
  );
  if (byName) return byName;

  const byCircuit = Object.values(trackProfiles).find((track) => needle.includes(track.circuitName.toLowerCase()));
  return byCircuit ?? DEFAULT_TRACK;
}

function weightedAverage<T extends Record<string, number>>(source: T, weights: Partial<Record<keyof T, number>>): number {
  let total = 0;
  let weightSum = 0;
  for (const key in weights) {
    const weight = weights[key];
    if (weight === undefined) continue;
    const value = source[key];
    if (typeof value !== "number") continue;
    total += value * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 75 : total / weightSum;
}

export type PaceBlendMode = "race" | "qualifying";

/**
 * Driver share of lap pace. F1 is primarily an engineering contest (~70–80% car);
 * elite drivers can pull a few extra points toward the driver side of the split.
 */
export function driverPaceShare(driver: DriverProfile, mode: PaceBlendMode = "race"): number {
  const base = mode === "qualifying" ? 0.28 : 0.22;
  const cap = mode === "qualifying" ? 0.35 : 0.3;
  const eliteBonus = Math.max(0, (driver.overall - 80) / 150);
  return Math.min(cap, base + eliteBonus);
}

/** Blend car and driver overall ratings for strategy / package strength heuristics. */
export function computePackageStrength(carOverall: number, driverOverall: number, mode: PaceBlendMode = "race"): number {
  const driverShare = driverPaceShare({ overall: driverOverall } as DriverProfile, mode);
  return carOverall * (1 - driverShare) + driverOverall * driverShare;
}

/**
 * Combined performance level (roughly 0-100) of a driver+car pairing at a track.
 * Car dominates; stronger drivers extract slightly more from the package.
 */
export function computeTrackFitScore(
  driver: DriverProfile,
  car: CarProfile,
  track: TrackProfile,
  mode: PaceBlendMode = "race",
): number {
  const driverScore = weightedAverage(driver as unknown as Record<string, number>, track.driverTraitWeights);
  const carScore = weightedAverage(car as unknown as Record<string, number>, track.carTraitWeights);
  const driverShare = driverPaceShare(driver, mode);
  return driverScore * driverShare + carScore * (1 - driverShare);
}
