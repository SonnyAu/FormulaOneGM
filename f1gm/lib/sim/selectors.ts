import { driverMap } from "@/data/drivers";
import { teams as teamData } from "@/data/teams";
import { getLikelyRetirements, getSeasonAwards, isSeasonComplete } from "@/lib/sim/awards";
import { calculateDriverContractFinancials } from "@/lib/sim/driverContracts";
import { roundRating } from "@/lib/sim/driverCareer";
import { getNewsFeed } from "@/lib/sim/news";
import {
  activePowerUnitContract,
  availableCustomerSlots,
  calculatePowerUnitFinancials,
  customerContractsForManufacturer,
  isWorksTeamId,
  powerUnitMarketForTeam,
  POWER_UNIT_DEVELOPMENT_COST,
  worksManufacturerForTeam,
} from "@/lib/sim/powerUnits";
import { getLineupSwapAvailability } from "@/lib/sim/rosterActions";
import { driverNameFromRoster, raceDriversForTeam, reserveDriverForTeam } from "@/lib/sim/roster";
import { getEffectiveCarProfile } from "@/lib/sim/raceweekend/adapter";
import { recommendWeekendPlan } from "@/lib/sim/subsystems/weekendPlan";
import { CarProfile } from "@/lib/sim/raceweekend/raceTypes";
import {
  CalendarEvent,
  ConstructorDevelopmentReport,
  DashboardSummary,
  HistoricalArchiveRecord,
  RaceResult,
  SaveData,
  SaveDifficulty,
  SeasonAwards,
  SeasonChampions,
  TeamSnapshot,
  TeamUpgradeProject,
  WeekendPlan,
  DriverSeasonInfo,
  PowerUnitContract,
  PowerUnitDevelopmentProgram,
  PowerUnitFinancials,
  PowerUnitManufacturerId,
  PowerUnitRatings,
  SponsorContract,
} from "@/types/sim";

export const FULL_HISTORY_DETAIL_LIMIT = 5;

export function getDashboardSummary(save: SaveData): DashboardSummary {
  const playerTeam = save.season.teams[save.meta.playerTeamId];
  const standings = Object.values(save.season.teams)
    .map((team) => ({ teamId: team.id, abbreviation: team.abbreviation, points: team.standings.points }))
    .sort((a, b) => b.points - a.points);

  const topDriver = Object.values(save.season.driverStandings).sort((a, b) => b.points - a.points || b.wins - a.wins)[0];
  const driverLeader = topDriver
    ? {
        name: driverDisplayName(save, topDriver.driverId, save.season.teams[save.season.roster?.[topDriver.driverId]?.teamId ?? ""]?.abbreviation ?? "-"),
        points: topDriver.points,
      }
    : null;

  return {
    meta: save.meta,
    playerTeam: {
      id: playerTeam.id,
      name: playerTeam.name,
      abbreviation: playerTeam.abbreviation,
      budget: playerTeam.budget,
      points: playerTeam.standings.points,
      pace: playerTeam.car.pace,
      reliability: playerTeam.car.reliability,
    },
    standings,
    driverLeader,
    upcomingEvent: save.season.calendar.find((entry) => entry.week === save.season.currentWeek) ?? null,
    recentEvents: save.season.eventLog.slice(-8).reverse(),
  };
}

export type TeamManagement = {
  teamId: string;
  name: string;
  abbreviation: string;
  difficulty: SaveDifficulty;
  budget: number;
  weeklyIncome: number;
  weeklyCosts: number;
  sponsors: { titleSponsor: string; confidence: number; basePayout: number; portfolio: SponsorContract[] };
  driverFinancials: { annualCost: number; weeklyCost: number };
  facilities: { factory: number; cfd: number; simulator: number };
  staff: { engineering: number; operations: number; aeroLead: number };
  car: { pace: number; efficiency: number; reliability: number };
  rd: { aero: number; power: number; mechanical: number; reliability: number };
  queue: TeamUpgradeProject[];
  effectiveCar: CarProfile;
  powerUnitFinancials: PowerUnitFinancials;
  pendingPlan: WeekendPlan | null;
  nextRace: CalendarEvent | null;
};

