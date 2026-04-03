import { teams } from "@/data/teams";
import { TeamSelection } from "@/types/f1";
import {
  CalendarEvent,
  CreateSaveInput,
  HistoricalArchiveRecord,
  SaveData,
  SaveMetadata,
  SeasonState,
  TeamState,
} from "@/types/sim";

function createCalendar(seasonYear: number): CalendarEvent[] {
  const races = [
    "Bahrain GP",
    "Saudi Arabian GP",
    "Australian GP",
    "Japanese GP",
    "Miami GP",
    "Emilia Romagna GP",
    "Monaco GP",
    "Canadian GP",
    "Spanish GP",
    "Austrian GP",
  ];

  const calendar: CalendarEvent[] = [];
  let week = 1;
  races.forEach((race, index) => {
    calendar.push({ week, round: index + 1, name: `${race} Prep`, type: "week" });
    week += 1;
    calendar.push({ week, round: index + 1, name: race, type: "race" });
    week += 1;
  });

  calendar.push({ week, round: races.length, name: "Development Break", type: "week" });
  calendar.push({ week: week + 1, round: races.length, name: `${seasonYear} Season Review`, type: "week" });
  return calendar;
}

function createBaselineTeam(teamId: string, name: string, abbreviation: string, teamType: "works" | "customer"): TeamState {
  const worksBonus = teamType === "works" ? 1 : 0;

  return {
    id: teamId,
    name,
    abbreviation,
    teamType,
    budget: teamType === "works" ? 200_000_000 : 130_000_000,
    weeklyCosts: teamType === "works" ? 3_600_000 : 2_600_000,
    weeklyIncome: teamType === "works" ? 3_900_000 : 3_000_000,
    morale: 65 + worksBonus * 8,
    staff: { engineering: 60 + worksBonus * 10, operations: 58 + worksBonus * 8, aeroLead: 60 + worksBonus * 9 },
    facilities: { factory: 55 + worksBonus * 10, cfd: 56 + worksBonus * 10, simulator: 57 + worksBonus * 9 },
    sponsors: {
      titleSponsor: `${abbreviation} Global Partners`,
      confidence: 60 + worksBonus * 8,
      basePayout: teamType === "works" ? 2_100_000 : 1_500_000,
    },
    rd: {
      aero: 50 + worksBonus * 8,
      power: 50 + worksBonus * 7,
      mechanical: 50 + worksBonus * 7,
      reliability: 55 + worksBonus * 8,
      queue: [],
    },
    car: { pace: 58 + worksBonus * 8, efficiency: 57 + worksBonus * 7, reliability: 64 + worksBonus * 8 },
    standings: { points: 0, wins: 0, podiums: 0 },
    strategyProfile: {
      aggression: teamType === "works" ? 0.7 : 0.45,
      developmentBias: "balanced",
      budgetDiscipline: teamType === "works" ? 0.52 : 0.72,
      riskTolerance: teamType === "works" ? 0.66 : 0.48,
    },
  };
}

function resolvePlayerTeamName(selection: TeamSelection): string {
  if (selection.mode === "custom") {
    return selection.team.constructorName;
  }

  return teams.find((team) => team.id === selection.teamId)?.entrant ?? "Unknown Team";
}

export function createNewSave(input: CreateSaveInput, seasonYear = 2026): SaveData {
  const { selection, difficulty, name } = input;
  const calendar = createCalendar(seasonYear);
  const now = new Date().toISOString();
  const id = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  const gameTeams = teams.map((team) =>
    createBaselineTeam(
      team.id,
      team.entrant,
      team.abbreviation,
      team.constructor.includes("-") ? "customer" : "works",
    ),
  );

  const playerTeamId = selection.mode === "existing" ? selection.teamId : "custom-player-team";

  if (selection.mode === "custom") {
    const customTeam = createBaselineTeam(
      playerTeamId,
      selection.team.constructorName,
      selection.team.constructorName.slice(0, 3).toUpperCase(),
      "customer",
    );
    customTeam.weeklyIncome = 2_200_000;
    customTeam.budget = 95_000_000;
    customTeam.sponsors.titleSponsor = `${selection.team.constructorName} Ventures`;
    gameTeams.push(customTeam);
  }

  const teamsById = Object.fromEntries(gameTeams.map((team) => [team.id, team]));

  const meta: SaveMetadata = {
    id,
    name: name.trim() || `${seasonYear} Career Save`,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
    version: 1,
    playerTeamId,
    playerTeamName: resolvePlayerTeamName(selection),
    seasonYear,
    week: 1,
    difficulty,
    summary: {
      points: 0,
      budget: teamsById[playerTeamId]?.budget ?? 0,
    },
  };

  const season: SeasonState = {
    seasonYear,
    currentWeek: 1,
    currentRound: 1,
    tick: 0,
    calendar,
    teams: teamsById,
    pendingDecisions: [],
    decisionHistory: [],
    raceHistory: [],
    archive: [] as HistoricalArchiveRecord[],
    eventLog: [
      {
        id: `${id}-start`,
        week: 1,
        tick: 0,
        category: "system",
        message: "Save initialized.",
        createdAt: now,
      },
    ],
  };

  return { meta, season };
}
