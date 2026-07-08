// Track asset metadata types.
//
// A track asset is a folder under public/tracks/<id>/ containing:
//   metadata.json  – this schema; the single file the game needs (includes
//                    the drawn circuit geometry)
//   track.svg      – generated compatibility artifact, never a runtime dep
//
// Design principle: the race engine treats normalized lap progress (0..1
// along the racing line) as the source of truth. The drawn geometry is only
// the visual layer, so tracks that visually overlap themselves (e.g. Suzuka's
// figure-eight) remain unambiguous to the engine.
//
// Deliberately minimal: only things that must be drawn or placed by hand live
// here (geometry, sectors, corners, pit, elevation, crossovers, identity).
// Overtaking difficulty, incident risk, and performance traits are derived
// dynamically by the race engine from this layout data, not authored.

import type { TrackGeometry } from "@/lib/tracks/geometry";

export type CornerType =
  | "braking"
  | "traction"
  | "highSpeed"
  | "mediumSpeed"
  | "lowSpeed"
  | "chicane"
  | "hairpin"
  | "sweeper";

export const CORNER_TYPES: CornerType[] = [
  "braking",
  "traction",
  "highSpeed",
  "mediumSpeed",
  "lowSpeed",
  "chicane",
  "hairpin",
  "sweeper",
];

export type TrackCorner = {
  name: string;
  /** Normalized distance along the racing line (0..1). */
  distance: number;
  /** 0..1, how demanding the corner is. */
  difficulty: number;
  type: CornerType;
};

export type ElevationPoint = {
  /** Normalized distance along the racing line (0..1). */
  distance: number;
  /** Elevation in meters relative to the start/finish line. */
  elevationM: number;
};

export type CrossoverPathSection = {
  /** Normalized distance range on the racing line covered by this section. */
  start: number;
  end: number;
  /** Higher renderLayer draws on top. Lower sections render underneath. */
  renderLayer: number;
};

/**
 * A crossover zone marks two ranges of the same racing line that visually
 * overlap (e.g. Suzuka's underpass at ~0.31 and overpass at ~0.75). The
 * renderer uses renderLayer to stack track sections and cars correctly.
 */
export type CrossoverZone = {
  name: string;
  lowerPath: CrossoverPathSection;
  upperPath: CrossoverPathSection;
};

export type TrackSector = {
  /** 1-based sector number; renumbered automatically when sectors change. */
  sector: number;
  start: number;
  end: number;
};

export type PitMetadata = {
  /** Normalized distance on the racing line where cars leave for the pits. */
  entry: number;
  /** Normalized distance on the racing line where cars rejoin. */
  exit: number;
  /** Normalized distance along the pit-lane path where the pit box sits. */
  box: number;
  /** Expected total time lost by a pit stop. */
  lossSeconds: number;
};

export type TrackMetadata = {
  /** Stable track id; should match the ids in lib/sim/raceweekend/trackProfiles.ts. */
  id: string;
  name: string;
  country: string;
  layoutLengthKm: number;
  laps: number;
  /** Drawn circuit shape; anchor points are the editable source of truth. */
  geometry: TrackGeometry;
  startFinish: { distance: number };
  /** Any number of user-defined sectors, numbered 1..N. */
  sectors: TrackSector[];
  pit: PitMetadata | null;
  corners: TrackCorner[];
  elevationProfile: ElevationPoint[];
  crossoverZones: CrossoverZone[];
};

/** A candidate returned when snapping a click to the racing/pit line. */
export type SnapCandidate = {
  /** Normalized distance along the path. */
  distance: number;
  /** Position in the SVG's user coordinate space. */
  x: number;
  y: number;
  elevationM?: number;
  renderLayer?: number;
  /** Human-readable label for the surrounding section (e.g. "Lower crossover"). */
  segmentName?: string;
  pathId: string;
};

export type TrackPathKind = "racing-line" | "pit-lane";

/** Path element ids used by the renderer (generated from geometry). */
export const RACING_LINE_ID = "racing-line";
export const PIT_LANE_ID = "pit-lane";

/** Minimum anchors for a usable closed racing line / open pit lane. */
export const MIN_RACING_LINE_ANCHORS = 3;
export const MIN_PIT_LANE_ANCHORS = 2;

export function hasDrawnRacingLine(metadata: TrackMetadata): boolean {
  return metadata.geometry.racingLine.length >= MIN_RACING_LINE_ANCHORS;
}

export function hasDrawnPitLane(metadata: TrackMetadata): boolean {
  return (metadata.geometry.pitLane?.length ?? 0) >= MIN_PIT_LANE_ANCHORS;
}

export function createEmptyTrackMetadata(id = ""): TrackMetadata {
  return {
    id,
    name: "",
    country: "",
    layoutLengthKm: 0,
    laps: 0,
    geometry: { racingLine: [], pitLane: null, smoothed: true },
    startFinish: { distance: 0 },
    sectors: [],
    pit: null,
    corners: [],
    elevationProfile: [],
    crossoverZones: [],
  };
}
