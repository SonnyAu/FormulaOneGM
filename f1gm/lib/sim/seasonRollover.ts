import { createCalendar } from "@/lib/sim/factory";
import { getSeasonAwards, getSeasonChampions } from "@/lib/sim/awards";
import {
  generateAcademyProspect,
  pickBestProspect,
  promoteProspectToDriver,
} from "@/lib/sim/academy";
import { applyDriverCareerTick, shouldRetire } from "@/lib/sim/driverCareer";
import { buildRetirementHeadline } from "@/lib/sim/news";
import { activeDriversForTeam } from "@/lib/sim/roster";
import {
  EventLogEntry,
  HistoricalArchiveRecord,
  SaveData,
  TeamSnapshot,
} from "@/types/sim";

function teamSnapshotsFromSeason(save: SaveData): TeamSnapshot[] {
  return Object.values(save.season.teams).map((team) => ({
    teamId: team.id,
    seasonYear: save.season.seasonYear,
    week: save.season.currentWeek,
    budget: team.budget,
    carPace: team.car.pace,
    reliability: team.car.reliability,
    points: team.standings.points,
  }));
}

export function startNextSeason(save: SaveData): SaveData {
  const next = structuredClone(save) as SaveData;
  const season = next.season;
  const awards = getSeasonAwards(next);
  const champions = getSeasonChampions(next);
  const retirements: HistoricalArchiveRecord["retirements"] = [];

  const archiveRecord: HistoricalArchiveRecord = {
    seasonYear: season.seasonYear,
    raceResults: [...season.raceHistory],
    teamSnapshots: teamSnapshotsFromSeason(next),
    champions,
    awards,
    retirements: [],
  };

  season.archive.push(archiveRecord);

  const newYear = season.seasonYear + 1;
  season.seasonYear = newYear;
  next.meta.seasonYear = newYear;

  for (const driver of Object.values(season.roster)) {
    if (!driver.active) continue;
    driver.age += 1;
    applyDriverCareerTick(driver);
  }

  for (const driver of Object.values(season.roster)) {
    if (!driver.active) continue;
    if (shouldRetire(driver)) {
      driver.active = false;
      retirements.push({ driverId: driver.driverId, name: driver.name, teamId: driver.teamId });
      season.eventLog.push(buildRetirementHeadline(season, driver.driverId, driver.name, driver.teamId));
    }
  }
  archiveRecord.retirements = retirements;

  const teamsNeedingDrivers = new Set<string>();
  for (const teamId of Object.keys(season.teams)) {
    const active = activeDriversForTeam(season.roster, teamId);
    if (active.length < 2) {
      teamsNeedingDrivers.add(teamId);
    }
  }

  for (const teamId of teamsNeedingDrivers) {
    let active = activeDriversForTeam(season.roster, teamId);
    while (active.length < 2) {
      let prospect = pickBestProspect(season.academy.prospects);
      if (!prospect) {
        prospect = generateAcademyProspect(newYear);
      } else {
        season.academy.prospects = season.academy.prospects.filter((p) => p.driverId !== prospect!.driverId);
      }
      const promoted = promoteProspectToDriver(prospect, teamId, newYear);
      season.roster[promoted.driverId] = promoted;
      season.eventLog.push({
        id: `news-promo-${promoted.driverId}-${Date.now()}`,
        week: season.currentWeek,
        tick: season.tick,
        category: "news",
        message: `${promoted.name} promoted from the academy to ${season.teams[teamId]?.name ?? teamId}.`,
        teamId,
        createdAt: new Date().toISOString(),
      });
      active = activeDriversForTeam(season.roster, teamId);
    }
  }

  const targetProspects = 6;
  while (season.academy.prospects.length < targetProspects) {
    season.academy.prospects.push(generateAcademyProspect(newYear));
  }

  for (const team of Object.values(season.teams)) {
    team.standings = { points: 0, wins: 0, podiums: 0 };
  }

  season.driverStandings = {};
  season.raceHistory = [];
  season.currentWeek = 1;
  season.currentRound = 1;
  season.calendar = createCalendar(newYear);
  season.activeRaceWeekend = null;
  season.pendingWeekendPlan = null;

  next.meta.week = 1;
  next.meta.updatedAt = new Date().toISOString();

  const player = season.teams[next.meta.playerTeamId];
  if (player) {
    next.meta.summary = { points: 0, budget: player.budget };
  }

  season.eventLog.push({
    id: `system-${newYear}-start`,
    week: 1,
    tick: season.tick,
    category: "system",
    message: `${newYear} season begins.`,
    createdAt: new Date().toISOString(),
  });

  return next;
}
