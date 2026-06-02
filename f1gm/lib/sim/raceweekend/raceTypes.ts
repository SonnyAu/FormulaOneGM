// Core types for the interactive Race Weekend Engine.
// All shapes are plain serializable data so a weekend can be saved/paused/resumed.

export type PaceMode = "PUSH" | "BALANCED" | "CONSERVE";

export type TireCompound = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET";

export type SessionPhase = "practice" | "qualifying" | "race" | "complete";

export type StrategyPersonality = "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE" | "GAMBLER";

/** Serializable RNG state. Advanced in place by helpers in rng.ts. */
export type RngState = {
  seed: number;
  state: number;
};

// --- Profiles -------------------------------------------------------------

/** Relative importance (0..1) of each capability for a circuit. */
export type TrackDemands = {
  topSpeed: number;
  downforce: number;
  braking: number;
  traction: number;
  lowSpeed: number;
  highSpeed: number;
  tirePreservation: number;
  consistency: number;
  qualifyingPrecision: number;
};

/** Per-trait weights used when scoring a driver against a track. Keys map to DriverProfile traits. */
export type DriverTraitWeights = Partial<Record<keyof Omit<DriverProfile, "id" | "name" | "overall">, number>>;

/** Per-trait weights used when scoring a car against a track. Keys map to CarProfile traits. */
export type CarTraitWeights = Partial<Record<keyof Omit<CarProfile, "teamId" | "overall">, number>>;

export type DriverProfile = {
  id: string;
  name: string;
  overall: number;
  qualifying: number;
  racePace: number;
  tireManagement: number;
  overtaking: number;
  defending: number;
  consistency: number;
  wetWeather: number;
  braking: number;
  traction: number;
  lowSpeed: number;
  highSpeed: number;
  adaptability: number;
};

export type CarProfile = {
  teamId: string;
  overall: number;
  topSpeed: number;
  downforce: number;
  mechanicalGrip: number;
  tireWear: number;
  reliability: number;
  cooling: number;
  pitCrew: number;
};

export type TrackProfile = {
  id: string;
  circuitName: string;
  raceName: string;
  laps: number;
  pitLossSeconds: number;
  /** 0..1, higher = harder to pass (track position more valuable). */
  overtakingDifficulty: number;
  /** 0..1, higher = tires wear faster. */
  tireDeg: number;
  /** 0..1, how much the track speeds up over a session as rubber goes down. */
  trackEvolution: number;
  /** 0..1 per-lap-ish chance weight that a safety car is triggered. */
  safetyCarChance: number;
  /** 0..1, likelihood/severity of changing weather. */
  weatherVolatility: number;
  baseLapTimeSeconds: number;
  demands: TrackDemands;
  driverTraitWeights: DriverTraitWeights;
  carTraitWeights: CarTraitWeights;
};

// --- Entries & tire state -------------------------------------------------

export type RaceEntry = {
  driverId: string;
  teamId: string;
  driverName: string;
  abbreviation: string;
  carNumber: number;
  isPlayer: boolean;
  personality: StrategyPersonality;
  /** 0..1 competence multiplier driving AI strategy quality. */
  skill: number;
  /** Fractional lap-time bonus earned from a productive practice program (0 = none). */
  setupBonus: number;
  driver: DriverProfile;
  car: CarProfile;
};

export type TireState = {
  compound: TireCompound;
  ageLaps: number;
  /** 0..100, accumulated wear (higher = more worn). */
  wear: number;
  /** 0..100 remaining grip headroom (100 = fresh). */
  health: number;
};

// --- Per-driver race state ------------------------------------------------

export type DriverRaceState = {
  driverId: string;
  teamId: string;
  position: number;
  gridPosition: number;
  tire: TireState;
  paceMode: PaceMode;
  lapsCompleted: number;
  totalTimeSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  gapToLeaderSeconds: number;
  gapToAheadSeconds: number;
  pitStops: number;
  /** Laps remaining of an in-progress pit sequence (0 when on track). */
  pitLapsRemaining: number;
  inPit: boolean;
  /** Requested by player/AI; consumed at the next pit-window evaluation. */
  pendingPitCompound: TireCompound | null;
  dnf: boolean;
  dnfReason: string | null;
  hasFastestLap: boolean;
};