export function getTeamManagement(save: SaveData): TeamManagement | null {
  const team = save.season.teams[save.meta.playerTeamId];
  if (!team) return null;

  const nextRace =
    save.season.calendar.find((entry) => entry.type === "race" && entry.week >= save.season.currentWeek) ?? null;

  return {
    teamId: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    difficulty: save.meta.difficulty,
    budget: team.budget,
    weeklyIncome: team.weeklyIncome,
    weeklyCosts: team.weeklyCosts,
    sponsors: team.sponsors,
    driverFinancials: calculateDriverContractFinancials(save.season, team.id),
    facilities: team.facilities,
    staff: team.staff,
    car: team.car,
    rd: { aero: team.rd.aero, power: team.rd.power, mechanical: team.rd.mechanical, reliability: team.rd.reliability },
    queue: team.rd.queue,
    effectiveCar: getEffectiveCarProfile(team, save.season),
    powerUnitFinancials: calculatePowerUnitFinancials(save.season, team.id),
    pendingPlan: save.season.pendingWeekendPlan ?? null,
    nextRace,
  };
}

export type PowerUnitMarketRow = {
  manufacturerId: PowerUnitManufacturerId;
  name: string;
  engineName: string;
  ratings: PowerUnitRatings;
  annualPrice: number;
  weeklyPrice: number;
  customerCount: number;
  customerCapacity: number;
  availableSlots: number;
  eligible: boolean;
  canSign: boolean;
  isCurrentSupplier: boolean;
  blockedReason: string | null;
};

export type PowerUnitManagement = {
  teamId: string;
  teamName: string;
  teamType: "works" | "customer";
  seasonYear: number;
  seasonComplete: boolean;
  budget: number;
  isWorksTeam: boolean;
  currentContract: PowerUnitContract | null;
  currentManufacturer: {
    id: PowerUnitManufacturerId;
    name: string;
    engineName: string;
    ratings: PowerUnitRatings;
  } | null;
  futureContract: PowerUnitContract | null;
  financials: PowerUnitFinancials;
  yearsRemaining: number;
  adaptationActive: boolean;
  market: PowerUnitMarketRow[];
  works: {
    manufacturerId: PowerUnitManufacturerId;
    name: string;
    engineName: string;
    ratings: PowerUnitRatings;
    customerCapacity: number;
    customerCount: number;
    availableSlots: number;
    customers: Array<{
      teamId: string;
      name: string;
      abbreviation: string;
      annualPrice: number;
      endSeason: number;
    }>;
    pendingProgram: PowerUnitDevelopmentProgram | null;
    developmentCosts: typeof POWER_UNIT_DEVELOPMENT_COST;
  } | null;
};

