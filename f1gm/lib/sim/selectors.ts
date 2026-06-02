import { driverMap } from "@/data/drivers";
import { teams as teamData } from "@/data/teams";
import { getLikelyRetirements, getSeasonAwards, isSeasonComplete } from "@/lib/sim/awards";
import { getNewsFeed } from "@/lib/sim/news";
import { driverNameFromRoster } from "@/lib/sim/roster";
import { getEffectiveCarProfile } from "@/lib/sim/raceweekend/adapter";
import { recommendWeekendPlan } from "@/lib/sim/subsystems/weekendPlan";
import { CarProfile } from "@/lib/sim/raceweekend/raceTypes";
import { CalendarEvent, DashboardSummary, SaveData, SaveDifficulty, TeamUpgradeProject, WeekendPlan } from "@/types/sim";

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
  sponsors: { titleSponsor: string; confidence: number; basePayout: number };
  facilities: { factory: number; cfd: number; simulator: number };
  staff: { engineering: number; operations: number; aeroLead: number };
  car: { pace: number; efficiency: number; reliability: number };
  rd: { aero: number; power: number; mechanical: number; reliability: number };
  queue: TeamUpgradeProject[];
  effectiveCar: CarProfile;
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
    facilities: team.facilities,
    staff: team.staff,
    car: team.car,
    rd: { aero: team.rd.aero, power: team.rd.power, mechanical: team.rd.mechanical, reliability: team.rd.reliability },
    queue: team.rd.queue,
    effectiveCar: getEffectiveCarProfile(team),
    pendingPlan: save.season.pendingWeekendPlan ?? null,
    nextRace,
  };
}

export function getWeekendPlanRecommendation(save: SaveData): { plan: WeekendPlan; rationale: string } | null {
  const team = save.season.teams[save.meta.playerTeamId];
  if (!team) return null;
  return recommendWeekendPlan(team, save.season);
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
    if (!driver.active) continue;
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

export type RaceResultDriverRow = { driverId: string; name: string; teamAbbreviation: string; position: number; points: number; dnf: boolean; hasFastestLap: boolean };
export type RaceResultRow = {
  round: number;
  raceName: string;
  finishingOrder: Array<{ teamId: string; abbreviation: string; points: number; dnf: boolean }>;
  driverFinishingOrder: RaceResultDriverRow[] | null;
};

export function getRaceResultsView(save: SaveData): RaceResultRow[] {
  const abbreviation = (teamId: string) => save.season.teams[teamId]?.abbreviation ?? teamId;
  const driverTeam = buildDriverTeamMap(save);

  return [...save.season.raceHistory]
    .sort((a, b) => b.round - a.round)
    .map((result) => ({
      round: result.round,
      raceName: result.raceName,
      finishingOrder: result.finishingOrder.map((row) => ({ ...row, abbreviation: abbreviation(row.teamId) })),
      driverFinishingOrder: result.driverResults
        ? [...result.driverResults]
            .sort((a, b) => (a.dnf === b.dnf ? a.position - b.position : a.dnf ? 1 : -1))
            .map((row) => {
              const abbr = driverTeam.get(row.driverId)?.abbreviation ?? abbreviation(row.teamId);
              return {
                driverId: row.driverId,
                name: driverDisplayName(save, row.driverId, abbr),
                teamAbbreviation: abbr,
                position: row.position,
                points: row.points,
                dnf: row.dnf,
                hasFastestLap: row.hasFastestLap,
              };
            })
        : null,
    }));
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
      potential: p.potential,
      readiness: p.readiness,
      overall: p.profile.overall,
    }));
}
