import type { DriverProfile, RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";

export const SAVE_SCHEMA_VERSION = 5;

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

export type DriverSeasonInfo = {
  driverId: string;
  name: string;
  teamId: string;
  debutYear: number;
  age: number;
  active: boolean;
  fromAcademy: boolean;
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
