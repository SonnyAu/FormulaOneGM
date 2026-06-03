import { getDriverCareerSeed } from "@/data/driverCareer";
import { driverMap } from "@/data/drivers";
import { getDriverProfile, driverProfiles } from "@/data/driverProfiles";
import { teams } from "@/data/teams";
import { initialProfileFromPeak } from "@/lib/sim/driverCareer";
import { seedAcademyProspects } from "@/lib/sim/academy";
import { DriverProfile } from "@/lib/sim/raceweekend/raceTypes";
import { AcademyState, DriverLineupRole, DriverSeasonInfo } from "@/types/sim";

const RESERVE_FIRST_NAMES = [
  "Marcus",
  "Theo",
  "Felipe",
  "Luca",
  "Enzo",
  "Noah",
  "Kai",
  "Rafael",
  "Sven",
  "Hugo",
  "Mateo",
  "Leo",
  "Axel",
  "Nico",
  "Victor",
];

const RESERVE_LAST_NAMES = [
  "Lundgaard",
  "Martinez",
  "Schmidt",
  "Rossi",
  "Tanaka",
  "Okafor",
  "Dupont",
  "Kowalski",
  "Silva",
  "Nguyen",
  "Berg",
  "Costa",
  "Webb",
  "Fischer",
  "Moretti",
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function peakForDriver(driverId: string, name: string, overallHint?: number): DriverProfile {
  const existing = driverProfiles[driverId];
  if (existing) return { ...existing };
  return getDriverProfile(driverId, name, overallHint ?? 75);
}

function buildPeakForPotential(driverId: string, name: string, potential: number): DriverProfile {
  const base = getDriverProfile(driverId, name, potential);
  const scale = potential / Math.max(base.overall, 1);
  const scaled: DriverProfile = { ...base, overall: potential };
  const keys: Array<keyof Omit<DriverProfile, "id" | "name" | "overall">> = [
    "qualifying",
    "racePace",
    "tireManagement",
    "overtaking",
    "defending",
    "consistency",
    "wetWeather",
    "braking",
    "traction",
    "lowSpeed",
    "highSpeed",
    "adaptability",
  ];
  for (const key of keys) {
    scaled[key] = clamp(Math.round(base[key] * scale), 40, 99);
  }
  scaled.overall = potential;
  return scaled;
}

export function buildDriverSeasonInfo(
  driverId: string,
  teamId: string,
  seasonYear: number,
  overrides?: {
    name?: string;
    debutYear?: number;
    age?: number;
    fromAcademy?: boolean;
    lineupRole?: DriverLineupRole;
    raceExperience?: number;
  },
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
    lineupRole: overrides?.lineupRole ?? "race",
    raceExperience: overrides?.raceExperience ?? 0,
    peakProfile,
    profile,
  };
}

/** Procedural bench driver — slightly more race-ready than academy prospects. */
export function generateReserveDriver(teamId: string, seasonYear: number): DriverSeasonInfo {
  const driverId = `${teamId}-reserve`;
  const name = `${randomItem(RESERVE_FIRST_NAMES)} ${randomItem(RESERVE_LAST_NAMES)}`;
  const age = 20 + Math.floor(Math.random() * 5);
  const potential = clamp(68 + Math.floor(Math.random() * 11), 68, 78);
  const peakProfile = buildPeakForPotential(driverId, name, potential);
  const profile = initialProfileFromPeak(peakProfile, age);

  return {
    driverId,
    name,
    teamId,
    debutYear: seasonYear,
    age,
    active: true,
    fromAcademy: false,
    lineupRole: "reserve",
    raceExperience: 0,
    peakProfile,
    profile,
  };
}

export function buildRosterFromTeams(
  seasonYear: number,
  customDrivers?: { teamId: string; driverOne: string; driverTwo: string },
): Record<string, DriverSeasonInfo> {
  const roster: Record<string, DriverSeasonInfo> = {};

  for (const team of teams) {
    for (const driverId of team.driverIds) {
      roster[driverId] = buildDriverSeasonInfo(driverId, team.id, seasonYear, { lineupRole: "race" });
    }
    roster[`${team.id}-reserve`] = generateReserveDriver(team.id, seasonYear);
  }

  if (customDrivers) {
    const { teamId } = customDrivers;
    const d1 = `${teamId}-d1`;
    const d2 = `${teamId}-d2`;
    roster[d1] = buildDriverSeasonInfo(d1, teamId, seasonYear, {
      name: customDrivers.driverOne,
      debutYear: seasonYear,
      age: 22,
      lineupRole: "race",
    });
    roster[d2] = buildDriverSeasonInfo(d2, teamId, seasonYear, {
      name: customDrivers.driverTwo,
      debutYear: seasonYear,
      age: 21,
      lineupRole: "race",
    });
    roster[`${teamId}-reserve`] = generateReserveDriver(teamId, seasonYear);
  }

  return roster;
}

export function buildInitialAcademy(seasonYear: number): AcademyState {
  return { prospects: seedAcademyProspects(6, seasonYear) };
}

export function raceDriversForTeam(roster: Record<string, DriverSeasonInfo>, teamId: string): DriverSeasonInfo[] {
  return Object.values(roster)
    .filter((d) => d.active && d.teamId === teamId && d.lineupRole === "race")
    .sort((a, b) => a.driverId.localeCompare(b.driverId))
    .slice(0, 2);
}

export function reserveDriverForTeam(
  roster: Record<string, DriverSeasonInfo>,
  teamId: string,
): DriverSeasonInfo | null {
  return (
    Object.values(roster).find((d) => d.active && d.teamId === teamId && d.lineupRole === "reserve") ?? null
  );
}

export function activeDriversForTeam(roster: Record<string, DriverSeasonInfo>, teamId: string): string[] {
  return raceDriversForTeam(roster, teamId).map((d) => d.driverId);
}

export function driverNameFromRoster(roster: Record<string, DriverSeasonInfo>, driverId: string, fallback = "Driver"): string {
  return roster[driverId]?.name ?? driverMap.get(driverId)?.name ?? fallback;
}

/** Ensure every team has lineup roles and a reserve driver (v6 migration helper). */
export function ensureTeamLineupStructure(
  roster: Record<string, DriverSeasonInfo>,
  teamIds: string[],
  seasonYear: number,
): void {
  for (const driver of Object.values(roster)) {
    if (driver.raceExperience === undefined) driver.raceExperience = 0;
    if (driver.lineupRole === undefined) driver.lineupRole = "race";
  }

  for (const teamId of teamIds) {
    const onTeam = Object.values(roster).filter((d) => d.active && d.teamId === teamId);
    const reserve = onTeam.find((d) => d.lineupRole === "reserve");

    if (!reserve) {
      const generated = generateReserveDriver(teamId, seasonYear);
      roster[generated.driverId] = generated;
    }

    const raceDrivers = onTeam.filter((d) => d.lineupRole === "race");
    if (raceDrivers.length > 2) {
      const sorted = [...raceDrivers].sort((a, b) => a.driverId.localeCompare(b.driverId));
      for (let i = 2; i < sorted.length; i += 1) {
        sorted[i]!.lineupRole = "reserve";
      }
    }
  }
}
