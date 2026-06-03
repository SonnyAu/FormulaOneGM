import {
  DriverRaceState,
  RaceEntry,
  RaceEvent,
  RaceSessionState,
  TireCompound,
  TrackProfile,
} from "@/lib/sim/raceweekend/raceTypes";
import { RngState } from "@/lib/sim/raceweekend/raceTypes";
import { ageTire, computeLapTime, freshTire } from "@/lib/sim/raceweekend/pace";
import { chance, gaussian, pick, rangeInt } from "@/lib/sim/raceweekend/rng";
import { evaluateStrategy } from "@/lib/sim/raceweekend/strategyAI";
import { eventToCommentary } from "@/lib/sim/raceweekend/commentaryEngine";

export type RaceAdvanceOptions = {
  engineerForPlayer?: boolean;
};

const SAFETY_CAR_LAP_PENALTY = 1.45;
const DRS_RANGE_SECONDS = 1.0;
const INCIDENT_LOCATIONS = [
  "an incident at Turn 1",
  "contact at the hairpin",
  "a stoppage at Turn 7",
  "debris on the main straight",
  "a spin at the final corner",
];
const DNF_REASONS = ["a power unit failure", "a hydraulics issue", "gearbox trouble", "a brake failure", "an accident"];

function startingCompound(entry: RaceEntry): TireCompound {
  return entry.personality === "AGGRESSIVE" || entry.personality === "GAMBLER" ? "SOFT" : "MEDIUM";
}

/** Build the initial race state from the qualifying grid. */
export function initializeRaceState(entries: RaceEntry[], grid: string[], track: TrackProfile): RaceSessionState {
  const byId = new Map(entries.map((entry) => [entry.driverId, entry]));
  const order = grid.length === entries.length ? grid : entries.map((entry) => entry.driverId);

  const drivers: DriverRaceState[] = order.map((driverId, index) => {
    const entry = byId.get(driverId)!;
    const gridPosition = index + 1;
    return {
      driverId,
      teamId: entry.teamId,
      position: gridPosition,
      gridPosition,
      tire: freshTire(startingCompound(entry)),
      paceMode: "BALANCED",
      lapsCompleted: 0,
      // Grid spacing so positions are well-defined before any laps run.
      totalTimeSeconds: index * 0.35,
      lastLapSeconds: 0,
      bestLapSeconds: 0,
      gapToLeaderSeconds: index * 0.35,
      gapToAheadSeconds: index === 0 ? 0 : 0.35,
      pitStops: 0,
      pitLapsRemaining: 0,
      inPit: false,
      pendingPitCompound: null,
      dnf: false,
      dnfReason: null,
      hasFastestLap: false,
    };
  });

  return {
    totalLaps: track.laps,
    currentLap: 0,
    drivers,
    safetyCar: { active: false, lapsRemaining: 0, deployedLap: null },
    pitEvents: [],
    events: [],
    commentary: [],
    fastestLap: null,
    finished: false,
  };
}

function namesFromEntries(entries: RaceEntry[]): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [entry.driverId, entry.driverName]));
}

function pushEvent(state: RaceSessionState, names: Record<string, string>, event: RaceEvent) {
  state.events.push(event);
  for (const line of eventToCommentary(event, { names, phase: "race" })) {
    state.commentary.push(line);
  }
}

function lastPitLap(state: RaceSessionState, driverId: string): number {
  let last = -99;
  for (const pit of state.pitEvents) {
    if (pit.driverId === driverId && pit.lap > last) last = pit.lap;
  }
  return last;
}

/**
 * Advance the race by exactly one lap. Mutates `state` in place (callers pass a clone),
 * threading the supplied serializable rng. Player decisions must already be applied to
 * driver.pendingPitCompound / driver.paceMode before calling.
 */
