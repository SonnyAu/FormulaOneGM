"use client";

// Disambiguation popover for ambiguous snap clicks. Where the track visually
// overlaps itself (e.g. Suzuka's crossover), one click can be near several
// very different lap distances; the editor never guesses silently.

import type { SnapCandidate, TrackMetadata } from "@/lib/tracks/trackMetadata";
import {
  findNearestCorner,
  getCrossoverSectionAtDistance,
  getSectorAtDistance,
} from "@/lib/tracks/trackMath";
import type { PendingSnap } from "@/components/dev/track-editor/editorTypes";

function candidateLabel(metadata: TrackMetadata, candidate: SnapCandidate): string {
  if (candidate.pathId === "pit-lane") return "Pit lane";
  const parts: string[] = [];
  const crossover = getCrossoverSectionAtDistance(metadata.crossoverZones, candidate.distance);
  if (crossover) {
    parts.push(crossover.part === "lowerPath" ? "Lower crossover / underpass" : "Upper crossover / overpass");
  }
  const corner = findNearestCorner(metadata, candidate.distance, 0.05);
  if (corner) parts.push(`near ${corner.name}`);
  if (parts.length === 0) {
    const sector = getSectorAtDistance(metadata, candidate.distance);
    if (sector) parts.push(`Sector ${sector.sector}`);
  }
  return parts.join(" — ") || "Racing line";
}

export function SnapCandidatePopover({
  pending,
  metadata,
  onPick,
}: {
  pending: PendingSnap;
  metadata: TrackMetadata;
  onPick: (candidate: SnapCandidate | null) => void;
}) {
  return (
    <div
      className="absolute z-30 w-64 rounded border border-zinc-600 bg-[#0b0f14] p-2 shadow-xl"
      style={{ left: Math.max(8, pending.anchorX + 10), top: Math.max(8, pending.anchorY + 10) }}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Possible snap points
      </p>
      <div className="flex flex-col gap-1">
        {pending.candidates.map((candidate) => (
          <button
            key={candidate.distance}
            type="button"
            className="ui-interactive rounded border border-zinc-700 bg-[#1b232e] px-2 py-1.5 text-left text-xs text-zinc-200 hover:border-cyan-500"
            onClick={() => onPick(candidate)}
          >
            <span className="font-mono text-cyan-300">{candidate.distance.toFixed(3)}</span>
            <span className="ml-2 text-zinc-400">{candidateLabel(metadata, candidate)}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-1.5 w-full rounded px-2 py-1 text-center text-[11px] text-zinc-500 hover:text-zinc-300"
        onClick={() => onPick(null)}
      >
        Cancel
      </button>
    </div>
  );
}
