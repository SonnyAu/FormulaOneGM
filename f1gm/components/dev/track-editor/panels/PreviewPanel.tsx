"use client";

// Preview mode controls: spawn cars, trigger pit stops, and watch elevation
// for each car. Proves the exported asset data drives animation correctly.

import { useState } from "react";
import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import type { PreviewState } from "@/components/dev/track-editor/usePreview";
import { getCrossoverLayerAtDistance, getElevationAtDistance } from "@/lib/tracks/trackMath";
import { loadTrackMetadata } from "@/lib/tracks/loadTrackAsset";
import { ElevationChart } from "@/components/dev/track-editor/panels/ElevationPanel";
import { PanelSection, SmallButton } from "@/components/dev/track-editor/panels/fields";

const PIT_PHASE_LABELS: Record<string, string> = {
  none: "on track",
  toPitEntry: "heading to pit entry",
  inPitLane: "in pit lane",
  atBox: "stopped at box",
  exiting: "exiting pits",
};

export function PreviewPanel({ editor, preview }: { editor: TrackEditorState; preview: PreviewState }) {
  const { metadata } = editor;
  const focusCar = preview.cars[0] ?? null;
  const [gameLoadStatus, setGameLoadStatus] = useState<string | null>(null);

  const verifyGameLoad = async () => {
    const id = metadata.id || editor.trackId;
    if (!id) {
      setGameLoadStatus("Set a track id before verifying.");
      return;
    }
    setGameLoadStatus("Loading…");
    try {
      await loadTrackMetadata(id);
      setGameLoadStatus(`OK — /tracks/${id}/metadata.json loads and validates (same path the game uses).`);
    } catch (err) {
      setGameLoadStatus(err instanceof Error ? err.message : "Load failed.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <PanelSection
        title="Preview controls"
        actions={
          <div className="flex gap-1.5">
            <SmallButton tone="accent" onClick={preview.addCar}>
              + Car
            </SmallButton>
            <SmallButton onClick={() => preview.setRunning(!preview.running)}>
              {preview.running ? "Pause" : "Play"}
            </SmallButton>
            <SmallButton tone="danger" onClick={preview.clearCars}>
              Clear
            </SmallButton>
          </div>
        }
      >
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Speed</span>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={preview.speed}
            onChange={(event) => preview.setSpeed(Number(event.target.value))}
            className="h-1 flex-1 accent-cyan-400"
          />
          <span className="w-8 text-right font-mono text-zinc-300">{preview.speed.toFixed(2)}x</span>
        </div>
        {!metadata.pit && (
          <p className="mt-2 text-[11px] text-amber-400">
            Pit stops need pit entry, exit, and box metadata plus a drawn pit lane.
          </p>
        )}
        <div className="mt-2 flex flex-col gap-1">
          <SmallButton tone="accent" onClick={verifyGameLoad} title="Fetch metadata via loadTrackMetadata (game path)">
            Verify game load
          </SmallButton>
          {gameLoadStatus && (
            <p className={`text-[11px] ${gameLoadStatus.startsWith("OK") ? "text-emerald-400" : "text-zinc-400"}`}>
              {gameLoadStatus}
            </p>
          )}
        </div>
      </PanelSection>

      <PanelSection title={`Cars (${preview.cars.length})`}>
        <div className="flex flex-col gap-1.5">
          {preview.cars.map((car) => {
            const elevation =
              car.path === "racing-line" ? getElevationAtDistance(metadata, car.lapProgress) : null;
            const layer =
              car.path === "racing-line" ? getCrossoverLayerAtDistance(metadata, car.lapProgress) : 2;
            return (
              <div
                key={car.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-700 bg-[#10151d] px-2 py-1.5 text-xs"
              >
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: car.color }} />
                <span className="w-14 font-mono text-cyan-300">{car.lapProgress.toFixed(3)}</span>
                <span className="flex-1 text-zinc-400">
                  {car.path === "pit-lane" ? "pit lane" : `layer ${layer}`}
                  {" · "}
                  {PIT_PHASE_LABELS[car.pitPhase]}
                  {elevation !== null && ` · ${elevation.toFixed(0)} m`}
                </span>
                <SmallButton
                  tone="accent"
                  disabled={car.pitPhase !== "none" || car.path !== "racing-line" || !metadata.pit}
                  onClick={() => preview.triggerPitStop(car.id)}
                  title="Simulate pit stop"
                >
                  Pit
                </SmallButton>
                <SmallButton tone="danger" onClick={() => preview.removeCar(car.id)}>
                  ×
                </SmallButton>
              </div>
            );
          })}
          {preview.cars.length === 0 && <p className="text-xs text-zinc-500">Spawn a car to start the demo.</p>}
        </div>
      </PanelSection>

      <PanelSection title="Elevation">
        <ElevationChart
          profile={metadata.elevationProfile}
          markerDistance={focusCar && focusCar.path === "racing-line" ? focusCar.lapProgress : null}
        />
        {focusCar && focusCar.path === "racing-line" && metadata.elevationProfile.length >= 2 && (
          <p className="mt-1 text-[11px] text-zinc-500">
            Red line follows the first car:{" "}
            <span className="font-mono text-zinc-300">
              {getElevationAtDistance(metadata, focusCar.lapProgress)?.toFixed(1)} m
            </span>
          </p>
        )}
      </PanelSection>
    </div>
  );
}
