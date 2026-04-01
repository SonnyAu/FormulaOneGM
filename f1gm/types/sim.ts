export const SAVE_SCHEMA_VERSION = 1;

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

export type RaceResult = {
  seasonYear: number;
  round: number;
  raceName: string;
  week: number;
  finishingOrder: Array<{ teamId: string; points: number; dnf: boolean }>;
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
    | "sponsor";
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
