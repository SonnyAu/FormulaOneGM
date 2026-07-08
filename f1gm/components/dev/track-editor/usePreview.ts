"use client";

// Demo animation mode: fake cars driven around the racing line to prove the
// exported asset data works (lap progress, rotation, pit stops, crossover
// layering). This is intentionally not a race engine — just kinematics.
//
// The hook only advances lapProgress; positioning, rotation, and crossover
// layering happen inside the game-facing TrackMap renderer, exactly as they
// will in the real race UI.

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrackMetadata, TrackPathKind } from "@/lib/tracks/trackMetadata";
import { hasDrawnPitLane } from "@/lib/tracks/trackMetadata";
import { isDistanceInRange, wrapDistance } from "@/lib/tracks/trackMath";

type PitPhase = "none" | "toPitEntry" | "inPitLane" | "atBox" | "exiting";

type PreviewCarState = {
  id: string;
  /** Normalized progress along the *current* path. */
  lapProgress: number;
  path: TrackPathKind;
  color: string;
  pitPhase: PitPhase;
  boxTimerSeconds: number;
};

export type PreviewCarVM = {
  id: string;
  lapProgress: number;
  path: TrackPathKind;
  color: string;
  pitPhase: PitPhase;
};

const CAR_COLORS = ["#22d3ee", "#f87171", "#4ade80", "#fbbf24", "#c084fc", "#fb923c"];
/** Full lap duration in seconds at preview speed 1x. */
const LAP_SECONDS = 9;
/** Time spent traversing the whole pit lane path (excluding the box stop). */
const PIT_LANE_SECONDS = 5;
const BOX_STOP_SECONDS = 2.5;

export function usePreview(metadata: TrackMetadata, active: boolean) {
  const carsRef = useRef<PreviewCarState[]>([]);
  const [carVMs, setCarVMs] = useState<PreviewCarVM[]>([]);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);

  // Mirror the latest props/state into refs so the rAF loop always reads
  // fresh values without re-subscribing every frame.
  const metadataRef = useRef(metadata);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  useEffect(() => {
    metadataRef.current = metadata;
    runningRef.current = running;
    speedRef.current = speed;
  }, [metadata, running, speed]);

  const publishCars = useCallback(() => {
    setCarVMs(
      carsRef.current.map((car) => ({
        id: car.id,
        lapProgress: car.lapProgress,
        path: car.path,
        color: car.color,
        pitPhase: car.pitPhase,
      })),
    );
  }, []);

  // --- Animation loop ---
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (runningRef.current) {
        const meta = metadataRef.current;
        const pit = meta.pit;
        const pitLaneAvailable = hasDrawnPitLane(meta);
        const lapStep = (dt / LAP_SECONDS) * speedRef.current;
        const pitStep = (dt / PIT_LANE_SECONDS) * speedRef.current;

        for (const car of carsRef.current) {
          switch (car.pitPhase) {
            case "none":
            case "toPitEntry": {
              const next = wrapDistance(car.lapProgress + lapStep);
              // A pitting car switches paths the moment it crosses pit entry.
              if (
                car.pitPhase === "toPitEntry" &&
                pit &&
                pitLaneAvailable &&
                isDistanceInRange(pit.entry, car.lapProgress, next)
              ) {
                car.path = "pit-lane";
                car.lapProgress = 0;
                car.pitPhase = "inPitLane";
              } else {
                car.lapProgress = next;
              }
              break;
            }
            case "inPitLane": {
              const next = car.lapProgress + pitStep;
              const box = pit?.box ?? 0.5;
              if (car.lapProgress < box && next >= box) {
                car.lapProgress = box;
                car.pitPhase = "atBox";
                car.boxTimerSeconds = BOX_STOP_SECONDS;
              } else {
                car.lapProgress = next;
              }
              break;
            }
            case "atBox": {
              car.boxTimerSeconds -= dt * speedRef.current;
              if (car.boxTimerSeconds <= 0) car.pitPhase = "exiting";
              break;
            }
            case "exiting": {
              const next = car.lapProgress + pitStep;
              if (next >= 1) {
                // End of the pit lane: rejoin the racing line at pit exit.
                car.path = "racing-line";
                car.lapProgress = pit?.exit ?? 0;
                car.pitPhase = "none";
              } else {
                car.lapProgress = next;
              }
              break;
            }
          }
        }
      }
      publishCars();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, publishCars]);

  // --- Controls ---

  const addCar = useCallback(() => {
    const index = carsRef.current.length;
    carsRef.current.push({
      id: `car-${Date.now()}-${index}`,
      lapProgress: wrapDistance(index * 0.13),
      path: "racing-line",
      color: CAR_COLORS[index % CAR_COLORS.length],
      pitPhase: "none",
      boxTimerSeconds: 0,
    });
    publishCars();
  }, [publishCars]);

  const removeCar = useCallback(
    (id: string) => {
      carsRef.current = carsRef.current.filter((car) => car.id !== id);
      publishCars();
    },
    [publishCars],
  );

  const clearCars = useCallback(() => {
    carsRef.current = [];
    publishCars();
  }, [publishCars]);

  /** Flag a car to pit at the next pass of pit entry. */
  const triggerPitStop = useCallback((id: string) => {
    const car = carsRef.current.find((c) => c.id === id);
    if (car && car.pitPhase === "none" && car.path === "racing-line") {
      car.pitPhase = "toPitEntry";
    }
  }, []);

  return {
    cars: carVMs,
    running,
    setRunning,
    speed,
    setSpeed,
    addCar,
    removeCar,
    clearCars,
    triggerPitStop,
  };
}

export type PreviewState = ReturnType<typeof usePreview>;