export function getPowerUnitManagement(save: SaveData): PowerUnitManagement | null {
  const team = save.season.teams[save.meta.playerTeamId];
  if (!team) return null;

  const season = save.season;
  const currentContract = activePowerUnitContract(season, team.id);
  const currentPowerUnit = currentContract ? season.powerUnits[currentContract.manufacturerId] : null;
  const futureContract =
    [...(season.powerUnitContracts ?? [])]
      .filter((contract) => contract.teamId === team.id && contract.startSeason > season.seasonYear)
      .sort((a, b) => a.startSeason - b.startSeason)[0] ?? null;
  const seasonComplete = isSeasonComplete(save);
  const contractExpired = currentContract ? currentContract.endSeason <= season.seasonYear : true;
  const playerIsWorksTeam = isWorksTeamId(team.id);

  const market: PowerUnitMarketRow[] = powerUnitMarketForTeam(season, team.id).map((row) => {
    let blockedReason: string | null = null;
    if (playerIsWorksTeam) blockedReason = "Factory teams keep their works PU.";
    else if (!row.eligible) blockedReason = "Supplier is not eligible for this team.";
    else if (!contractExpired) blockedReason = `Current contract runs through ${currentContract?.endSeason}.`;
    else if (futureContract) blockedReason = `Future contract already signed for ${futureContract.startSeason}.`;
    else if (!row.canSupply) blockedReason = "Supplier is at customer capacity.";
    else if (!seasonComplete) blockedReason = "Contracts open after the season review.";

    return {
      manufacturerId: row.manufacturerId,
      name: row.manufacturer.name,
      engineName: row.manufacturer.engineName,
      ratings: row.manufacturer.ratings,
      annualPrice: row.annualPrice,
      weeklyPrice: Math.round(row.annualPrice / Math.max(1, season.calendar.length || 50)),
      customerCount: row.customerCount,
      customerCapacity: row.manufacturer.customerCapacity,
      availableSlots: row.availableSlots,
      eligible: row.eligible,
      canSign: blockedReason === null,
      isCurrentSupplier: row.isCurrentSupplier,
      blockedReason,
    };
  });

  const worksManufacturerId = worksManufacturerForTeam(team.id);
  const worksManufacturer = worksManufacturerId ? season.powerUnits[worksManufacturerId] : null;
  const customerContracts = worksManufacturerId ? customerContractsForManufacturer(season, worksManufacturerId) : [];
  const works = worksManufacturerId && worksManufacturer
    ? {
        manufacturerId: worksManufacturerId,
        name: worksManufacturer.name,
        engineName: worksManufacturer.engineName,
        ratings: worksManufacturer.ratings,
        customerCapacity: worksManufacturer.customerCapacity,
        customerCount: customerContracts.length,
        availableSlots: availableCustomerSlots(season, worksManufacturerId),
        customers: customerContracts.map((contract) => ({
          teamId: contract.teamId,
          name: season.teams[contract.teamId]?.name ?? contract.teamId,
          abbreviation: season.teams[contract.teamId]?.abbreviation ?? contract.teamId,
          annualPrice: contract.annualPrice,
          endSeason: contract.endSeason,
        })),
        pendingProgram: worksManufacturer.pendingDevelopmentProgram ?? null,
        developmentCosts: POWER_UNIT_DEVELOPMENT_COST,
      }
    : null;

  return {
    teamId: team.id,
    teamName: team.name,
    teamType: team.teamType,
    seasonYear: season.seasonYear,
    seasonComplete,
    budget: team.budget,
    isWorksTeam: playerIsWorksTeam,
    currentContract,
    currentManufacturer: currentPowerUnit
      ? {
          id: currentPowerUnit.id,
          name: currentPowerUnit.name,
          engineName: currentPowerUnit.engineName,
          ratings: currentPowerUnit.ratings,
        }
      : null,
    futureContract,
    financials: calculatePowerUnitFinancials(season, team.id),
    yearsRemaining: currentContract ? Math.max(0, currentContract.endSeason - season.seasonYear + 1) : 0,
    adaptationActive:
      currentContract?.adaptationPenaltyUntilSeason !== undefined &&
      currentContract.adaptationPenaltyUntilSeason >= season.seasonYear,
    market,
    works,
  };
}

export function getWeekendPlanRecommendation(save: SaveData): { plan: WeekendPlan; rationale: string } | null {
  const team = save.season.teams[save.meta.playerTeamId];
  if (!team) return null;
  return recommendWeekendPlan(team, save.season);
}

export function getLatestConstructorDevelopmentReports(save: SaveData): ConstructorDevelopmentReport[] {
  const reports = save.season.constructorDevelopmentHistory ?? [];
  const latestYear = reports.reduce((year, report) => Math.max(year, report.seasonYear), 0);
  if (!latestYear) return [];

  const tierRank: Record<ConstructorDevelopmentReport["tier"], number> = {
    breakthrough: 0,
    gain: 1,
    stable: 2,
    setback: 3,
    collapse: 4,
  };

  return reports
    .filter((report) => report.seasonYear === latestYear)
    .sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || b.paceDelta - a.paceDelta || a.teamName.localeCompare(b.teamName));
}

