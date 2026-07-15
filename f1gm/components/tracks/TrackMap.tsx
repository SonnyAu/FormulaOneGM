"use client";

// Game-facing track renderer.
//
// Renders a track asset (TrackMetadata, including its drawn geometry) as an
// SVG: asphalt + racing line, optional pit lane, sector highlights, crossover
// bridges, and cars positioned/rotated purely from lapProgress. This component
// must stay independent of the dev editor (imports only from lib/tracks/) so
// the exact same renderer that the editor previews with can be dropped into
// the race-weekend UI later:
//
//   <TrackMap metadata={await loadTrackMetadata(trackId)} cars={liveCars} />

import { useMemo } from "react";
import type { ReactNode, Ref } from "react";
import type { TrackMetadata, TrackPathKind } from "@/lib/tracks/trackMetadata";
import { PIT_LANE_ID, RACING_LINE_ID } from "@/lib/tracks/trackMetadata";
import { DRAW_VIEWBOX, geometryToPathD } from "@/lib/tracks/geometry";
import {
  createDetachedPath,
  getAngleAtNormalizedDistance,
  getPointAtNormalizedDistance,
  samplePath,
  type PathSample,
} from "@/lib/tracks/svgPath";
import { forwardDistance, getCrossoverLayerAtDistance } from "@/lib/tracks/trackMath";

export type TrackMapCar = {
  id: string;
  /** Normalized progress along the car's current path (0..1). */
  lapProgress: number;
  path: TrackPathKind;
  color: string;
};

export type TrackPaths = {
  racingD: string;
  pitD: string;
  racingPath: SVGPathElement | null;
  pitPath: SVGPathElement | null;
  racingSamples: PathSample[];
  pitSamples: PathSample[];
};

export type TrackMapProps = {
  metadata: TrackMetadata;
  cars?: TrackMapCar[];
  showRacingLine?: boolean;
  showPitLane?: boolean;
  showSectors?: boolean;
  showBridges?: boolean;
  showCars?: boolean;
  className?: string;
  /** Ref to the mounted <svg>, for callers that need coordinate conversion. */
  svgRef?: Ref<SVGSVGElement>;
  /** Extra content rendered inside the SVG, above all track layers. */
  children?: ReactNode;
  /**
   * Precomputed path data from a single useTrackPaths() call. When provided,
   * TrackMap skips its own sampling (editor uses this to avoid double work).
   */
  paths?: TrackPaths;
};

