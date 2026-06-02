"use client";

import { useState } from "react";
import { PaceMode, RaceWeekendState, StrategyDecision, TireCompound } from "@/lib/sim/raceweekend/raceTypes";
import { EntryView } from "@/components/raceweekend/helpers";

const COMPOUNDS: TireCompound[] = ["SOFT", "MEDIUM", "HARD"];
const PACE_MODES: PaceMode[] = ["PUSH", "BALANCED", "CONSERVE"];

type StrategyControlsProps = {
  weekend: RaceWeekendState;
  entryMap: Record<string, EntryView>;
  onDecision: (decision: StrategyDecision) => void;
};

export function StrategyControls({ weekend, entryMap, onDecision }: StrategyControlsProps) {
  const race = weekend.race;
  const [selected, setSelected] = useState<Record<string, TireCompound>>({});

  if (!race) return null;
  const playerDrivers = race.drivers.filter((driver) => entryMap[driver.driverId]?.isPlayer && !driver.dnf);
  if (playerDrivers.length === 0) return null;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Strategy</h3>
      <div className="space-y-4">
        {playerDrivers.map((driver) => {
          const entry = entryMap[driver.driverId];
          const compound = selected[driver.driverId] ?? "MEDIUM";
          const pitQueued = driver.pendingPitCompound !== null;
          return (
            <div key={driver.driverId} className="rounded border border-zinc-700 bg-[#222a35] p-3">
              <p className="mb-2 font-semibold">{entry?.name}</p>

              <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">Pace mode</p>
              <div className="mb-3 inline-flex rounded border border-zinc-600 p-0.5 text-xs">
                {PACE_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onDecision({ driverId: driver.driverId, pit: false, nextCompound: null, paceMode: mode, source: "player", lap: race.currentLap })}
                    className={
                      driver.paceMode === mode
                        ? "rounded bg-zinc-700 px-2.5 py-1 text-zinc-100"
                        : "ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
                    }
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">Next compound</p>
              <div className="mb-3 inline-flex rounded border border-zinc-600 p-0.5 text-xs">
                {COMPOUNDS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [driver.driverId]: c }))}
                    className={
                      compound === c
                        ? "rounded bg-zinc-700 px-2.5 py-1 text-zinc-100"
                        : "ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {pitQueued ? (
                  <>
                    <span className="text-xs text-amber-300">Pit queued ({driver.pendingPitCompound})</span>
                    <button
                      type="button"
                      onClick={() => onDecision({ driverId: driver.driverId, pit: false, nextCompound: null, paceMode: null, source: "player", lap: race.currentLap })}
                      className="ui-interactive rounded border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-400"
                    >
                      Cancel pit
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDecision({ driverId: driver.driverId, pit: true, nextCompound: compound, paceMode: null, source: "player", lap: race.currentLap })}
                    className="ui-interactive rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    Pit for {compound}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
