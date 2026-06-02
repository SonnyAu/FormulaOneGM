import { driverMap } from "@/data/drivers";
import { driverNameFromRoster } from "@/lib/sim/roster";
import { RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";
import { EventLogEntry, RaceResult, SaveData, SeasonState } from "@/types/sim";

function event(
  category: EventLogEntry["category"],
  message: string,
  week: number,
  tick: number,
  teamId?: string,
): EventLogEntry {
  return {
    id: `${category}-${week}-${tick}-${Math.random().toString(16).slice(2, 8)}`,
    category,
    message,
    week,
    tick,
    teamId,
    createdAt: new Date().toISOString(),
  };
}

function driverName(season: SeasonState, driverId: string): string {
  if (season.roster) {
    return driverNameFromRoster(season.roster, driverId, driverMap.get(driverId)?.name ?? driverId);
  }
  return driverMap.get(driverId)?.name ?? driverId;
}

export function buildRaceHeadlines(
  season: SeasonState,
  raceResult: RaceResult,
  weekend: RaceWeekendState,
  playerTeamId: string,
): EventLogEntry[] {
  const headlines: EventLogEntry[] = [];
  const week = season.currentWeek;
  const tick = season.tick;
  const classification = weekend.result?.classification ?? [];
  const winner = classification.find((r) => !r.dnf && r.position === 1);

  if (winner) {
    const winnerName = driverName(season, winner.driverId);
    headlines.push(event("news", `${winnerName} wins the ${raceResult.raceName}.`, week, tick));
  }

  if (raceResult.poleDriverId) {
    headlines.push(
      event("news", `${driverName(season, raceResult.poleDriverId)} takes pole for ${raceResult.raceName}.`, week, tick),
    );
  }

  const flDriver = raceResult.driverResults?.find((r) => r.hasFastestLap);
  if (flDriver) {
    headlines.push(
      event("news", `${driverName(season, flDriver.driverId)} sets the fastest lap at ${raceResult.raceName}.`, week, tick),
    );
  }

  if (raceResult.fastestPitStop) {
    headlines.push(
      event(
        "news",
        `Fastest pit stop: ${driverName(season, raceResult.fastestPitStop.driverId)} in ${raceResult.fastestPitStop.stopTimeSeconds.toFixed(2)}s.`,
        week,
        tick,
      ),
    );
  }

  const playerDrivers = classification.filter((r) => {
    const entry = weekend.entries.find((e) => e.driverId === r.driverId);
    return entry?.teamId === playerTeamId;
  });
  for (const pd of playerDrivers) {
    const label = pd.dnf ? "retires" : `finishes P${pd.position}`;
    headlines.push(
      event(
        "news",
        `Your driver ${driverName(season, pd.driverId)} ${label} at ${raceResult.raceName}.`,
        week,
        tick,
        playerTeamId,
      ),
    );
  }

  const sorted = Object.entries(season.driverStandings).sort((a, b) => b[1].points - a[1].points);
  if (sorted[0]) {
    headlines.push(
      event(
        "news",
        `Championship lead: ${driverName(season, sorted[0][0])} (${sorted[0][1].points} pts).`,
        week,
        tick,
      ),
    );
  }

  return headlines;
}

export function buildRetirementHeadline(
  season: SeasonState,
  driverId: string,
  name: string,
  teamId: string,
): EventLogEntry {
  return event(
    "news",
    `${name} announces retirement after declining form.`,
    season.currentWeek,
    season.tick,
    teamId,
  );
}

export function getNewsFeed(save: SaveData, limit = 50): EventLogEntry[] {
  return [...save.season.eventLog]
    .filter((e) => e.category === "news" || e.category === "race")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
