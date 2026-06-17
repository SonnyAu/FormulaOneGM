import type { DriverProfile, RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";
import type { SponsorAmbition, SponsorCategory } from "@/types/f1";

export const SAVE_SCHEMA_VERSION = 11;

export type SaveDifficulty = "easy" | "standard" | "hard";

export type SaveMetadata = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string;
  version: number;
  playerTeamId: string;
  playerTeamName: string;
  seasonYear: number;
  week: number;
  difficulty: SaveDifficulty;
  summary: {
    points: number;
    budget: number;
  };
};

export type CalendarEventType = "week" | "race";

export type CalendarEvent = {
  week: number;
  round: number;
  name: string;
  type: CalendarEventType;
  /** Stable track id linking a race to its TrackProfile (race events only). */
  trackId?: string;
};

export type TeamType = "works" | "customer";

export type PowerUnitManufacturerId = "mercedes" | "ferrari" | "honda" | "audi" | "red-bull-ford";

export type PowerUnitRatings = {
  ice: number;
  ers: number;
  reliability: number;
  integration: number;
  overall: number;
};

export type PowerUnitDevelopmentProgram = {
  level: "none" | "standard" | "aggressive";
  focus: "ice" | "ers" | "reliability" | "balanced";
};

export type PowerUnitManufacturerState = {
  id: PowerUnitManufacturerId;
  name: string;
  engineName: string;
  worksTeamId: string;
  customerCapacity: number;
  exclusiveTeamIds?: string[];
  ratings: PowerUnitRatings;
  pendingDevelopmentProgram?: PowerUnitDevelopmentProgram | null;
};

export type PowerUnitContract = {
  id: string;
  teamId: string;
  manufacturerId: PowerUnitManufacturerId;
  startSeason: number;
  endSeason: number;
  annualPrice: number;
  isWorksSupply: boolean;
  signedSeason: number;
  adaptationPenaltyUntilSeason?: number;
  installationCost?: number;
  isFiaAssigned?: boolean;
};

export type PowerUnitFinancials = {
  annualCost: number;
  annualRevenue: number;
  weeklyCost: number;
  weeklyRevenue: number;
  weeklyNet: number;
};

export type OffseasonStep =
  | "season-summary"
  | "owner-confidence"
  | "resign-drivers"
  | "free-agent-drivers"
  | "resign-sponsors"
  | "technical-review"
  | "ready";

export type OffseasonState = {
  active: boolean;
  step: OffseasonStep;
  completedSteps: OffseasonStep[];
};

export type TeamExpectationProfile = {
  prestigeRating: number;
  roleAwareRating: number;
  roleLabel: string;
  expectedConstructorPosition: number;
  minimumAcceptablePosition: number;
  patience: number;
  financialStrictness: number;
};

export type SponsorRenewalTarget = {
  minimumConstructorPosition: number;
  minimumPoints?: number;
  minimumPodiums?: number;
  minimumWins?: number;
  description: string;
};

export type SponsorContract = {
  id: string;
  sponsorId: string;
  teamId: string;
  name: string;
  titleName?: string;
  category: SponsorCategory;
  annualValue: number;
  startSeason: number;
  endSeason: number;
  confidence: number;
  renewalTarget: SponsorRenewalTarget;
  ambition?: SponsorAmbition;
  namingPartner?: boolean;
};

export type DriverContractStatus = "active" | "future" | "expired";

export type DriverContract = {
  id: string;
  driverId: string;
  teamId: string;
  salary: number;
  startSeason: number;
  endSeason: number;
  role: DriverLineupRole;
  status: DriverContractStatus;
};

export type DriverMoodLabel = "eager" | "open" | "uncertain" | "unhappy";

export type DriverMoodFactor = {
  label: string;
  detail: string;
  delta: number;
  tone: "good" | "neutral" | "bad";
};

export type DriverMood = {
  driverId: string;
  score: number;
  label: DriverMoodLabel;
  factors: DriverMoodFactor[];
};

export type DriverContractFinancials = {
  annualCost: number;
  weeklyCost: number;
};

export type OwnerRiskTier = "secure" | "watched" | "at-risk" | "final-warning";

export type OwnerWarningLevel = "none" | "watched" | "at-risk" | "final-warning" | "fired";

export type OwnerConfidenceReason = {
  label: string;
  detail: string;
  tone: "good" | "neutral" | "bad";
};