/** Stable empty metadata so TrackMap can call useTrackPaths without sampling when paths are passed in. */
const SKIP_PATH_METADATA: TrackMetadata = {
  id: "",
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

const SECTOR_COLORS = ["#f87171", "#60a5fa", "#facc15", "#4ade80", "#c084fc", "#fb923c"];

/** Polyline points covering a (possibly wraparound) distance range. */
export function rangePoints(samples: PathSample[], start: number, end: number): string {
  const n = samples.length;
  if (n === 0) return "";
  const startIndex = Math.round(start * n) % n;
  const count = Math.max(1, Math.round(forwardDistance(start, end) * n));
  const points: string[] = [];
  for (let i = 0; i <= count; i += 1) {
    const s = samples[(startIndex + i) % n];
    points.push(`${s.x.toFixed(1)},${s.y.toFixed(1)}`);
  }
  return points.join(" ");
}

/** Geometry-derived path data + detached measuring elements + sample table. */
export function useTrackPaths(metadata: TrackMetadata, sampleCount = 800): TrackPaths {
  const { geometry } = metadata;
  const racingD = useMemo(
    () => geometryToPathD(geometry.racingLine, true, geometry.smoothed),
    [geometry.racingLine, geometry.smoothed],
  );
  const pitD = useMemo(
    () =>
      geometry.pitLane && geometry.pitLane.length >= 2
        ? geometryToPathD(geometry.pitLane, false, geometry.smoothed)
        : "",
    [geometry.pitLane, geometry.smoothed],
  );
  // Detached elements give geometry queries that always match the d strings.
  const racingPath = useMemo(
    () => (racingD && geometry.racingLine.length >= 3 ? createDetachedPath(racingD) : null),
    [racingD, geometry.racingLine.length],
  );
  const pitPath = useMemo(() => (pitD ? createDetachedPath(pitD) : null), [pitD]);
  const racingSamples = useMemo(
    () => (racingPath ? samplePath(racingPath, sampleCount) : []),
    [racingPath, sampleCount],
  );
  const pitSamples = useMemo(
    () => (pitPath ? samplePath(pitPath, sampleCount) : []),
    [pitPath, sampleCount],
  );
  return { racingD, pitD, racingPath, pitPath, racingSamples, pitSamples };
}

type ProjectedCar = TrackMapCar & { x: number; y: number; angle: number; renderLayer: number };

export function TrackMap({
  metadata,
  cars = [],
  showRacingLine = true,
  showPitLane = true,
  showSectors = true,
  showBridges = true,
  showCars = true,
  className,
  svgRef,
  children,
  paths: pathsProp,
}: TrackMapProps) {
  // Always call the hook (rules of hooks); skip real sampling when paths are injected.
  const computedPaths = useTrackPaths(pathsProp ? SKIP_PATH_METADATA : metadata);
  const { racingD, pitD, racingPath, pitPath, racingSamples } = pathsProp ?? computedPaths;

  const projectedCars = useMemo<ProjectedCar[]>(() => {
    if (!showCars) return [];
    return cars.flatMap((car) => {
      const pathElement = car.path === "pit-lane" ? pitPath : racingPath;
      if (!pathElement) return [];
      const point = getPointAtNormalizedDistance(pathElement, car.lapProgress);
      const angle = getAngleAtNormalizedDistance(pathElement, car.lapProgress);
      const renderLayer =
        car.path === "racing-line" ? getCrossoverLayerAtDistance(metadata, car.lapProgress) : 2;
      return [{ ...car, x: point.x, y: point.y, angle, renderLayer }];
    });
  }, [cars, showCars, racingPath, pitPath, metadata]);

  return (
    <svg ref={svgRef} viewBox={DRAW_VIEWBOX} className={className} fill="none">
      {racingD && (
        <>
          <path
            data-track-path="asphalt"
            d={racingD}
            stroke="#39424f"
            strokeWidth={24}
            strokeLinejoin="round"
          />
          {showRacingLine && (
            <path
              id={RACING_LINE_ID}
              data-track-path="racing-line"
              d={racingD}
              stroke="#cbd5e1"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          )}
        </>
      )}
      {pitD && showPitLane && (
        <path
          id={PIT_LANE_ID}
          data-track-path="pit-lane"
          d={pitD}
          stroke="#67e8f9"
          strokeWidth={3}
          strokeDasharray="7 5"
        />
      )}

      {/* Sector range highlights */}
      {showSectors &&
        metadata.sectors.map((sector, i) => (
          <polyline
            key={`sector-${sector.sector}`}
            points={rangePoints(racingSamples, sector.start, sector.end)}
            fill="none"
            stroke={SECTOR_COLORS[i % SECTOR_COLORS.length]}
            strokeWidth={8}
            strokeOpacity={0.25}
            strokeLinecap="round"
          />
        ))}

      {/* Cars under the bridge (renderLayer < 2) */}
      {projectedCars
        .filter((car) => car.renderLayer < 2)
        .map((car) => (
          <CarGlyph key={car.id} car={car} />
        ))}

      {/* Crossover bridges, generated from metadata: a thickened stretch of
          the racing line over each upper-path range, with a shadow underneath.
          Draw order puts these above lower-layer cars and below upper cars. */}
      {showBridges &&
        metadata.crossoverZones.map((zone, i) => {
          const points = rangePoints(racingSamples, zone.upperPath.start, zone.upperPath.end);
          if (!points) return null;
          return (
            <g key={`bridge-${i}`}>
              <polyline
                points={points}
                fill="none"
                stroke="#0b0f14"
                strokeWidth={40}
                strokeOpacity={0.55}
                strokeLinecap="round"
              />
              <polyline points={points} fill="none" stroke="#4b5563" strokeWidth={30} strokeLinecap="round" />
              <polyline points={points} fill="none" stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" />
            </g>
          );
        })}

      {/* Cars at or above the normal layer */}
      {projectedCars
        .filter((car) => car.renderLayer >= 2)
        .map((car) => (
          <CarGlyph key={car.id} car={car} />
        ))}

      {children}
    </svg>
  );
}

function CarGlyph({ car }: { car: ProjectedCar }) {
  const length = 19;
  const width = 11;
  return (
    <g transform={`translate(${car.x}, ${car.y}) rotate(${car.angle})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        rx={width * 0.3}
        fill={car.color}
        stroke="#0b0f14"
        strokeWidth={1.5}
      />
      {/* Nose marker so travel direction is visible. */}
      <circle cx={length / 2 - width * 0.3} cy={0} r={width * 0.22} fill="#0b0f14" />
    </g>
  );
}