export function advanceRaceLap(
  state: RaceSessionState,
  entries: RaceEntry[],
  track: TrackProfile,
  rng: RngState,
  options: RaceAdvanceOptions = {},
): void {
  if (state.finished) return;

  const byId = new Map(entries.map((entry) => [entry.driverId, entry]));
  const names = namesFromEntries(entries);
  const lap = state.currentLap + 1;
  state.currentLap = lap;

  if (lap === 1) {
    pushEvent(state, names, { type: "race-start", lap });
  }

  // --- Safety car lifecycle ---
  if (state.safetyCar.active) {
    state.safetyCar.lapsRemaining -= 1;
    if (state.safetyCar.lapsRemaining <= 0) {
      state.safetyCar.active = false;
      pushEvent(state, names, { type: "safety-car-end", lap });
    }
  } else if (lap > 1 && lap < state.totalLaps - 2 && chance(rng, track.safetyCarChance * 0.02)) {
    state.safetyCar.active = true;
    state.safetyCar.lapsRemaining = rangeInt(rng, 3, 4);
    state.safetyCar.deployedLap = lap;
    pushEvent(state, names, { type: "safety-car", lap, detail: pick(rng, INCIDENT_LOCATIONS) });
    compressFieldUnderSafetyCar(state);
  }

  // --- AI strategy decisions ---
  for (const driver of state.drivers) {
    const entry = byId.get(driver.driverId);
    if (!entry || driver.dnf || (entry.isPlayer && !options.engineerForPlayer)) continue;
    const result = evaluateStrategy({ state, driver, entry, track, rng });
    if (!result) continue;
    if (result.pit && result.nextCompound) driver.pendingPitCompound = result.nextCompound;
    if (result.paceMode) driver.paceMode = result.paceMode;
  }

  // Snapshot pre-lap order/gaps for event detection.
  const prevPositions = new Map(state.drivers.map((d) => [d.driverId, d.position]));
  const prevGapAhead = new Map(state.drivers.map((d) => [d.driverId, d.gapToAheadSeconds]));
  const prevLeader = [...state.drivers].sort((a, b) => a.position - b.position).find((d) => !d.dnf)?.driverId;

  // --- Per-driver lap resolution ---
  const pittedThisLap = new Set<string>();
  for (const driver of state.drivers) {
    if (driver.dnf) continue;
    const entry = byId.get(driver.driverId);
    if (!entry) continue;

    let lapTime: number;
    let pitted = false;

    const canPit = driver.pendingPitCompound !== null && driver.tire.ageLaps >= 1;
    if (canPit) {
      pitted = true;
      pittedThisLap.add(driver.driverId);
      const fromCompound = driver.tire.compound;
      const toCompound = driver.pendingPitCompound as TireCompound;
      const stopTime = clamp(2.0 + (95 - entry.car.pitCrew) * 0.03 + gaussian(rng) * 0.2, 1.8, 4.8);
      const totalLoss = track.pitLossSeconds + stopTime;
      driver.tire = freshTire(toCompound);
      driver.pitStops += 1;
      driver.pendingPitCompound = null;
      state.pitEvents.push({ lap, driverId: driver.driverId, fromCompound, toCompound, stopTimeSeconds: stopTime, totalLossSeconds: totalLoss });
      pushEvent(state, names, { type: "pit", lap, driverId: driver.driverId, compound: toCompound, stopTimeSeconds: stopTime });
    }

    const prevWear = driver.tire.wear;

    if (state.safetyCar.active) {
      lapTime = track.baseLapTimeSeconds * SAFETY_CAR_LAP_PENALTY;
      // Minimal wear behind the safety car.
      if (!pitted) {
        driver.tire = { ...driver.tire, ageLaps: driver.tire.ageLaps + 1, wear: Math.min(140, driver.tire.wear + 0.3), health: Math.max(0, 100 - Math.min(140, driver.tire.wear + 0.3)) };
      }
    } else {
      lapTime = computeLapTime({
        driver: entry.driver,
        car: entry.car,
        track,
        tire: driver.tire,
        paceMode: driver.paceMode,
        lapsRemaining: state.totalLaps - driver.lapsCompleted,
        totalLaps: state.totalLaps,
        setupBonus: entry.isPlayer ? entry.setupBonus : 0,
        rng,
      });
      if (!pitted) {
        driver.tire = ageTire(driver.tire, track, entry.car, driver.paceMode);
      }
    }

    if (pitted) {
      const pitEvent = state.pitEvents[state.pitEvents.length - 1];
      lapTime += pitEvent.totalLossSeconds;
    }

    driver.totalTimeSeconds += lapTime;
    driver.lapsCompleted += 1;
    driver.lastLapSeconds = lapTime;
    if (driver.bestLapSeconds === 0 || lapTime < driver.bestLapSeconds) driver.bestLapSeconds = lapTime;

    // Tire fading: just crossed the wear cliff and not pitting.
    if (!pitted && !state.safetyCar.active && prevWear <= 80 && driver.tire.wear > 80) {
      pushEvent(state, names, { type: "tire-fading", lap, driverId: driver.driverId });
    }

    // Fastest lap (ignore in/out laps and safety car laps).
    if (!pitted && !state.safetyCar.active && lap > 1) {
      if (!state.fastestLap || lapTime < state.fastestLap.timeSeconds) {
        if (state.fastestLap) {
          const prev = state.drivers.find((d) => d.driverId === state.fastestLap!.driverId);
          if (prev) prev.hasFastestLap = false;
        }
        state.fastestLap = { driverId: driver.driverId, timeSeconds: lapTime, lap };
        driver.hasFastestLap = true;
        pushEvent(state, names, { type: "fastest-lap", lap, driverId: driver.driverId, timeSeconds: lapTime });
      }
    }

    // Reliability-based retirement.
    const dnfPerLap = Math.max(0.0003, (105 - entry.car.reliability) / 12000);
    if (lap > 1 && chance(rng, dnfPerLap)) {
      driver.dnf = true;
      driver.dnfReason = pick(rng, DNF_REASONS);
      pushEvent(state, names, { type: "dnf", lap, driverId: driver.driverId, detail: driver.dnfReason });
    }
  }

  // --- Track position: gate passes by track difficulty, pace delta, DRS and skill ---
  resolveTrackPosition(state, byId, names, track, rng, lap, prevPositions, prevGapAhead, pittedThisLap);

  // --- Recompute classification, gaps, and pit-cycle events ---
  recomputePositions(state);
  detectPitCycleEvents(state, names, prevPositions, prevLeader, lap);

  // --- End of race ---
  if (lap >= state.totalLaps) {
    state.finished = true;
    const winner = state.drivers.find((d) => d.position === 1);
    if (winner) pushEvent(state, names, { type: "race-end", lap, driverId: winner.driverId });
  }
}