export type OwnerConfidenceReview = {
  seasonYear: number;
  teamId: string;
  teamName: string;
  confidenceScore: number;
  previousConfidenceScore: number;
  riskTier: OwnerRiskTier;
  warningLevel: OwnerWarningLevel;
  consecutiveLowConfidenceSeasons: number;
  wasFired: boolean;
  expectationProfile: {
    prestigeRating: number;
    roleAwareRating: number;
    roleLabel: string;
    expectedConstructorPosition: number;
    minimumAcceptablePosition: number;
  };
  seasonResult: {
    constructorPosition: number;
    constructorCount: number;
    points: number;
    wins: number;
    podiums: number;
    budget: number;
    budgetDelta: number;
  };
  reasons: OwnerConfidenceReason[];
};

export type JobSecurityState = {
  confidenceScore: number;
  warningLevel: OwnerWarningLevel;
  consecutiveLowConfidenceSeasons: number;
  lastReview: OwnerConfidenceReview | null;
};

export type TeamDecision = {
  teamId: string;
  week: number;
  tick: number;
  rdSpend: number;
  reliabilitySpend: number;
  facilitySpend: number;
  staffSpend: number;
  sponsorRisk: "low" | "balanced" | "high";
  focus: "balanced" | "aero" | "power" | "mechanical";
  notes?: string;
  source: "player" | "ai";
};

/** Casual, per-race-weekend factory plan the player commits during a Prep week. */
export type WeekendPlan = {
  developmentFocus: "aero" | "power" | "mechanical" | "reliability" | "balanced";
  investmentLevel: "save" | "steady" | "push";
  facilityUpgrade: "none" | "factory" | "cfd" | "simulator";
  sponsorRisk: "low" | "balanced" | "high";
  autoManaged: boolean;
};

export type TeamState = {
  id: string;
  name: string;
  nameTemplate: string;
  abbreviation: string;
  teamType: TeamType;
  budget: number;
  weeklyCosts: number;
  weeklyIncome: number;
  morale: number;
  staff: {
    engineering: number;
    operations: number;
    aeroLead: number;
  };
  facilities: {
    factory: number;
    cfd: number;
    simulator: number;
  };
  sponsors: {
    titleSponsor: string;
    confidence: number;
    basePayout: number;
    portfolio: SponsorContract[];
  };
  rd: {
    aero: number;
    power: number;
    mechanical: number;
    reliability: number;
    queue: TeamUpgradeProject[];
  };
  car: {
    pace: number;
    efficiency: number;
    reliability: number;
  };
  standings: {
    points: number;
    wins: number;
    podiums: number;
  };
  strategyProfile: {
    aggression: number;
    developmentBias: "balanced" | "aero" | "power" | "mechanical";
    budgetDiscipline: number;
    riskTolerance: number;
  };
  /** Live prestige/expectations; shifts with season results. */
  expectation?: TeamExpectationProfile;
};

export type TeamUpgradeProject = {
  id: string;
  teamId: string;
  area: "aero" | "power" | "mechanical" | "reliability";
  startedWeek: number;
  targetWeek: number;
  progress: number;
  cost: number;
  gain: number;
  completed: boolean;
};

export type DriverRaceResult = {
  driverId: string;
  teamId: string;
  position: number;
  points: number;
  dnf: boolean;
  penaltySeconds: number;
  issueCount: number;
  hasFastestLap: boolean;
};

export type FastestPitStopRecord = {
  driverId: string;
  teamId: string;
  stopTimeSeconds: number;
};

export type RaceResult = {
  seasonYear: number;
  round: number;
  raceName: string;
  week: number;
  finishingOrder: Array<{ teamId: string; points: number; dnf: boolean }>;
  /** Per-driver classification (absent on saves created before driver standings existed). */
  driverResults?: DriverRaceResult[];
  poleDriverId?: string;
  fastestPitStop?: FastestPitStopRecord;
};

export type DriverLineupRole = "race" | "reserve";

export type DriverSeasonInfo = {
  driverId: string;
  name: string;
  teamId: string;
  debutYear: number;
  age: number;
  active: boolean;
  fromAcademy: boolean;
  lineupRole: DriverLineupRole;
  /** Hidden career stat — never exposed in UI selectors. */
  raceExperience: number;
  peakProfile: DriverProfile;
  profile: DriverProfile;
};