export type TeamRaceState = {
  teamId: string;
  abbreviation: string;
  personality: StrategyPersonality;
  isPlayer: boolean;
  driverIds: string[];
};

// --- Events ---------------------------------------------------------------

export type PitStopEvent = {
  lap: number;
  driverId: string;
  fromCompound: TireCompound;
  toCompound: TireCompound;
  stopTimeSeconds: number;
  totalLossSeconds: number;
};

export type RaceEventType =
  | "race-start"
  | "drs-range"
  | "overtake"
  | "pit"
  | "undercut"
  | "tire-fading"
  | "safety-car"
  | "safety-car-end"
  | "fastest-lap"
  | "lead-change"
  | "dnf"
  | "race-end";

export type RaceEvent = {
  type: RaceEventType;
  lap: number;
  /** Primary subject (driver) of the event. */
  driverId?: string;
  /** Secondary subject (rival) where relevant. */
  rivalId?: string;
  compound?: TireCompound;
  stopTimeSeconds?: number;
  timeSeconds?: number;
  detail?: string;
};

export type CommentaryImportance = "low" | "medium" | "high";

export type CommentaryMessage = {
  id: string;
  lap: number;
  phase: SessionPhase;
  text: string;
  importance: CommentaryImportance;
};

export type StrategyDecision = {
  driverId: string;
  pit: boolean;
  nextCompound: TireCompound | null;
  paceMode: PaceMode | null;
  source: "player" | "ai";
  lap: number;
};

// --- Session states -------------------------------------------------------

export type SafetyCarState = {
  active: boolean;
  lapsRemaining: number;
  deployedLap: number | null;
};

export type RaceSessionState = {
  totalLaps: number;
  currentLap: number;
  drivers: DriverRaceState[];
  safetyCar: SafetyCarState;
  pitEvents: PitStopEvent[];
  events: RaceEvent[];
  commentary: CommentaryMessage[];
  fastestLap: { driverId: string; timeSeconds: number; lap: number } | null;
  finished: boolean;
};

export type PracticeRunResult = {
  driverId: string;
  bestLapSeconds: number;
  laps: number;
  compound: TireCompound;
};

export type PracticeSessionState = {
  completed: boolean;
  runs: PracticeRunResult[];
  /** Small lap-time bonus (seconds) gained from a productive practice program. */
  playerSetupBonus: number;
};

export type QualifyingSegment = "Q1" | "Q2" | "Q3" | "done";

export type QualifyingLap = {
  driverId: string;
  bestLapSeconds: number;
  segment: QualifyingSegment;
  tireLapsUsed: number;
};

export type QualifyingSessionState = {
  segment: QualifyingSegment;
  results: QualifyingLap[];
  /** Driver ids in provisional grid order (index 0 = pole). */
  grid: string[];
  completed: boolean;
};

// --- Weekend container ----------------------------------------------------

export type RaceClassificationRow = {
  position: number;
  driverId: string;
  teamId: string;
  totalTimeSeconds: number;
  lapsCompleted: number;
  dnf: boolean;
  points: number;
  hasFastestLap: boolean;
};

export type RaceWeekendResult = {
  trackId: string;
  raceName: string;
  classification: RaceClassificationRow[];
};

export type RaceWeekendState = {
  id: string;
  seasonYear: number;
  round: number;
  raceName: string;
  trackId: string;
  track: TrackProfile;
  phase: SessionPhase;
  playerTeamId: string;
  entries: RaceEntry[];
  grid: string[];
  practice: PracticeSessionState | null;
  qualifying: QualifyingSessionState | null;
  race: RaceSessionState | null;
  result: RaceWeekendResult | null;
  rng: RngState;
};