function recomputePositions(state: RaceSessionState) {
  const sorted = [...state.drivers].sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
    if (b.lapsCompleted !== a.lapsCompleted) return b.lapsCompleted - a.lapsCompleted;
    return a.totalTimeSeconds - b.totalTimeSeconds;
  });

  const leader = sorted.find((d) => !d.dnf);
  sorted.forEach((driver, index) => {
    driver.position = index + 1;
    if (driver.dnf) {
      driver.gapToLeaderSeconds = 0;
      driver.gapToAheadSeconds = 0;
      return;
    }
    driver.gapToLeaderSeconds = leader ? driver.totalTimeSeconds - leader.totalTimeSeconds : 0;
    const ahead = sorted[index - 1];
    driver.gapToAheadSeconds = ahead && !ahead.dnf ? driver.totalTimeSeconds - ahead.totalTimeSeconds : 0;
  });
}

/**
 * Enforce track position: a car can only move ahead of the car in front by winning an
 * overtake roll (gated by track overtaking difficulty, pace delta, DRS and driver skill).
 * Failed attempts leave the car stuck in dirty air, losing the time it would have gained.
 * Pit-cycle position swaps are left untouched (handled as undercut/overcut elsewhere).
 */
function resolveTrackPosition(
  state: RaceSessionState,
  byId: Map<string, RaceEntry>,
  names: Record<string, string>,
  track: TrackProfile,
  rng: RngState,
  lap: number,
  prevPositions: Map<string, number>,
  prevGapAhead: Map<string, number>,
  pittedThisLap: Set<string>,
) {
  if (state.safetyCar.active) return;

  const order = state.drivers
    .filter((d) => !d.dnf)
    .sort((a, b) => (prevPositions.get(a.driverId) ?? 99) - (prevPositions.get(b.driverId) ?? 99));

  for (let i = 1; i < order.length; i += 1) {
    const leader = order[i - 1];
    const car = order[i];
    if (pittedThisLap.has(car.driverId) || pittedThisLap.has(leader.driverId)) continue;

    const prevGap = prevGapAhead.get(car.driverId) ?? 99;
    const withinDrs = prevGap > 0 && prevGap <= DRS_RANGE_SECONDS;

    if (car.totalTimeSeconds < leader.totalTimeSeconds) {
      const carEntry = byId.get(car.driverId);
      const leaderEntry = byId.get(leader.driverId);
      const paceDelta = leader.lastLapSeconds - car.lastLapSeconds; // > 0 => challenger quicker

      // Difficulty dominates: openness^1.6 keeps street/high-downforce tracks genuinely hard to pass,
      // so a faster car can sit stuck in dirty air for a long stint (track position matters).
      const openness = Math.pow(Math.max(0.02, 1 - track.overtakingDifficulty), 1.6);
      let factor = 0.5 + clamp(paceDelta * 0.6, 0, 0.8) + (withinDrs ? 0.4 : 0);
      if (carEntry && leaderEntry) factor += (carEntry.driver.overtaking - leaderEntry.driver.defending) / 200;
      const prob = clamp(openness * factor, 0, 0.92);

      if (chance(rng, prob)) {
        // Pass sticks. The front of the field is reported as a lead change instead.
        if ((prevPositions.get(leader.driverId) ?? 99) !== 1) {
          pushEvent(state, names, { type: "overtake", lap, driverId: car.driverId, rivalId: leader.driverId });
        }
      } else {
        // Held up in dirty air, just behind the car ahead.
        car.totalTimeSeconds = leader.totalTimeSeconds + 0.3;
        if (withinDrs && track.overtakingDifficulty < 0.9 && chance(rng, 0.25)) {
          pushEvent(state, names, { type: "drs-range", lap, driverId: car.driverId, rivalId: leader.driverId });
        }
      }
    } else if (withinDrs && track.overtakingDifficulty < 0.9 && chance(rng, 0.2)) {
      pushEvent(state, names, { type: "drs-range", lap, driverId: car.driverId, rivalId: leader.driverId });
    }
  }
}

