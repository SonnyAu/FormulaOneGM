import { CarProfile } from "@/lib/sim/raceweekend/raceTypes";

// Hand-authored car ratings (1-100) used by the race weekend engine.

export const carProfiles: Record<string, CarProfile> = {
  mclaren: { teamId: "mclaren", overall: 95, topSpeed: 88, downforce: 95, mechanicalGrip: 93, tireWear: 92, reliability: 90, cooling: 88, pitCrew: 90 },
  "red-bull": { teamId: "red-bull", overall: 93, topSpeed: 90, downforce: 92, mechanicalGrip: 90, tireWear: 88, reliability: 89, cooling: 87, pitCrew: 95 },
  ferrari: { teamId: "ferrari", overall: 91, topSpeed: 91, downforce: 88, mechanicalGrip: 88, tireWear: 84, reliability: 86, cooling: 85, pitCrew: 86 },
  mercedes: { teamId: "mercedes", overall: 90, topSpeed: 89, downforce: 88, mechanicalGrip: 87, tireWear: 86, reliability: 89, cooling: 88, pitCrew: 88 },
  "aston-martin": { teamId: "aston-martin", overall: 84, topSpeed: 84, downforce: 85, mechanicalGrip: 84, tireWear: 83, reliability: 85, cooling: 84, pitCrew: 84 },
  williams: { teamId: "williams", overall: 84, topSpeed: 87, downforce: 82, mechanicalGrip: 83, tireWear: 82, reliability: 84, cooling: 83, pitCrew: 83 },
  "racing-bulls": { teamId: "racing-bulls", overall: 82, topSpeed: 84, downforce: 82, mechanicalGrip: 82, tireWear: 82, reliability: 84, cooling: 83, pitCrew: 84 },
  alpine: { teamId: "alpine", overall: 80, topSpeed: 82, downforce: 80, mechanicalGrip: 80, tireWear: 80, reliability: 80, cooling: 80, pitCrew: 81 },
  haas: { teamId: "haas", overall: 80, topSpeed: 83, downforce: 80, mechanicalGrip: 79, tireWear: 79, reliability: 82, cooling: 81, pitCrew: 80 },
  audi: { teamId: "audi", overall: 79, topSpeed: 81, downforce: 80, mechanicalGrip: 79, tireWear: 79, reliability: 80, cooling: 80, pitCrew: 80 },
  cadillac: { teamId: "cadillac", overall: 76, topSpeed: 80, downforce: 76, mechanicalGrip: 76, tireWear: 77, reliability: 78, cooling: 79, pitCrew: 78 },
};

export type CarStatsLike = {
  pace: number;
  efficiency: number;
  reliability: number;
};

/** Returns a car profile, deriving from live season car stats for unknown teams (e.g. custom player team). */
export function getCarProfile(teamId: string, carStats?: CarStatsLike): CarProfile {
  const existing = carProfiles[teamId];
  if (existing) return existing;

  const pace = carStats?.pace ?? 65;
  const efficiency = carStats?.efficiency ?? 60;
  const reliability = carStats?.reliability ?? 70;
  const overall = Math.round(pace * 0.6 + efficiency * 0.2 + reliability * 0.2);

  return {
    teamId,
    overall,
    topSpeed: Math.round(pace * 0.5 + efficiency * 0.5),
    downforce: Math.round(pace * 0.7 + efficiency * 0.3),
    mechanicalGrip: Math.round(pace * 0.6 + efficiency * 0.4),
    tireWear: Math.round(efficiency * 0.7 + pace * 0.3),
    reliability,
    cooling: Math.round(reliability * 0.6 + efficiency * 0.4),
    pitCrew: Math.round(overall * 0.9),
  };
}
