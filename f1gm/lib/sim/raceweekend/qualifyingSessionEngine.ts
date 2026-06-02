import {
  QualifyingLap,
  QualifyingSegment,
  QualifyingSessionState,
  RaceEntry,
  RngState,
  TrackProfile,
} from "@/lib/sim/raceweekend/raceTypes";
import { computeQualifyingLap, freshTire } from "@/lib/sim/raceweekend/pace";

type SegmentRun = { driverId: string; bestLapSeconds: number };

function runSegment(
  entries: RaceEntry[],
  contenders: string[],
  track: TrackProfile,
  segment: QualifyingSegment,
  evolutionPct: number,
  rng: RngState,
  tireUsage: Map<string, number>,
): SegmentRun[] {
  const byId = new Map(entries.map((entry) => [entry.driverId, entry]));
  const runs: SegmentRun[] = [];

  for (const driverId of contenders) {
    const entry = byId.get(driverId);
    if (!entry) continue;
    const tire = freshTire("SOFT");
    // Two flying laps; keep the best. Track evolution makes later segments slightly quicker.
    let best = Infinity;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = computeQualifyingLap(entry.driver, entry.car, track, tire, rng) * (1 - evolutionPct);
      const adjusted = entry.isPlayer ? raw * (1 - entry.setupBonus) : raw;
      if (adjusted < best) best = adjusted;
      tire.ageLaps += 1;
    }
    tireUsage.set(driverId, (tireUsage.get(driverId) ?? 0) + 3);
    runs.push({ driverId, bestLapSeconds: best });
  }

  void segment;
  return runs.sort((a, b) => a.bestLapSeconds - b.bestLapSeconds);
}

/** Runs a three-part qualifying session and produces the starting grid. */
export function runQualifying(entries: RaceEntry[], track: TrackProfile, rng: RngState): QualifyingSessionState {
  const n = entries.length;
  const q1Keep = Math.max(2, Math.min(15, n - 5));
  const q2Keep = Math.max(2, Math.min(10, q1Keep - 5));

  const tireUsage = new Map<string, number>();
  const results: QualifyingLap[] = [];

  const allIds = entries.map((entry) => entry.driverId);
  const evolutionStep = track.trackEvolution * 0.004;

  const q1 = runSegment(entries, allIds, track, "Q1", evolutionStep, rng, tireUsage);
  q1.forEach((run) => results.push({ ...run, segment: "Q1", tireLapsUsed: tireUsage.get(run.driverId) ?? 0 }));
  const q1Advancers = q1.slice(0, q1Keep).map((run) => run.driverId);
  const q1Eliminated = q1.slice(q1Keep).map((run) => run.driverId);

  const q2 = runSegment(entries, q1Advancers, track, "Q2", evolutionStep * 2, rng, tireUsage);
  q2.forEach((run) => results.push({ ...run, segment: "Q2", tireLapsUsed: tireUsage.get(run.driverId) ?? 0 }));
  const q2Advancers = q2.slice(0, q2Keep).map((run) => run.driverId);
  const q2Eliminated = q2.slice(q2Keep).map((run) => run.driverId);

  const q3 = runSegment(entries, q2Advancers, track, "Q3", evolutionStep * 3, rng, tireUsage);
  q3.forEach((run) => results.push({ ...run, segment: "Q3", tireLapsUsed: tireUsage.get(run.driverId) ?? 0 }));
  const q3Order = q3.map((run) => run.driverId);

  const grid = [...q3Order, ...q2Eliminated, ...q1Eliminated];

  return { segment: "done", results, grid, completed: true };
}
