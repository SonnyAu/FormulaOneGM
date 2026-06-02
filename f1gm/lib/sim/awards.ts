import { driverMap } from "@/data/drivers";
import { driverNameFromRoster } from "@/lib/sim/roster";
import { SaveData, SeasonAwards, SeasonChampions } from "@/types/sim";

function raceCountInCalendar(save: SaveData): number {
  return save.season.calendar.filter((e) => e.type === "race").length;
}

export function isSeasonComplete(save: SaveData): boolean {
  return save.season.raceHistory.length >= raceCountInCalendar(save);
}

export function getSeasonChampions(save: SaveData): SeasonChampions {
  const awards = getSeasonAwards(save);
  return { wdc: awards.wdc, wcc: awards.wcc };
}

export function getSeasonAwards(save: SaveData): SeasonAwards {
  const { season } = save;
  const roster = season.roster ?? {};
  const nameFor = (driverId: string) => driverNameFromRoster(roster, driverId, driverMap.get(driverId)?.name ?? driverId);
  const teamAbbr = (teamId: string) => season.teams[teamId]?.abbreviation ?? teamId;

  const driverRows = Object.entries(season.driverStandings)
    .map(([driverId, entry]) => ({
      driverId,
      name: nameFor(driverId),
      teamId: roster[driverId]?.teamId ?? "",
      points: entry.points,
      wins: entry.wins,
      podiums: entry.podiums,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  const constructorRows = Object.values(season.teams)
    .map((team) => ({
      teamId: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      points: team.standings.points,
      wins: team.standings.wins,
    }))
    .sort((a, b) => b.points - a.points);

  const wdcLeader = driverRows[0];
  const wccLeader = constructorRows[0];

  const poleCounts = new Map<string, number>();
  const fastestLapCounts = new Map<string, number>();
  let seasonFastestPit: { driverId: string; teamId: string; stopTimeSeconds: number } | null = null;

  for (const race of season.raceHistory) {
    if (race.poleDriverId) {
      poleCounts.set(race.poleDriverId, (poleCounts.get(race.poleDriverId) ?? 0) + 1);
    }
    if (race.driverResults) {
      for (const dr of race.driverResults) {
        if (dr.hasFastestLap) {
          fastestLapCounts.set(dr.driverId, (fastestLapCounts.get(dr.driverId) ?? 0) + 1);
        }
      }
    }
    if (race.fastestPitStop) {
      if (!seasonFastestPit || race.fastestPitStop.stopTimeSeconds < seasonFastestPit.stopTimeSeconds) {
        seasonFastestPit = race.fastestPitStop;
      }
    }
  }

  const topByMap = (map: Map<string, number>) => {
    let bestId: string | null = null;
    let best = 0;
    for (const [id, count] of map) {
      if (count > best) {
        best = count;
        bestId = id;
      }
    }
    if (!bestId || best === 0) return null;
    return { driverId: bestId, name: nameFor(bestId), value: best };
  };

  const rookies = driverRows.filter((d) => roster[d.driverId]?.debutYear === season.seasonYear);
  const rookieOfYear = rookies.length
    ? rookies.sort((a, b) => b.points - a.points)[0]
    : null;

  return {
    seasonYear: season.seasonYear,
    wdc: wdcLeader
      ? { driverId: wdcLeader.driverId, name: wdcLeader.name, value: wdcLeader.points }
      : { name: "—", value: 0 },
    wcc: wccLeader
      ? { teamId: wccLeader.teamId, name: wccLeader.name, value: wccLeader.points }
      : { name: "—", value: 0 },
    rookieOfYear: rookieOfYear
      ? { driverId: rookieOfYear.driverId, name: rookieOfYear.name, value: rookieOfYear.points }
      : null,
    mostPoles: topByMap(poleCounts),
    mostWins: (() => {
      const top = [...driverRows].sort((a, b) => b.wins - a.wins)[0];
      return top && top.wins > 0 ? { driverId: top.driverId, name: top.name, value: top.wins } : null;
    })(),
    mostPodiums: (() => {
      const top = [...driverRows].sort((a, b) => b.podiums - a.podiums)[0];
      return top && top.podiums > 0 ? { driverId: top.driverId, name: top.name, value: top.podiums } : null;
    })(),
    mostFastestLaps: topByMap(fastestLapCounts),
    fastestPitStop: seasonFastestPit
      ? {
          driverId: seasonFastestPit.driverId,
          teamId: seasonFastestPit.teamId,
          name: nameFor(seasonFastestPit.driverId),
          stopTimeSeconds: seasonFastestPit.stopTimeSeconds,
          value: `${seasonFastestPit.stopTimeSeconds.toFixed(2)}s (${teamAbbr(seasonFastestPit.teamId)})`,
        }
      : null,
  };
}

export function getLikelyRetirements(save: SaveData): Array<{ driverId: string; name: string; teamId: string; age: number; overall: number }> {
  const roster = save.season.roster ?? {};
  return Object.values(roster)
    .filter((d) => d.active && d.age >= 35 && d.profile.overall - 72 <= 5)
    .map((d) => ({
      driverId: d.driverId,
      name: d.name,
      teamId: d.teamId,
      age: d.age,
      overall: d.profile.overall,
    }));
}
