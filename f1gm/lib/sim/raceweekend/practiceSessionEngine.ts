import {
  PracticeRunResult,
  PracticeSessionState,
  RaceEntry,
  RngState,
  TrackProfile,
} from "@/lib/sim/raceweekend/raceTypes";
import { computeQualifyingLap, freshTire } from "@/lib/sim/raceweekend/pace";
import { range } from "@/lib/sim/raceweekend/rng";

const PRACTICE_LAPS = 12;

/**
 * Lighter, semi-simulated practice: every driver completes a representative run and
 * the player earns a small setup bonus from a productive program. Mutates `entries`
 * to assign the player's setup bonus so qualifying/race can use it.
 */
export function runPractice(entries: RaceEntry[], track: TrackProfile, rng: RngState): PracticeSessionState {
  const runs: PracticeRunResult[] = entries.map((entry) => {
    const tire = freshTire("MEDIUM");
    // Best of a handful of laps as the representative time.
    let best = Infinity;
    for (let lap = 0; lap < 4; lap += 1) {
      const time = computeQualifyingLap(entry.driver, entry.car, track, tire, rng);
      if (time < best) best = time;
    }
    return { driverId: entry.driverId, bestLapSeconds: best, laps: PRACTICE_LAPS, compound: "MEDIUM" };
  });

  // Player setup work: a productive program yields up to ~0.3% lap-time gain.
  let playerSetupBonus = 0;
  const player = entries.find((entry) => entry.isPlayer);
  if (player) {
    const quality = range(rng, 0.4, 1) * (0.6 + player.driver.adaptability / 250);
    playerSetupBonus = Math.min(0.003, quality * 0.003);
    player.setupBonus = playerSetupBonus;
  }

  return { completed: true, runs, playerSetupBonus };
}