export type TechnicalReview = {
  seasonYear: number;
  teams: Array<{
    teamId: string;
    name: string;
    abbreviation: string;
    pace: number;
    reliability: number;
    staff: number;
    facilities: number;
    budget: number;
  }>;
  powerUnits: Array<{
    id: PowerUnitManufacturerId;
    name: string;
    engineName: string;
    overall: number;
    ice: number;
    ers: number;
    reliability: number;
    integration: number;
  }>;
  reports: ConstructorDevelopmentReport[];
};

export function getTechnicalReview(save: SaveData): TechnicalReview {
  return {
    seasonYear: save.season.seasonYear,
    teams: Object.values(save.season.teams)
      .map((team) => ({
        teamId: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        pace: team.car.pace,
        reliability: team.car.reliability,
        staff: Math.round((team.staff.engineering + team.staff.operations + team.staff.aeroLead) / 3),
        facilities: Math.round((team.facilities.factory + team.facilities.cfd + team.facilities.simulator) / 3),
        budget: team.budget,
      }))
      .sort((a, b) => b.pace - a.pace || b.reliability - a.reliability),
    powerUnits: Object.values(save.season.powerUnits ?? {})
      .map((powerUnit) => ({
        id: powerUnit.id,
        name: powerUnit.name,
        engineName: powerUnit.engineName,
        overall: powerUnit.ratings.overall,
        ice: powerUnit.ratings.ice,
        ers: powerUnit.ratings.ers,
        reliability: powerUnit.ratings.reliability,
        integration: powerUnit.ratings.integration,
      }))
      .sort((a, b) => b.overall - a.overall),
    reports: getLatestConstructorDevelopmentReports(save),
  };
}

export type CalendarRow = CalendarEvent & { completed: boolean; isNext: boolean };

export function getCalendarView(save: SaveData): CalendarRow[] {
  const completedRounds = new Set(save.season.raceHistory.map((result) => result.round));
  const nextRace = save.season.calendar.find((entry) => entry.type === "race" && entry.week >= save.season.currentWeek);

  return save.season.calendar
    .filter((entry) => entry.type === "race")
    .map((entry) => ({
      ...entry,
      completed: completedRounds.has(entry.round),
      isNext: nextRace ? entry.week === nextRace.week : false,
    }));
}

export type ConstructorStandingRow = { teamId: string; abbreviation: string; name: string; points: number; wins: number; podiums: number };
export type DriverStandingRow = { driverId: string; name: string; teamAbbreviation: string; points: number; wins: number; podiums: number };

/** Map every known and synthetic driver id to a display name + team abbreviation. */
function buildDriverTeamMap(save: SaveData): Map<string, { abbreviation: string; teamId: string }> {
  const map = new Map<string, { abbreviation: string; teamId: string }>();
  const roster = save.season.roster ?? {};

  for (const driver of Object.values(roster)) {
    if (!driver.active || driver.lineupRole !== "race") continue;
    map.set(driver.driverId, {
      abbreviation: save.season.teams[driver.teamId]?.abbreviation ?? "-",
      teamId: driver.teamId,
    });
  }

  for (const team of teamData) {
    for (const driverId of team.driverIds) {
      if (!map.has(driverId)) {
        map.set(driverId, { abbreviation: team.abbreviation, teamId: team.id });
      }
    }
  }

  for (const driverId of Object.keys(save.season.driverStandings)) {
    if (map.has(driverId)) continue;
    const rosterEntry = roster[driverId];
    const teamId = rosterEntry?.teamId ?? driverId.replace(/-d[12]$/, "");
    map.set(driverId, { abbreviation: save.season.teams[teamId]?.abbreviation ?? "-", teamId });
  }
  return map;
}

function driverDisplayName(save: SaveData, driverId: string, abbreviation: string): string {
  if (save.season.roster) {
    return driverNameFromRoster(save.season.roster, driverId, driverMap.get(driverId)?.name ?? `${abbreviation} Driver`);
  }
  return driverMap.get(driverId)?.name ?? `${abbreviation} Driver`;
}