/** Lead changes and pit-cycle jumps (undercut/overcut) detected from position movement. */
function detectPitCycleEvents(
  state: RaceSessionState,
  names: Record<string, string>,
  prevPositions: Map<string, number>,
  prevLeader: string | undefined,
  lap: number,
) {
  const leader = state.drivers.find((d) => d.position === 1 && !d.dnf);
  if (leader && prevLeader && leader.driverId !== prevLeader) {
    pushEvent(state, names, { type: "lead-change", lap, driverId: leader.driverId });
  }

  for (const driver of state.drivers) {
    if (driver.dnf) continue;
    const prevPos = prevPositions.get(driver.driverId) ?? driver.position;
    if (driver.position !== prevPos - 1) continue;

    const passed = state.drivers.find((d) => prevPositions.get(d.driverId) === driver.position && d.driverId !== driver.driverId);
    if (!passed || passed.dnf) continue;

    const driverPitJustNow = lastPitLap(state, driver.driverId) === lap;
    const passedPitRecently = lap - lastPitLap(state, passed.driverId) <= 2;
    if ((driverPitJustNow || passedPitRecently) && lap - lastPitLap(state, driver.driverId) <= 3) {
      pushEvent(state, names, { type: "undercut", lap, driverId: driver.driverId, rivalId: passed.driverId });
    }
  }
}

/** Bunch the field up to ~2.2s spacing when the safety car is deployed. */
function compressFieldUnderSafetyCar(state: RaceSessionState) {
  const running = [...state.drivers].filter((d) => !d.dnf).sort((a, b) => a.position - b.position);
  const leaderTime = running[0]?.totalTimeSeconds ?? 0;
  running.forEach((driver, index) => {
    driver.totalTimeSeconds = leaderTime + index * 2.2;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Advance multiple laps at once (used for fast-forward / auto-play). */
export function advanceRaceLaps(
  state: RaceSessionState,
  entries: RaceEntry[],
  track: TrackProfile,
  rng: RngState,
  laps: number,
  options: RaceAdvanceOptions = {},
): void {
  for (let i = 0; i < laps && !state.finished; i += 1) {
    advanceRaceLap(state, entries, track, rng, options);
  }
}
