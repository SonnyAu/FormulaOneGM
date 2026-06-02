import { getDriverProfile } from "@/data/driverProfiles";
import { DriverProfile } from "@/lib/sim/raceweekend/raceTypes";
import { initialProfileFromPeak } from "@/lib/sim/driverCareer";
import { AcademyProspect, DriverSeasonInfo } from "@/types/sim";

const FIRST_NAMES = [
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

const LAST_NAMES = [
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

const NATIONALITIES = ["United Kingdom", "France", "Italy", "Brazil", "Germany", "Spain", "Netherlands", "Japan", "USA"];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildPeakProfile(driverId: string, name: string, potential: number): DriverProfile {
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

export function generateAcademyProspect(seasonYear: number): AcademyProspect {
  const driverId = uniqueId("academy");
  const name = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
  const age = 17 + Math.floor(Math.random() * 4);
  const potential = clamp(72 + Math.floor(Math.random() * 18), 72, 90);
  const readiness = clamp(30 + Math.floor(Math.random() * 50), 0, 100);
  const peakProfile = buildPeakProfile(driverId, name, potential);
  const profile = initialProfileFromPeak(peakProfile, age);

  return {
    driverId,
    name,
    age,
    nationality: randomItem(NATIONALITIES),
    potential,
    readiness,
    profile,
  };
}

export function seedAcademyProspects(count: number, seasonYear: number): AcademyProspect[] {
  return Array.from({ length: count }, () => generateAcademyProspect(seasonYear));
}

export function promoteProspectToDriver(
  prospect: AcademyProspect,
  teamId: string,
  debutYear: number,
): DriverSeasonInfo {
  const peakProfile = buildPeakProfile(prospect.driverId, prospect.name, prospect.potential);
  const profile = initialProfileFromPeak(peakProfile, prospect.age);

  return {
    driverId: prospect.driverId,
    name: prospect.name,
    teamId,
    debutYear,
    age: prospect.age,
    active: true,
    fromAcademy: true,
    peakProfile,
    profile,
  };
}

export function pickBestProspect(prospects: AcademyProspect[]): AcademyProspect | null {
  if (prospects.length === 0) return null;
  return [...prospects].sort((a, b) => b.readiness - a.readiness || b.potential - a.potential)[0] ?? null;
}