export function getStandings(save: SaveData): { constructors: ConstructorStandingRow[]; drivers: DriverStandingRow[] } {
  const constructors = Object.values(save.season.teams)
    .map((team) => ({
      teamId: team.id,
      abbreviation: team.abbreviation,
      name: team.name,
      points: team.standings.points,
      wins: team.standings.wins,
      podiums: team.standings.podiums,
    }))
    .sort((a, b) => b.points - a.points);

  const driverTeam = buildDriverTeamMap(save);
  const driverIds = new Set<string>(driverTeam.keys());

  const drivers: DriverStandingRow[] = [...driverIds]
    .map((driverId) => {
      const info = driverTeam.get(driverId);
      const abbreviation = info?.abbreviation ?? "-";
      const entry = save.season.driverStandings[driverId];
      return {
        driverId,
        name: driverDisplayName(save, driverId, abbreviation),
        teamAbbreviation: abbreviation,
        points: entry?.points ?? 0,
        wins: entry?.wins ?? 0,
        podiums: entry?.podiums ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));

  return { constructors, drivers };
}

export type RaceResultDriverRow = {
  driverId: string;
  name: string;
  teamAbbreviation: string;
  position: number;
  points: number;
  dnf: boolean;
  penaltySeconds: number;
  issueCount: number;
  hasFastestLap: boolean;
};
export type RaceResultRow = {
  round: number;
  raceName: string;
  finishingOrder: Array<{ teamId: string; abbreviation: string; points: number; dnf: boolean }>;
  driverFinishingOrder: RaceResultDriverRow[] | null;
};

function buildRaceResultRows(save: SaveData, raceResults: RaceResult[]): RaceResultRow[] {
  const abbreviation = (teamId: string) => save.season.teams[teamId]?.abbreviation ?? teamId;

  return [...raceResults]
    .sort((a, b) => b.round - a.round)
    .map((result) => ({
      round: result.round,
      raceName: result.raceName,
      finishingOrder: result.finishingOrder.map((row) => ({ ...row, abbreviation: abbreviation(row.teamId) })),
      driverFinishingOrder: result.driverResults
        ? [...result.driverResults]
            .sort((a, b) => (a.dnf === b.dnf ? a.position - b.position : a.dnf ? 1 : -1))
            .map((row) => {
              const abbr = abbreviation(row.teamId);
              return {
                driverId: row.driverId,
                name: driverDisplayName(save, row.driverId, abbr),
                teamAbbreviation: abbr,
                position: row.position,
                points: row.points,
                dnf: row.dnf,
                penaltySeconds: row.penaltySeconds,
                issueCount: row.issueCount,
                hasFastestLap: row.hasFastestLap,
              };
            })
        : null,
    }));
}

export function getRaceResultsView(save: SaveData): RaceResultRow[] {
  return buildRaceResultRows(save, save.season.raceHistory);
}

type ArchiveLikeRecord = {
  seasonYear: number;
  champions: SeasonChampions;
  awards: SeasonAwards;
  retirements: HistoricalArchiveRecord["retirements"];
  raceResults: RaceResult[];
  teamSnapshots: TeamSnapshot[];
  isCurrentSeason: boolean;
};

export type HistoryTeamSnapshotRow = TeamSnapshot & {
  name: string;
  abbreviation: string;
};

export type HistoryRaceParticipantRow = {
  kind: "driver" | "team";
  driverId?: string;
  teamId: string;
  name: string;
  teamAbbreviation: string;
  position: number;
  points: number;
  dnf: boolean;
  hasFastestLap: boolean;
  isPlayerEntry: boolean;
};

export type HistoryRacePodiumRow = {
  round: number;
  raceName: string;
  podium: HistoryRaceParticipantRow[];
  playerResults: HistoryRaceParticipantRow[];
  hasDriverResults: boolean;
};

export type HistorySeasonRow = {
  seasonYear: number;
  champions: SeasonChampions;
  awards: SeasonAwards;
  retirements: HistoricalArchiveRecord["retirements"];
  canViewFullDetails: boolean;
  isCurrentSeason: boolean;
  driverStandings: DriverStandingRow[] | null;
  constructorStandings: ConstructorStandingRow[] | null;
  racePodiums: HistoryRacePodiumRow[] | null;
  teamSnapshots: HistoryTeamSnapshotRow[] | null;
};

export type HistoryView = {
  seasons: HistorySeasonRow[];
  fullDetailLimit: number;
};

function teamName(save: SaveData, teamId: string): string {
  return save.season.teams[teamId]?.name ?? teamData.find((team) => team.id === teamId)?.entrant ?? teamId;
}

function teamAbbreviation(save: SaveData, teamId: string): string {
  return save.season.teams[teamId]?.abbreviation ?? teamData.find((team) => team.id === teamId)?.abbreviation ?? teamId;
}

function teamSnapshotsFromSave(save: SaveData): HistoryTeamSnapshotRow[] {
  return Object.values(save.season.teams)
    .map((team) => ({
      teamId: team.id,
      seasonYear: save.season.seasonYear,
      week: save.season.currentWeek,
      budget: team.budget,
      carPace: team.car.pace,
      reliability: team.car.reliability,
      points: team.standings.points,
      name: team.name,
      abbreviation: team.abbreviation,
    }))
    .sort((a, b) => b.points - a.points);
}

function decorateTeamSnapshots(save: SaveData, snapshots: TeamSnapshot[]): HistoryTeamSnapshotRow[] {
  return [...snapshots]
    .map((snapshot) => ({
      ...snapshot,
      name: teamName(save, snapshot.teamId),
      abbreviation: teamAbbreviation(save, snapshot.teamId),
    }))
    .sort((a, b) => b.points - a.points);
}

function buildHistoryRacePodiums(save: SaveData, raceResults: RaceResult[]): HistoryRacePodiumRow[] {
  const playerTeamId = save.meta.playerTeamId;

  return [...raceResults]
    .sort((a, b) => a.round - b.round)
    .map((race) => {
      if (race.driverResults?.length) {
        const toDriverRow = (row: NonNullable<RaceResult["driverResults"]>[number]): HistoryRaceParticipantRow => {
          const abbreviation = teamAbbreviation(save, row.teamId);
          return {
            kind: "driver",
            driverId: row.driverId,
            teamId: row.teamId,
            name: driverDisplayName(save, row.driverId, abbreviation),
            teamAbbreviation: abbreviation,
            position: row.position,
            points: row.points,
            dnf: row.dnf,
            hasFastestLap: row.hasFastestLap,
            isPlayerEntry: row.teamId === playerTeamId,
          };
        };

        const podium = [...race.driverResults]
          .filter((row) => !row.dnf)
          .sort((a, b) => a.position - b.position)
          .slice(0, 3)
          .map(toDriverRow);
        const podiumDriverIds = new Set(podium.map((row) => row.driverId).filter((driverId): driverId is string => Boolean(driverId)));

        return {
          round: race.round,
          raceName: race.raceName,
          podium,
          playerResults: [...race.driverResults]
            .filter((row) => row.teamId === playerTeamId && !podiumDriverIds.has(row.driverId))
            .sort((a, b) => (a.dnf === b.dnf ? a.position - b.position : a.dnf ? 1 : -1))
            .map(toDriverRow),
          hasDriverResults: true,
        };
      }

      return {
        round: race.round,
        raceName: race.raceName,
        podium: race.finishingOrder
          .filter((row) => !row.dnf)
          .slice(0, 3)
          .map<HistoryRaceParticipantRow>((row, index) => ({
            kind: "team",
            teamId: row.teamId,
            name: teamName(save, row.teamId),
            teamAbbreviation: teamAbbreviation(save, row.teamId),
            position: index + 1,
            points: row.points,
            dnf: row.dnf,
            hasFastestLap: false,
            isPlayerEntry: row.teamId === playerTeamId,
          })),
        playerResults: [],
        hasDriverResults: false,
      };
    });
}

function archivedDriverStandings(save: SaveData, raceResults: RaceResult[]): DriverStandingRow[] | null {
  const standings = new Map<string, { driverId: string; teamId: string; points: number; wins: number; podiums: number }>();
  let hasDriverResults = false;

  for (const race of raceResults) {
    for (const row of race.driverResults ?? []) {
      hasDriverResults = true;
      const entry = standings.get(row.driverId) ?? { driverId: row.driverId, teamId: row.teamId, points: 0, wins: 0, podiums: 0 };
      entry.teamId = row.teamId;
      entry.points += row.points;
      if (!row.dnf && row.position === 1) entry.wins += 1;
      if (!row.dnf && row.position <= 3) entry.podiums += 1;
      standings.set(row.driverId, entry);
    }
  }

  if (!hasDriverResults) return null;

  return [...standings.values()]
    .map((entry) => {
      const abbreviation = teamAbbreviation(save, entry.teamId);
      return {
        driverId: entry.driverId,
        name: driverDisplayName(save, entry.driverId, abbreviation),
        teamAbbreviation: abbreviation,
        points: entry.points,
        wins: entry.wins,
        podiums: entry.podiums,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

function archivedConstructorStandings(save: SaveData, raceResults: RaceResult[], snapshots: TeamSnapshot[]): ConstructorStandingRow[] | null {
  const standings = new Map<string, { teamId: string; points: number; wins: number; podiums: number }>();

  for (const race of raceResults) {
    race.finishingOrder.forEach((row, index) => {
      const entry = standings.get(row.teamId) ?? { teamId: row.teamId, points: 0, wins: 0, podiums: 0 };
      entry.points += row.points;
      if (!row.dnf && index === 0) entry.wins += 1;
      if (!row.dnf && index <= 2) entry.podiums += 1;
      standings.set(row.teamId, entry);
    });
  }

  if (standings.size === 0) {
    for (const snapshot of snapshots) {
      standings.set(snapshot.teamId, { teamId: snapshot.teamId, points: snapshot.points, wins: 0, podiums: 0 });
    }
  }

  if (standings.size === 0) return null;

  return [...standings.values()]
    .map((entry) => ({
      teamId: entry.teamId,
      abbreviation: teamAbbreviation(save, entry.teamId),
      name: teamName(save, entry.teamId),
      points: entry.points,
      wins: entry.wins,
      podiums: entry.podiums,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

function currentSeasonHistoryRecord(save: SaveData): ArchiveLikeRecord | null {
  if (!isSeasonComplete(save)) return null;
  const awards = getSeasonAwards(save);
  return {
    seasonYear: save.season.seasonYear,
    champions: { wdc: awards.wdc, wcc: awards.wcc },
    awards,
    retirements: [],
    raceResults: save.season.raceHistory,
    teamSnapshots: teamSnapshotsFromSave(save),
    isCurrentSeason: true,
  };
}

function archivedSeasonHistoryRecord(record: HistoricalArchiveRecord): ArchiveLikeRecord {
  return {
    seasonYear: record.seasonYear,
    champions: record.champions,
    awards: record.awards,
    retirements: record.retirements ?? [],
    raceResults: record.raceResults ?? [],
    teamSnapshots: record.teamSnapshots ?? [],
    isCurrentSeason: false,
  };
}

export function getHistoryView(save: SaveData): HistoryView {
  const records = save.season.archive.map(archivedSeasonHistoryRecord);
  const current = currentSeasonHistoryRecord(save);
  if (current) records.push(current);

  const sortedRecords = records.sort((a, b) => b.seasonYear - a.seasonYear);

  return {
    fullDetailLimit: FULL_HISTORY_DETAIL_LIMIT,
    seasons: sortedRecords.map((record, index) => {
      const canViewFullDetails = index < FULL_HISTORY_DETAIL_LIMIT && (record.raceResults.length > 0 || record.teamSnapshots.length > 0);
      const racePodiums = canViewFullDetails ? buildHistoryRacePodiums(save, record.raceResults) : null;
      const teamSnapshots = canViewFullDetails ? decorateTeamSnapshots(save, record.teamSnapshots) : null;
      return {
        seasonYear: record.seasonYear,
        champions: record.champions,
        awards: record.awards,
        retirements: record.retirements,
        canViewFullDetails,
        isCurrentSeason: record.isCurrentSeason,
        driverStandings: canViewFullDetails
          ? record.isCurrentSeason
            ? getStandings(save).drivers
            : archivedDriverStandings(save, record.raceResults)
          : null,
        constructorStandings: canViewFullDetails
          ? record.isCurrentSeason
            ? getStandings(save).constructors
            : archivedConstructorStandings(save, record.raceResults, record.teamSnapshots)
          : null,
        racePodiums,
        teamSnapshots,
      };
    }),
  };
}

export { getLikelyRetirements, getNewsFeed, getSeasonAwards, isSeasonComplete };

export type AcademyViewRow = {
  driverId: string;
  name: string;
  age: number;
  nationality: string;
  potential: number;
  readiness: number;
  overall: number;
};

export function getAcademyView(save: SaveData): AcademyViewRow[] {
  const prospects = save.season.academy?.prospects ?? [];
  return [...prospects]
    .sort((a, b) => b.readiness - a.readiness)
    .map((p) => ({
      driverId: p.driverId,
      name: p.name,
      age: p.age,
      nationality: p.nationality,
      potential: roundRating(p.potential),
      readiness: roundRating(p.readiness),
      overall: roundRating(p.profile.overall),
    }));
}

export type RosterDriverRow = {
  driverId: string;
  name: string;
  age: number;
  nationality: string;
  lineupRole: "race" | "reserve";
  overall: number;
  qualifying: number;
  racePace: number;
  consistency: number;
  championshipPoints: number;
  wins: number;
  podiums: number;
  fromAcademy: boolean;
  canSwapWithReserve?: boolean;
};

export type RosterView = {
  raceDrivers: RosterDriverRow[];
  reserve: RosterDriverRow | null;
  academy: AcademyViewRow[];
  swapAllowed: boolean;
  swapBlockedReason?: string;
};

function toRosterDriverRow(
  save: SaveData,
  driver: DriverSeasonInfo,
  options?: { canSwap?: boolean },
): RosterDriverRow {
  const info = driverMap.get(driver.driverId);
  const entry = save.season.driverStandings[driver.driverId];
  return {
    driverId: driver.driverId,
    name: driver.name,
    age: driver.age,
    nationality: info?.nationality ?? "—",
    lineupRole: driver.lineupRole,
    overall: roundRating(driver.profile.overall),
    qualifying: roundRating(driver.profile.qualifying),
    racePace: roundRating(driver.profile.racePace),
    consistency: roundRating(driver.profile.consistency),
    championshipPoints: entry?.points ?? 0,
    wins: entry?.wins ?? 0,
    podiums: entry?.podiums ?? 0,
    fromAcademy: driver.fromAcademy,
    canSwapWithReserve: options?.canSwap,
  };
}

export function getRosterView(save: SaveData): RosterView {
  const teamId = save.meta.playerTeamId;
  const swap = getLineupSwapAvailability(save);
  const raceDrivers = raceDriversForTeam(save.season.roster, teamId);
  const reserve = reserveDriverForTeam(save.season.roster, teamId);

  return {
    raceDrivers: raceDrivers.map((d) =>
      toRosterDriverRow(save, d, { canSwap: swap.allowed && reserve !== null }),
    ),
    reserve: reserve ? toRosterDriverRow(save, reserve) : null,
    academy: getAcademyView(save),
    swapAllowed: swap.allowed,
    swapBlockedReason: swap.reason,
  };
}