export type AcademyProspect = {
  driverId: string;
  name: string;
  age: number;
  nationality: string;
  potential: number;
  readiness: number;
  profile: DriverProfile;
};

export type AcademyState = {
  prospects: AcademyProspect[];
};

export type AwardRecipient = {
  driverId?: string;
  teamId?: string;
  name: string;
  value?: number | string;
};

export type SeasonAwards = {
  seasonYear: number;
  wdc: AwardRecipient;
  wcc: AwardRecipient;
  rookieOfYear: AwardRecipient | null;
  mostPoles: AwardRecipient | null;
  mostWins: AwardRecipient | null;
  mostPodiums: AwardRecipient | null;
  mostFastestLaps: AwardRecipient | null;
  fastestPitStop: (AwardRecipient & { stopTimeSeconds: number }) | null;
};

export type SeasonChampions = {
  wdc: AwardRecipient;
  wcc: AwardRecipient;
};

export type DriverChampionshipEntry = {
  driverId: string;
  points: number;
  wins: number;
  podiums: number;
};

export type EventLogEntry = {
  id: string;
  week: number;
  tick: number;
  teamId?: string;
  category:
    | "system"
    | "finance"
    | "staff"
    | "facilities"
    | "rd"
    | "upgrade"
    | "race"
    | "sponsor"
    | "news";
  message: string;
  createdAt: string;
};

export type TeamSnapshot = {
  teamId: string;
  seasonYear: number;
  week: number;
  budget: number;
  carPace: number;
  reliability: number;
  points: number;
};

export type ConstructorDevelopmentTier = "breakthrough" | "gain" | "stable" | "setback" | "collapse";

export type ConstructorDevelopmentReport = {
  seasonYear: number;
  teamId: string;
  teamName: string;
  paceDelta: number;
  efficiencyDelta: number;
  reliabilityDelta: number;
  staffDelta: number;
  facilityDelta: number;
  tier: ConstructorDevelopmentTier;
  headline: string;
};

export type HistoricalArchiveRecord = {
  seasonYear: number;
  raceResults: RaceResult[];
  teamSnapshots: TeamSnapshot[];
  champions: SeasonChampions;
  awards: SeasonAwards;
  retirements: Array<{ driverId: string; name: string; teamId: string }>;
};

export type SeasonState = {
  seasonYear: number;
  currentWeek: number;
  currentRound: number;
  tick: number;
  calendar: CalendarEvent[];
  teams: Record<string, TeamState>;
  pendingDecisions: TeamDecision[];
  decisionHistory: TeamDecision[];
  raceHistory: RaceResult[];
  archive: HistoricalArchiveRecord[];
  constructorDevelopmentHistory: ConstructorDevelopmentReport[];
  eventLog: EventLogEntry[];
  /** World Drivers' Championship points by driver id. */
  driverStandings: Record<string, DriverChampionshipEntry>;
  /** Active interactive race weekend, when a race week is being played. */
  activeRaceWeekend?: RaceWeekendState | null;
  /** Player's committed factory plan for the upcoming race weekend. */
  pendingWeekendPlan?: WeekendPlan | null;
  /** Per-save driver lineups and live ratings. */
  roster: Record<string, DriverSeasonInfo>;
  academy: AcademyState;
  jobSecurity: JobSecurityState;
  offseason: OffseasonState;
  sponsorContracts: SponsorContract[];
  driverContracts: DriverContract[];
  driverMood: Record<string, DriverMood>;
  powerUnits: Record<PowerUnitManufacturerId, PowerUnitManufacturerState>;
  powerUnitContracts: PowerUnitContract[];
};

export type SaveData = {
  meta: SaveMetadata;
  season: SeasonState;
};

export type SimulationDelta = {
  tick: number;
  week: number;
  raceResult?: RaceResult;
  appliedDecisions: TeamDecision[];
  events: EventLogEntry[];
};

export type DashboardSummary = {
  meta: SaveMetadata;
  playerTeam: {
    id: string;
    name: string;
    abbreviation: string;
    budget: number;
    points: number;
    pace: number;
    reliability: number;
  };
  standings: Array<{ teamId: string; abbreviation: string; points: number }>;
  driverLeader: { name: string; points: number } | null;
  upcomingEvent: CalendarEvent | null;
  recentEvents: EventLogEntry[];
};

export type CreateSaveInput = {
  selection: import("@/types/f1").TeamSelection;
  name: string;
  difficulty: SaveDifficulty;
};

export type GameActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };
