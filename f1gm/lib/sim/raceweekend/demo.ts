import { teams as teamData } from "@/data/teams";
import { driverMap } from "@/data/drivers";
import { getDriverProfile } from "@/data/driverProfiles";
import { getCarProfile } from "@/data/carProfiles";
import { RaceEntry, RaceWeekendState, StrategyPersonality } from "@/lib/sim/raceweekend/raceTypes";
import { advancePhase, autoFinishRace, createRaceWeekend } from "@/lib/sim/raceweekend/raceWeekendEngine";
import { computePackageStrength } from "@/lib/sim/raceweekend/trackProfiles";

const PERSONALITIES: StrategyPersonality[] = ["AGGRESSIVE", "BALANCED", "CONSERVATIVE", "GAMBLER"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Build a full grid of entries straight from the static data (no season required). */
export function buildDemoEntries(playerTeamId = "ferrari"): RaceEntry[] {
  const entries: RaceEntry[] = [];
  teamData.forEach((team, teamIndex) => {
    const car = getCarProfile(team.id);
    const personality = PERSONALITIES[teamIndex % PERSONALITIES.length];
    team.driverIds.forEach((driverId) => {
      const info = driverMap.get(driverId);
      const driver = getDriverProfile(driverId, info?.name ?? driverId, 75);
      const skill = clamp((computePackageStrength(car.overall, driver.overall) - 58) / 40, 0.2, 1);
      entries.push({
        driverId,
        teamId: team.id,
        driverName: driver.name,
        abbreviation: team.abbreviation,
        carNumber: info?.number ?? 0,
        isPlayer: team.id === playerTeamId,
        personality,
        skill,
        setupBonus: 0,
        driver,
        car,
      });
    });
  });
  return entries;
}

/** Run an entire race weekend headlessly (AI drives everyone, including the "player"). */
export function runRaceWeekendDemo(trackId = "bahrain", seed = 12345): RaceWeekendState {
  const entries = buildDemoEntries();
  let weekend = createRaceWeekend({
    id: `demo-${trackId}-${seed}`,
    seasonYear: 2026,
    round: 1,
    raceName: trackId,
    trackId,
    playerTeamId: "ferrari",
    entries,
    seed,
  });

  weekend = advancePhase(weekend); // practice -> qualifying
  weekend = advancePhase(weekend); // qualifying -> race
  weekend = autoFinishRace(weekend);
  return weekend;
}

/** Convenience logger used by scripts/race-demo.ts. */
export function logRaceWeekend(weekend: RaceWeekendState): void {
  const names: Record<string, string> = Object.fromEntries(weekend.entries.map((e) => [e.driverId, e.driverName]));

  console.log(`\n=== ${weekend.track.circuitName} (${weekend.track.laps} laps) ===`);

  console.log("\n-- Starting grid (top 5) --");
  weekend.grid.slice(0, 5).forEach((id, i) => console.log(`  ${i + 1}. ${names[id] ?? id}`));

  console.log("\n-- Commentary --");
  for (const message of weekend.race?.commentary ?? []) {
    if (message.importance !== "low") console.log(`  ${message.text}`);
  }

  console.log("\n-- Final classification --");
  for (const row of weekend.result?.classification ?? []) {
    const pos = row.dnf ? "DNF" : `P${row.position}`;
    const fl = row.hasFastestLap ? " [FL]" : "";
    const penalty = row.penaltySeconds > 0 ? ` +${row.penaltySeconds}s pen` : "";
    const issues = row.issueCount > 0 ? ` ${row.issueCount} issue${row.issueCount === 1 ? "" : "s"}` : "";
    console.log(`  ${pos.padEnd(4)} ${(names[row.driverId] ?? row.driverId).padEnd(22)} ${row.points} pts${fl}${penalty}${issues}`);
  }
}
