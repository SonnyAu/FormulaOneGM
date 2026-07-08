// Pure math helpers for working with normalized lap distances (0..1) and
// track metadata. No DOM or React dependencies, so the race engine can reuse
// everything here directly.

import type {
  CrossoverZone,
  TrackMetadata,
  TrackSector,
} from "@/lib/tracks/trackMetadata";

/** Wrap any number into the canonical 0..1 lap-progress range. */
export function wrapDistance(distance: number): number {
  const wrapped = distance % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

/**
 * True when `distance` lies inside [start, end] on the circular lap.
 *
 * Supports wraparound ranges: start=0.96, end=0.08 covers the start/finish
 * straight, so distance=0.02 is inside. Needed for sectors, pit exit
 * regions, and start/finish logic.
 */
export function isDistanceInRange(distance: number, start: number, end: number): boolean {
  const d = wrapDistance(distance);
  const s = wrapDistance(start);
  const e = wrapDistance(end);
  if (s <= e) return d >= s && d <= e;
  // Range crosses the start/finish line: it's the union [s, 1] ∪ [0, e].
  return d >= s || d <= e;
}

/** Shortest signed distance from `from` to `to` travelling forward around the lap. */
export function forwardDistance(from: number, to: number): number {
  return wrapDistance(to - from);
}

/** Renumber sectors 1..N in place (after add/delete/reorder). */
export function renumberSectors(sectors: TrackSector[]): TrackSector[] {
  return sectors.map((sector, i) => ({ ...sector, sector: i + 1 }));
}

/** Which sector a lap distance falls in, or null when it's in a gap. */
export function getSectorAtDistance(metadata: TrackMetadata, distance: number): TrackSector | null {
  const d = wrapDistance(distance);
  for (const sector of metadata.sectors) {
    if (isDistanceInRange(d, sector.start, sector.end)) return sector;
  }
  return null;
}

/**
 * Check whether the sectors tile the whole lap without gaps or overlaps:
 * sorted by start, each sector's end should equal the next sector's start
 * (wrapping around), within a small tolerance.
 */
export function findSectorCoverageIssues(sectors: TrackSector[], epsilon = 0.005): string[] {
  if (sectors.length === 0) return [];
  const issues: string[] = [];
  const sorted = [...sectors].sort((a, b) => wrapDistance(a.start) - wrapDistance(b.start));
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const gap = forwardDistance(current.end, next.start);
    // gap ≈ 0 means seamless; gap close to 1 means overlap (next starts before
    // this one ends); anything else is a hole in coverage.
    if (gap > epsilon && gap < 1 - epsilon) {
      issues.push(
        `Gap or overlap between sector ${current.sector} (ends ${current.end.toFixed(3)}) and sector ${next.sector} (starts ${next.start.toFixed(3)}).`,
      );
    }
  }
  return issues;
}

/**
 * Interpolated elevation (meters) at a lap distance.
 *
 * Linearly interpolates between the two surrounding profile points. The
 * profile is treated as circular: past the last point we interpolate back
 * toward the first point across the start/finish line.
 */
export function getElevationAtDistance(metadata: TrackMetadata, distance: number): number | null {
  const profile = metadata.elevationProfile;
  if (profile.length === 0) return null;
  if (profile.length === 1) return profile[0].elevationM;

  const d = wrapDistance(distance);
  const sorted = [...profile].sort((a, b) => a.distance - b.distance);

  // Find the segment [prev, next] that contains d.
  let prev = sorted[sorted.length - 1];
  let next = sorted[0];
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].distance <= d) {
      prev = sorted[i];
      next = sorted[(i + 1) % sorted.length];
    }
  }

  // Segment length measured forward around the lap (handles wraparound).
  const span = forwardDistance(prev.distance, next.distance);
  if (span === 0) return prev.elevationM;
  const t = forwardDistance(prev.distance, d) / span;
  return prev.elevationM + (next.elevationM - prev.elevationM) * t;
}

/**
 * Render layer for a car/marker at a lap distance, considering crossover
 * zones. Returns the matching section's renderLayer, or the default layer (2)
 * when the distance is outside every crossover section.
 *
 * Layer convention: 1 = under the bridge, 2 = normal track, 3 = on the bridge.
 */
export const DEFAULT_RENDER_LAYER = 2;

export function getCrossoverLayerAtDistance(metadata: TrackMetadata, distance: number): number {
  const zone = getCrossoverSectionAtDistance(metadata.crossoverZones, distance);
  return zone?.renderLayer ?? DEFAULT_RENDER_LAYER;
}

/** The crossover section (lower or upper) containing a distance, if any. */
export function getCrossoverSectionAtDistance(
  zones: CrossoverZone[],
  distance: number,
): { zone: CrossoverZone; part: "lowerPath" | "upperPath"; renderLayer: number } | null {
  for (const zone of zones) {
    if (isDistanceInRange(distance, zone.lowerPath.start, zone.lowerPath.end)) {
      return { zone, part: "lowerPath", renderLayer: zone.lowerPath.renderLayer };
    }
    if (isDistanceInRange(distance, zone.upperPath.start, zone.upperPath.end)) {
      return { zone, part: "upperPath", renderLayer: zone.upperPath.renderLayer };
    }
  }
  return null;
}

/** Nearest corner within `maxGap` lap distance of `distance` (either direction). */
export function findNearestCorner(
  metadata: TrackMetadata,
  distance: number,
  maxGap = 0.03,
): TrackMetadata["corners"][number] | null {
  let best: TrackMetadata["corners"][number] | null = null;
  let bestGap = maxGap;
  for (const corner of metadata.corners) {
    const forward = forwardDistance(distance, corner.distance);
    const gap = Math.min(forward, 1 - forward);
    if (gap <= bestGap) {
      best = corner;
      bestGap = gap;
    }
  }
  return best;
}
