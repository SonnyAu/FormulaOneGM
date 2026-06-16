import {
  DriverRaceState,
  RaceIssue,
  RaceIssueKind,
  RaceEntry,
  RaceEvent,
  RacePenaltyKind,
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
const MAX_PENALTIES_PER_DRIVER = 2;
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
      activeIssue: null,
      issueCount: 0,
      issueCooldownLaps: 0,
      penaltySeconds: 0,
      penalties: [],
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

function classifiedTime(driver: DriverRaceState): number {
  return driver.totalTimeSeconds + driver.penaltySeconds;
}

function pushEvent(state: RaceSessionState, names: Record<string, string>, event: RaceEvent) {
  state.events.push(event);
  for (const line of eventToCommentary(event, { names, phase: "race" })) {
    state.commentary.push(line);
  }
}

function isReliabilityIssue(kind: RaceIssueKind): boolean {
  return kind === "power-loss" || kind === "cooling" || kind === "gearbox";
}

function reliabilityIssueChance(driver: DriverRaceState, entry: RaceEntry): number {
  const reliabilityRisk = clamp((92 - entry.car.reliability) / 52, 0, 1);
  const coolingRisk = clamp((88 - entry.car.cooling) / 48, 0, 1);
  const tireRisk = clamp((driver.tire.wear - 75) / 40, 0, 1);
  const paceRisk = driver.paceMode === "PUSH" ? 0.0007 : driver.paceMode === "CONSERVE" ? -0.0002 : 0;

  return clamp(
    0.00025 +
      Math.pow(reliabilityRisk, 1.7) * 0.006 +
      Math.pow(coolingRisk, 1.6) * 0.0015 +
      tireRisk * 0.001 +
      paceRisk,
    0,
    0.009,
  );
}

function driverIssueChance(driver: DriverRaceState, entry: RaceEntry, track: TrackProfile): number {
  const consistencyRisk = clamp((90 - entry.driver.consistency) / 50, 0, 1);
  const adaptabilityRisk = clamp((85 - entry.driver.adaptability) / 45, 0, 1);
  const brakingRisk = clamp((85 - entry.driver.braking) / 45, 0, 1);
  const tireRisk = clamp((driver.tire.wear - 70) / 45, 0, 1);
  const paceRisk = driver.paceMode === "PUSH" ? 0.0008 : driver.paceMode === "CONSERVE" ? -0.0003 : 0;

  return clamp(
    Math.pow(consistencyRisk, 1.6) * 0.0045 +
      adaptabilityRisk * 0.001 +
      brakingRisk * track.overtakingDifficulty * 0.0012 +
      tireRisk * 0.001 +
      paceRisk,
    0,
    0.008,
  );
}

function createReliabilityIssue(entry: RaceEntry, rng: RngState, lap: number): RaceIssue {
  const kind = pick<RaceIssueKind>(rng, ["power-loss", "cooling", "gearbox"]);
  const reliabilityDeficit = Math.max(0, 100 - entry.car.reliability);
  const coolingDeficit = Math.max(0, 100 - entry.car.cooling);

  switch (kind) {
    case "cooling":
      return {
        kind,
        lapStarted: lap,
        lapsRemaining: rangeInt(rng, 2, 3),
        timeLossSecondsPerLap: clamp(0.8 + coolingDeficit * 0.025 + Math.abs(gaussian(rng)) * 0.35, 0.8, 2.8),
        tireWearAdded: 0,
        detail: "cooling temperatures are marginal",
      };
    case "gearbox":
      return {
        kind,
        lapStarted: lap,
        lapsRemaining: rangeInt(rng, 1, 2),
        timeLossSecondsPerLap: clamp(1.1 + reliabilityDeficit * 0.028 + Math.abs(gaussian(rng)) * 0.4, 1.1, 3.2),
        tireWearAdded: 0,
        detail: "gearbox sync is costing time",
      };
    case "power-loss":
    default:
      return {
        kind,
        lapStarted: lap,
        lapsRemaining: rangeInt(rng, 1, 3),
        timeLossSecondsPerLap: clamp(1.0 + reliabilityDeficit * 0.03 + Math.abs(gaussian(rng)) * 0.45, 1.0, 3.4),
        tireWearAdded: 0,
        detail: "intermittent power loss",
      };
  }
}

function createDriverIssue(entry: RaceEntry, rng: RngState, lap: number): RaceIssue {
  const kind = pick<RaceIssueKind>(rng, ["lock-up", "wide-moment"]);
  const consistencyDeficit = Math.max(0, 100 - entry.driver.consistency);

  if (kind === "lock-up") {
    return {
      kind,
      lapStarted: lap,
      lapsRemaining: 1,
      timeLossSecondsPerLap: clamp(0.9 + consistencyDeficit * 0.018 + Math.abs(gaussian(rng)) * 0.55, 0.9, 3.0),
      tireWearAdded: clamp(2.5 + consistencyDeficit * 0.06 + Math.abs(gaussian(rng)) * 1.2, 2.5, 8),
      detail: "a lock-up under braking",
    };
  }

  return {
    kind,
    lapStarted: lap,
    lapsRemaining: 1,
    timeLossSecondsPerLap: clamp(0.7 + consistencyDeficit * 0.015 + Math.abs(gaussian(rng)) * 0.45, 0.7, 2.5),
    tireWearAdded: clamp(1.2 + consistencyDeficit * 0.035 + Math.abs(gaussian(rng)) * 0.8, 1.2, 5),
    detail: "running wide over the exit kerb",
  };
}

function maybeCreateRaceIssue(
  driver: DriverRaceState,
  entry: RaceEntry,
  track: TrackProfile,
  rng: RngState,
  lap: number,
): RaceIssue | null {
  if (chance(rng, reliabilityIssueChance(driver, entry))) {
    return createReliabilityIssue(entry, rng, lap);
  }

  if (chance(rng, driverIssueChance(driver, entry, track))) {
    return createDriverIssue(entry, rng, lap);
  }

  return null;
}

function addTireWear(tire: DriverRaceState["tire"], added: number): DriverRaceState["tire"] {
  const wear = Math.min(140, tire.wear + added);
  return {
    ...tire,
    wear,
    health: Math.max(0, 100 - wear),
  };
}

function penaltySeconds(rng: RngState): number {
  return chance(rng, 0.12) ? 10 : 5;
}

function applyPenalty(
  state: RaceSessionState,
  names: Record<string, string>,
  driver: DriverRaceState,
  kind: RacePenaltyKind,
  lap: number,
  seconds: number,
  detail: string,
) {
  if (driver.penalties.length >= MAX_PENALTIES_PER_DRIVER) return;
  driver.penalties.push({ kind, lap, seconds, detail });
  driver.penaltySeconds += seconds;
  pushEvent(state, names, {
    type: "penalty",
    lap,
    driverId: driver.driverId,
    penaltyKind: kind,
    penaltySeconds: seconds,
    detail,
  });
}

function maybeApplyIssuePenalty(
  state: RaceSessionState,
  names: Record<string, string>,
  driver: DriverRaceState,
  entry: RaceEntry,
  track: TrackProfile,
  rng: RngState,
  lap: number,
  issue: RaceIssue,
) {
  if (driver.penalties.length >= MAX_PENALTIES_PER_DRIVER || isReliabilityIssue(issue.kind)) return;

  const consistencyRisk = clamp((88 - entry.driver.consistency) / 48, 0, 1);
  const base = issue.kind === "wide-moment" ? 0.26 : 0.14;
  const probability = clamp(base + consistencyRisk * 0.12 + track.overtakingDifficulty * 0.04, 0, 0.52);
  if (!chance(rng, probability)) return;

  applyPenalty(state, names, driver, "track-limits", lap, penaltySeconds(rng), "track limits infringement");
}

function maybeApplyStandalonePenalty(
  state: RaceSessionState,
  names: Record<string, string>,
  driver: DriverRaceState,
  entry: RaceEntry,
  track: TrackProfile,
  rng: RngState,
  lap: number,
) {
  if (driver.penalties.length >= MAX_PENALTIES_PER_DRIVER) return;

  const consistencyRisk = clamp((90 - entry.driver.consistency) / 50, 0, 1);
  const brakingRisk = clamp((85 - entry.driver.braking) / 45, 0, 1);
  const tireRisk = clamp((driver.tire.wear - 85) / 35, 0, 1);
  const closeRacing = driver.gapToAheadSeconds > 0 && driver.gapToAheadSeconds <= 1.2;
  const probability = clamp(
    Math.pow(consistencyRisk, 1.8) * 0.0016 +
      brakingRisk * track.overtakingDifficulty * 0.0007 +
      tireRisk * 0.0005 +
      (driver.paceMode === "PUSH" ? 0.0004 : 0) +
      (closeRacing ? 0.0004 : 0),
    0,
    0.006,
  );

  if (!chance(rng, probability)) return;

  const kind: RacePenaltyKind = closeRacing && chance(rng, 0.35) ? "unsafe-defending" : "track-limits";
  const detail = kind === "unsafe-defending" ? "forcing another car off line" : "repeated track limits";
  applyPenalty(state, names, driver, kind, lap, penaltySeconds(rng), detail);
}

function maybeApplyPitPenalty(
  state: RaceSessionState,
  names: Record<string, string>,
  driver: DriverRaceState,
  entry: RaceEntry,
  rng: RngState,
  lap: number,
) {
  if (driver.penalties.length >= MAX_PENALTIES_PER_DRIVER) return;

  const pitCrewRisk = clamp((90 - entry.car.pitCrew) / 50, 0, 1);
  const consistencyRisk = clamp((88 - entry.driver.consistency) / 48, 0, 1);
  const probability = clamp(pitCrewRisk * 0.004 + consistencyRisk * 0.003, 0, 0.012);
  if (!chance(rng, probability)) return;

  applyPenalty(state, names, driver, "pit-lane-speeding", lap, penaltySeconds(rng), "pit lane speeding");
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
    let issueWearAdded = 0;

    if (!driver.activeIssue && driver.issueCooldownLaps > 0) {
      driver.issueCooldownLaps -= 1;
    }

    if (!state.safetyCar.active && lap > 1 && !driver.activeIssue && driver.issueCooldownLaps <= 0) {
      const issue = maybeCreateRaceIssue(driver, entry, track, rng, lap);
      if (issue) {
        driver.activeIssue = issue;
        driver.issueCount += 1;
        pushEvent(state, names, { type: "race-issue", lap, driverId: driver.driverId, issueKind: issue.kind, detail: issue.detail });
        maybeApplyIssuePenalty(state, names, driver, entry, track, rng, lap, issue);
      } else {
        maybeApplyStandalonePenalty(state, names, driver, entry, track, rng, lap);
      }
    }

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
      maybeApplyPitPenalty(state, names, driver, entry, rng, lap);
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

    if (driver.activeIssue) {
      lapTime += driver.activeIssue.timeLossSecondsPerLap;
      issueWearAdded = driver.activeIssue.tireWearAdded;
    }

    if (pitted) {
      const pitEvent = state.pitEvents[state.pitEvents.length - 1];
      lapTime += pitEvent.totalLossSeconds;
    }

    if (issueWearAdded > 0) {
      driver.tire = addTireWear(driver.tire, issueWearAdded);
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

    if (driver.activeIssue) {
      const issue = { ...driver.activeIssue, lapsRemaining: driver.activeIssue.lapsRemaining - 1 };
      if (issue.lapsRemaining <= 0) {
        pushEvent(state, names, { type: "issue-resolved", lap, driverId: driver.driverId, issueKind: issue.kind, detail: issue.detail });
        driver.activeIssue = null;
        driver.issueCooldownLaps = rangeInt(rng, 4, 7);
      } else {
        driver.activeIssue = issue;
      }
    }

    // Reliability-based retirement.
    const activeReliabilityIssue = driver.activeIssue ? isReliabilityIssue(driver.activeIssue.kind) : false;
    const issueDnfBonus = activeReliabilityIssue ? clamp((85 - entry.car.reliability) / 35000, 0, 0.002) : 0;
    const dnfPerLap = Math.max(0.0003, (105 - entry.car.reliability) / 12000) + issueDnfBonus;
    if (lap > 1 && chance(rng, dnfPerLap)) {
      driver.dnf = true;
      driver.dnfReason = pick(rng, DNF_REASONS);
      driver.activeIssue = null;
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
    return classifiedTime(a) - classifiedTime(b);
  });

  const leader = sorted.find((d) => !d.dnf);
  sorted.forEach((driver, index) => {
    driver.position = index + 1;
    if (driver.dnf) {
      driver.gapToLeaderSeconds = 0;
      driver.gapToAheadSeconds = 0;
      return;
    }
    driver.gapToLeaderSeconds = leader ? classifiedTime(driver) - classifiedTime(leader) : 0;
    const ahead = sorted[index - 1];
    driver.gapToAheadSeconds = ahead && !ahead.dnf ? classifiedTime(driver) - classifiedTime(ahead) : 0;
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
