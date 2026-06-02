/**
 * Headless race-weekend demo. Run with:  npx tsx scripts/race-demo.ts [trackId] [seed]
 * Exercises the engine end-to-end and prints commentary + results for a few circuits.
 */
import { logRaceWeekend, runRaceWeekendDemo } from "@/lib/sim/raceweekend/demo";

const argTrack = process.argv[2];
const argSeed = process.argv[3] ? Number(process.argv[3]) : undefined;

const tracks = argTrack ? [argTrack] : ["monaco", "monza", "bahrain", "suzuka", "silverstone"];

tracks.forEach((trackId, index) => {
  const weekend = runRaceWeekendDemo(trackId, argSeed ?? 1000 + index * 7);
  logRaceWeekend(weekend);
});
