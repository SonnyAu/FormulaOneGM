// Validation for track metadata before export. Errors block export; warnings
// flag incomplete optional data but still allow export.

import type { TrackMetadata } from "@/lib/tracks/trackMetadata";
import {
  hasDrawnPitLane,
  hasDrawnRacingLine,
  MIN_PIT_LANE_ANCHORS,
  MIN_RACING_LINE_ANCHORS,
} from "@/lib/tracks/trackMetadata";
import { findSectorCoverageIssues } from "@/lib/tracks/trackMath";

export type ValidationIssue = {
  /** Machine-friendly location, e.g. "corners[2].name". */
  field: string;
  message: string;
};

export type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  valid: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNormalized(value: unknown): boolean {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

export function validateTrackMetadata(metadata: TrackMetadata): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const error = (field: string, message: string) => errors.push({ field, message });
  const warn = (field: string, message: string) => warnings.push({ field, message });

  // --- Identity ---
  if (!metadata.id?.trim()) error("id", "Track id is required.");
  if (!metadata.name?.trim()) error("name", "Track name is required.");
  if (!metadata.country?.trim()) error("country", "Country is required.");
  if (!isFiniteNumber(metadata.layoutLengthKm) || metadata.layoutLengthKm <= 0) {
    error("layoutLengthKm", "Layout length must be a positive number of kilometers.");
  }
  if (!isFiniteNumber(metadata.laps) || metadata.laps <= 0) {
    error("laps", "Lap count must be positive.");
  }

  // --- Geometry ---
  const pitLaneDrawn = hasDrawnPitLane(metadata);
  if (!metadata.geometry || !hasDrawnRacingLine(metadata)) {
    error(
      "geometry.racingLine",
      `Draw the racing line: a closed loop with at least ${MIN_RACING_LINE_ANCHORS} anchor points is required.`,
    );
  }
  if (metadata.geometry?.pitLane && !pitLaneDrawn) {
    error(
      "geometry.pitLane",
      `The pit lane needs at least ${MIN_PIT_LANE_ANCHORS} anchor points (or remove it).`,
    );
  }
  for (const [key, points] of [
    ["racingLine", metadata.geometry?.racingLine ?? []],
    ["pitLane", metadata.geometry?.pitLane ?? []],
  ] as const) {
    points.forEach((point, i) => {
      if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
        error(`geometry.${key}[${i}]`, `Geometry anchor ${i + 1} on ${key} has invalid coordinates.`);
      }
    });
  }

  // --- Start/finish ---
  if (!metadata.startFinish || !isFiniteNumber(metadata.startFinish.distance)) {
    error("startFinish", "A start/finish point is required.");
  } else if (!isNormalized(metadata.startFinish.distance)) {
    error("startFinish.distance", "Start/finish distance must be between 0 and 1.");
  }

  // --- Sectors (any number >= 1) ---
  if (metadata.sectors.length === 0) {
    error("sectors", "At least one complete sector is required: place a sector start, then a sector end.");
  } else {
    metadata.sectors.forEach((sector, i) => {
      if (!isNormalized(sector.start) || !isNormalized(sector.end)) {
        error(`sectors[${i}]`, `Sector ${sector.sector} boundaries must be between 0 and 1.`);
      }
    });
    for (const issue of findSectorCoverageIssues(metadata.sectors)) {
      warn("sectors", issue);
    }
  }

  // --- Pit ---
  if (pitLaneDrawn) {
    if (!metadata.pit) {
      error("pit", "Pit entry and pit exit are required because a pit lane is drawn.");
    } else {
      if (!isNormalized(metadata.pit.entry)) {
        error("pit.entry", "Pit entry must be a normalized distance between 0 and 1.");
      }
      if (!isNormalized(metadata.pit.exit)) {
        error("pit.exit", "Pit exit must be a normalized distance between 0 and 1.");
      }
      if (!isNormalized(metadata.pit.box)) {
        error("pit.box", "Pit box must be a normalized distance between 0 and 1.");
      }
      if (!isFiniteNumber(metadata.pit.lossSeconds) || metadata.pit.lossSeconds <= 0) {
        error("pit.lossSeconds", "Pit loss seconds must be positive.");
      }
    }
  } else {
    warn("pit", "No pit lane drawn; pit metadata cannot be fully created.");
  }

  // --- Corners ---
  metadata.corners.forEach((corner, i) => {
    if (!corner.name?.trim()) error(`corners[${i}].name`, `Corner ${i + 1} has an empty name.`);
    if (!isNormalized(corner.distance)) {
      error(`corners[${i}].distance`, `Corner "${corner.name || i + 1}" distance must be between 0 and 1.`);
    }
    if (!isNormalized(corner.difficulty)) {
      error(`corners[${i}].difficulty`, `Corner "${corner.name || i + 1}" difficulty must be between 0 and 1.`);
    }
  });

  // --- Elevation profile ---
  if (metadata.elevationProfile.length === 0) {
    warn("elevationProfile", "No elevation profile defined.");
  }
  metadata.elevationProfile.forEach((point, i) => {
    if (!isNormalized(point.distance)) {
      error(`elevationProfile[${i}].distance`, `Elevation point ${i + 1} distance must be between 0 and 1.`);
    }
    if (!isFiniteNumber(point.elevationM)) {
      error(`elevationProfile[${i}].elevationM`, `Elevation point ${i + 1} must have a valid elevation in meters.`);
    }
  });

  // --- Crossover zones ---
  if (metadata.crossoverZones.length === 0) {
    warn("crossoverZones", "No crossover zones defined.");
  }
  metadata.crossoverZones.forEach((zone, i) => {
    const label = zone.name || `Crossover ${i + 1}`;
    for (const part of ["lowerPath", "upperPath"] as const) {
      const section = zone[part];
      if (!section || !isFiniteNumber(section.start) || !isFiniteNumber(section.end)) {
        error(`crossoverZones[${i}].${part}`, `${label}: ${part} start and end are required.`);
        continue;
      }
      if (!isNormalized(section.start) || !isNormalized(section.end)) {
        error(`crossoverZones[${i}].${part}`, `${label}: ${part} start and end must be between 0 and 1.`);
      }
      if (!isFiniteNumber(section.renderLayer)) {
        error(`crossoverZones[${i}].${part}.renderLayer`, `${label}: ${part} renderLayer must be a valid number.`);
      }
    }
  });

  return { errors, warnings, valid: errors.length === 0 };
}
