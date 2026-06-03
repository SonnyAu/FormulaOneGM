import { EventLogEntry, SaveData } from "@/types/sim";
import { reserveDriverForTeam } from "@/lib/sim/roster";

export type LineupSwapAvailability = {
  allowed: boolean;
  reason?: string;
};

export function getLineupSwapAvailability(save: SaveData): LineupSwapAvailability {
  if (save.season.activeRaceWeekend) {
    return { allowed: false, reason: "Lineup locked during race weekend." };
  }
  return { allowed: true };
}

function lineupEvent(message: string, week: number, tick: number, teamId: string): EventLogEntry {
  return {
    id: `news-lineup-${week}-${tick}-${Math.random().toString(16).slice(2, 6)}`,
    category: "news",
    message,
    week,
    tick,
    teamId,
    createdAt: new Date().toISOString(),
  };
}

export type SwapDriverResult = {
  save: SaveData;
  message: string;
};

export function swapDriverWithReserve(
  save: SaveData,
  playerTeamId: string,
  raceDriverId: string,
): SwapDriverResult | { error: string } {
  const availability = getLineupSwapAvailability(save);
  if (!availability.allowed) {
    return { error: availability.reason ?? "Lineup changes are not allowed right now." };
  }

  const season = save.season;
  const raceDriver = season.roster[raceDriverId];
  if (!raceDriver || !raceDriver.active) {
    return { error: "Driver not found on your roster." };
  }
  if (raceDriver.teamId !== playerTeamId) {
    return { error: "That driver is not on your team." };
  }
  if (raceDriver.lineupRole !== "race") {
    return { error: "Only race drivers can be swapped with the reserve." };
  }

  const reserve = reserveDriverForTeam(season.roster, playerTeamId);
  if (!reserve) {
    return { error: "No reserve driver available." };
  }

  const outgoingName = raceDriver.name;
  const incomingName = reserve.name;

  raceDriver.lineupRole = "reserve";
  reserve.lineupRole = "race";

  const message = `Lineup change: ${incomingName} replaces ${outgoingName} for the next event.`;
  season.eventLog.push(lineupEvent(message, season.currentWeek, season.tick, playerTeamId));

  return { save, message };
}
