"use client";

// Elevation profile editor: point list with add/edit/delete plus a small
// inline chart of elevation (m) against lap distance.

import { useMemo } from "react";
import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import type { MarkerRef } from "@/components/dev/track-editor/editorTypes";
import { markerRefEquals } from "@/components/dev/track-editor/editorTypes";
import { NumberInput, PanelSection, SmallButton } from "@/components/dev/track-editor/panels/fields";

const CHART_W = 260;
const CHART_H = 72;

export function ElevationChart({
  profile,
  markerDistance,
}: {
  profile: { distance: number; elevationM: number }[];
  /** Optional lap distance to highlight (e.g. a focused preview car). */
  markerDistance?: number | null;
}) {
  const sorted = useMemo(() => [...profile].sort((a, b) => a.distance - b.distance), [profile]);
  if (sorted.length < 2) {
    return <p className="text-xs text-zinc-500">Add at least two elevation points to see the profile.</p>;
  }
  const min = Math.min(...sorted.map((p) => p.elevationM));
  const max = Math.max(...sorted.map((p) => p.elevationM));
  const span = Math.max(1, max - min);
  const x = (d: number) => d * CHART_W;
  const y = (m: number) => CHART_H - ((m - min) / span) * (CHART_H - 10) - 5;
  const points = sorted.map((p) => `${x(p.distance).toFixed(1)},${y(p.elevationM).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full rounded border border-zinc-700 bg-[#10151d]">
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      {sorted.map((p, i) => (
        <circle key={i} cx={x(p.distance)} cy={y(p.elevationM)} r={2.5} fill="#38bdf8" />
      ))}
      {typeof markerDistance === "number" && (
        <line
          x1={x(markerDistance)}
          y1={0}
          x2={x(markerDistance)}
          y2={CHART_H}
          stroke="#f87171"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      <text x={2} y={10} fill="#71717a" fontSize={8}>
        {max.toFixed(0)} m
      </text>
      <text x={2} y={CHART_H - 2} fill="#71717a" fontSize={8}>
        {min.toFixed(0)} m
      </text>
    </svg>
  );
}

export function ElevationPanel({ editor }: { editor: TrackEditorState }) {
  const { metadata, updateMetadata, selectedMarker, setSelectedMarker, deleteMarker } = editor;

  return (
    <PanelSection
      title={`Elevation profile (${metadata.elevationProfile.length})`}
      actions={
        <SmallButton
          tone="accent"
          onClick={() =>
            updateMetadata((draft) => {
              draft.elevationProfile.push({ distance: 0, elevationM: 0 });
            })
          }
        >
          + Add
        </SmallButton>
      }
    >
      <div className="flex flex-col gap-2">
        <ElevationChart profile={metadata.elevationProfile} />
        <p className="text-[11px] text-zinc-500">
          Tip: use the elevation tool and click the track to snap a point, then set its height here.
        </p>
        <div className="flex flex-col gap-1">
          {metadata.elevationProfile.map((point, index) => {
            const ref: MarkerRef = { kind: "elevationPoint", index };
            const selected = markerRefEquals(ref, selectedMarker);
            return (
              <div
                key={index}
                className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                  selected ? "border-cyan-600 bg-cyan-900/20" : "border-zinc-700 bg-[#10151d]"
                }`}
                onClick={() => setSelectedMarker(ref)}
              >
                <span className="text-zinc-500">dist</span>
                <NumberInput
                  value={point.distance}
                  min={0}
                  max={1}
                  onChange={(value) =>
                    updateMetadata((draft) => {
                      draft.elevationProfile[index].distance = value;
                    })
                  }
                />
                <span className="text-zinc-500">m</span>
                <NumberInput
                  value={point.elevationM}
                  step={1}
                  onChange={(value) =>
                    updateMetadata((draft) => {
                      draft.elevationProfile[index].elevationM = value;
                    })
                  }
                />
                <SmallButton tone="danger" onClick={() => deleteMarker(ref)}>
                  ×
                </SmallButton>
              </div>
            );
          })}
        </div>
      </div>
    </PanelSection>
  );
}
