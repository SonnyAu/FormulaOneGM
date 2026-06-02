import { RaceEntry, TireCompound } from "@/lib/sim/raceweekend/raceTypes";

export type EntryView = {
  driverId: string;
  name: string;
  abbreviation: string;
  carNumber: number;
  isPlayer: boolean;
  teamId: string;
};

export function buildEntryMap(entries: RaceEntry[]): Record<string, EntryView> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.driverId,
      {
        driverId: entry.driverId,
        name: entry.driverName,
        abbreviation: entry.abbreviation,
        carNumber: entry.carNumber,
        isPlayer: entry.isPlayer,
        teamId: entry.teamId,
      },
    ]),
  );
}

export const COMPOUND_LABEL: Record<TireCompound, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};

export function compoundBadgeClass(compound: TireCompound): string {
  switch (compound) {
    case "SOFT":
      return "border-red-500 text-red-300";
    case "MEDIUM":
      return "border-yellow-400 text-yellow-200";
    case "HARD":
      return "border-zinc-300 text-zinc-100";
    case "INTERMEDIATE":
      return "border-green-500 text-green-300";
    case "WET":
      return "border-blue-400 text-blue-200";
    default:
      return "border-zinc-500 text-zinc-200";
  }
}

export function formatGap(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `+${m}:${s.toFixed(1).padStart(4, "0")}`;
  }
  return `+${seconds.toFixed(1)}s`;
}

export function formatLapTime(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function healthColor(health: number): string {
  if (health > 60) return "bg-green-500";
  if (health > 30) return "bg-yellow-400";
  return "bg-red-500";
}
