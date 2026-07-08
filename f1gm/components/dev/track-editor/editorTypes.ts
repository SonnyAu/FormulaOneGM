// Shared types and constants for the internal track asset editor.

import type { SnapCandidate, TrackPathKind } from "@/lib/tracks/trackMetadata";

/**
 * Active editor tool. Drawing tools edit geometry anchors; the rest place or
 * reposition metadata markers snapped to the drawn paths.
 */
export type EditorTool =
  | "select"
  | "drawRacingLine"
  | "drawPitLane"
  | "startFinish"
  | "sectorStart"
  | "sectorEnd"
  | "pitEntry"
  | "pitExit"
  | "pitBox"
  | "corner"
  | "elevationPoint"
  | "crossoverZone";

export const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Select / move",
  drawRacingLine: "Draw racing line",
  drawPitLane: "Draw pit lane",
  startFinish: "Start/finish",
  sectorStart: "Sector start",
  sectorEnd: "Sector end",
  pitEntry: "Pit entry",
  pitExit: "Pit exit",
  pitBox: "Pit box",
  corner: "Corner",
  elevationPoint: "Elevation point",
  crossoverZone: "Crossover zone",
};

export const DRAW_TOOLS: EditorTool[] = ["drawRacingLine", "drawPitLane"];

/** Stable reference to a single editable marker inside the metadata draft. */
export type SectorPointKey = "start" | "end";
export type CrossoverPointKey = "lowerStart" | "lowerEnd" | "upperStart" | "upperEnd";

export type MarkerRef =
  | { kind: "startFinish" }
  | { kind: "sector"; index: number; point: SectorPointKey }
  | { kind: "pitEntry" }
  | { kind: "pitExit" }
  | { kind: "pitBox" }
  | { kind: "corner"; index: number }
  | { kind: "elevationPoint"; index: number }
  | { kind: "crossoverZone"; index: number; point: CrossoverPointKey };

export function markerRefEquals(a: MarkerRef | null, b: MarkerRef | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  const ai = "index" in a ? a.index : -1;
  const bi = "index" in b ? b.index : -1;
  const ap = "point" in a ? a.point : "";
  const bp = "point" in b ? b.point : "";
  return ai === bi && ap === bp;
}

/** Which path a marker snaps to. Only the pit box lives on the pit lane. */
export function markerPathKind(ref: MarkerRef): TrackPathKind {
  return ref.kind === "pitBox" ? "pit-lane" : "racing-line";
}

/** Why a snap click happened; resolved once a candidate is confirmed. */
export type SnapPurpose =
  | { type: "tool"; tool: Exclude<EditorTool, "select" | "drawRacingLine" | "drawPitLane"> }
  | { type: "reposition"; ref: MarkerRef };

export type PendingSnap = {
  candidates: SnapCandidate[];
  purpose: SnapPurpose;
  /** Popover anchor, in pixels relative to the canvas container. */
  anchorX: number;
  anchorY: number;
};

// --- Layer toggles ------------------------------------------------------------

export type LayerKey =
  | "racingLine"
  | "pitLane"
  | "corners"
  | "sectors"
  | "pitMarkers"
  | "elevationPoints"
  | "crossoverZones"
  | "bridgeOverlays"
  | "previewCars";

export const LAYER_LABELS: Record<LayerKey, string> = {
  racingLine: "Racing line",
  pitLane: "Pit lane",
  corners: "Corners",
  sectors: "Sectors",
  pitMarkers: "Pit markers",
  elevationPoints: "Elevation points",
  crossoverZones: "Crossover zones",
  bridgeOverlays: "Bridge overlays",
  previewCars: "Preview cars",
};

export const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  racingLine: true,
  pitLane: true,
  corners: true,
  sectors: true,
  pitMarkers: true,
  elevationPoints: true,
  crossoverZones: true,
  bridgeOverlays: true,
  previewCars: true,
};

// --- Marker styling -------------------------------------------------------------

export type MarkerKindKey = MarkerRef["kind"];

export const MARKER_COLORS: Record<MarkerKindKey, string> = {
  startFinish: "#f8fafc",
  sector: "#a78bfa",
  pitEntry: "#22d3ee",
  pitExit: "#22d3ee",
  pitBox: "#22d3ee",
  corner: "#fbbf24",
  elevationPoint: "#38bdf8",
  crossoverZone: "#f472b6",
};

/** Layer toggle governing each marker kind. */
export const MARKER_LAYER: Record<MarkerKindKey, LayerKey> = {
  startFinish: "sectors",
  sector: "sectors",
  pitEntry: "pitMarkers",
  pitExit: "pitMarkers",
  pitBox: "pitMarkers",
  corner: "corners",
  elevationPoint: "elevationPoints",
  crossoverZone: "crossoverZones",
};

// --- Multi-click drafts ------------------------------------------------------------

/** Crossover zones are placed with four consecutive snapped clicks. */
export const CROSSOVER_SEQUENCE: CrossoverPointKey[] = [
  "lowerStart",
  "lowerEnd",
  "upperStart",
  "upperEnd",
];

export type CrossoverDraft = Partial<Record<CrossoverPointKey, number>>;

export type EditorMode = "edit" | "preview";

/** A selected geometry anchor (while a draw tool is active). */
export type AnchorRef = { path: TrackPathKind; index: number };
