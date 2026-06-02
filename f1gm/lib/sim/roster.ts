import { getDriverCareerSeed } from "@/data/driverCareer";
import { driverMap } from "@/data/drivers";
import { getDriverProfile, driverProfiles } from "@/data/driverProfiles";
import { teams } from "@/data/teams";
import { initialProfileFromPeak } from "@/lib/sim/driverCareer";
import { seedAcademyProspects } from "@/lib/sim/academy";
import { DriverProfile } from "@/lib/sim/raceweekend/raceTypes";
import { AcademyState, DriverSeasonInfo } from "@/types/sim";

function peakForDriver(driverId: string, name: string): DriverProfile {
  const existing = driverProfiles[driverId];
  if (existing) return { ...existing };
  return getDriverProfile(driverId, name, 75);
}

export function buildDriverSeasonInfo(
  driverId: string,
  teamId: string,
  seasonYear: number,
  overrides?: { name?: string; debutYear?: number; age?: number; fromAcademy?: boolean },
): DriverSeasonInfo {
  const seed = getDriverCareerSeed(driverId, seasonYear);
  const info = driverMap.get(driverId);
  const name = overrides?.name ?? info?.name ?? driverId;
  const debutYear = overrides?.debutYear ?? seed.debutYear;
  const age = overrides?.age ?? seed.age;
  const peakProfile = peakForDriver(driverId, name);
  const profile = initialProfileFromPeak(peakProfile, age);

  return {
    driverId,
    name,
    teamId,
    debutYear,
    age,
    active: true,
    fromAcademy: overrides?.fromAcademy ?? false,
    peakProfile,
    profile,
  };
}

export function buildRosterFromTeams(seasonYear: number, customDrivers?: { teamId: string; driverOne: string; driverTwo: string }): Record<string, DriverSeasonInfo> {
  const roster: Record<string, DriverSeasonInfo> = {};

  for (const team of teams) {
    for (const driverId of team.driverIds) {
      roster[driverId] = buildDriverSeasonInfo(driverId, team.id, seasonYear);
    }
  }

  if (customDrivers) {
    const d1 = `${customDrivers.teamId}-d1`;
    const d2 = `${customDrivers.teamId}-d2`;
    roster[d1] = buildDriverSeasonInfo(d1, customDrivers.teamId, seasonYear, {
      name: customDrivers.driverOne,
      debutYear: seasonYear,
      age: 22,
    });
    roster[d2] = buildDriverSeasonInfo(d2, customDrivers.teamId, seasonYear, {
      name: customDrivers.driverTwo,
      debutYear: seasonYear,
      age: 21,
    });
  }

  return roster;
}

export function buildInitialAcademy(seasonYear: number): AcademyState {
  return { prospects: seedAcademyProspects(6, seasonYear) };
}

export function activeDriversForTeam(roster: Record<string, DriverSeasonInfo>, teamId: string): string[] {
  return Object.values(roster)
    .filter((d) => d.active && d.teamId === teamId)
    .map((d) => d.driverId)
    .slice(0, 2);
}

export function driverNameFromRoster(roster: Record<string, DriverSeasonInfo>, driverId: string, fallback = "Driver"): string {
  return roster[driverId]?.name ?? driverMap.get(driverId)?.name ?? fallback;
}
