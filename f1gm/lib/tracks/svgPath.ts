// Browser SVG path geometry helpers.
//
// These wrap SVGPathElement.getTotalLength() / getPointAtLength() to convert
// between the visual layer (SVG user coordinates) and the engine's source of
// truth: a normalized distance 0..1 along a path ("lapProgress").
//
// The helpers work on any SVGPathElement — including DETACHED elements built
// from a `d` string via createDetachedPath(). Modern browsers compute path
// geometry from the d attribute alone, so callers can measure/snap/sample as
// a pure function of the geometry without waiting for a DOM commit.

import type { SnapCandidate } from "@/lib/tracks/trackMetadata";
import { wrapDistance } from "@/lib/tracks/trackMath";

export type PathPoint = { x: number; y: number };

/**
 * Build a detached (unmounted) path element from a `d` string so geometry
 * queries reflect exactly this string, independent of React commit timing.
 */
export function createDetachedPath(d: string): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  return path;
}

/** Total path length in SVG user units. */
export function getPathLength(pathElement: SVGPathElement): number {
  return pathElement.getTotalLength();
}

/** Point on the path at a normalized distance (0..1, wraps around). */
export function getPointAtNormalizedDistance(
  pathElement: SVGPathElement,
  distance: number,
): PathPoint {
  const length = pathElement.getTotalLength();
  const point = pathElement.getPointAtLength(wrapDistance(distance) * length);
  return { x: point.x, y: point.y };
}

/**
 * Tangent angle (degrees) of the path at a normalized distance.
 *
 * The browser only exposes positions, so we approximate the tangent with a
 * central finite difference: sample slightly before and after the target and
 * take the direction between the two points.
 */
export function getAngleAtNormalizedDistance(
  pathElement: SVGPathElement,
  distance: number,
): number {
  const length = pathElement.getTotalLength();
  // Half-window of ~0.5 user units keeps the tangent stable on tight corners.
  const delta = Math.min(0.5, length * 0.001);
  const at = wrapDistance(distance) * length;
  const before = pathElement.getPointAtLength((at - delta + length) % length);
  const after = pathElement.getPointAtLength((at + delta) % length);
  return (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI;
}

// --- Sampling ---------------------------------------------------------------

export type PathSample = { distance: number; x: number; y: number };

/**
 * Uniformly sample a path into `count` points. Building the table once and
 * reusing it makes nearest-point queries cheap (getPointAtLength is slow).
 */
export function samplePath(pathElement: SVGPathElement, count = 800): PathSample[] {
  const length = pathElement.getTotalLength();
  const samples: PathSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const distance = i / count;
    const point = pathElement.getPointAtLength(distance * length);
    samples.push({ distance, x: point.x, y: point.y });
  }
  return samples;
}

function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Nearest normalized distance on the path to an (x, y) point in SVG user
 * coordinates. Coarse pass over the sample table, then a binary-style
 * refinement around the best sample for sub-sample precision.
 */
export function findNearestNormalizedDistance(
  pathElement: SVGPathElement,
  x: number,
  y: number,
  samples?: PathSample[],
): number {
  const table = samples ?? samplePath(pathElement);
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < table.length; i += 1) {
    const d = squaredDistance(x, y, table[i].x, table[i].y);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return refineNearest(pathElement, x, y, table[bestIndex].distance, 1 / table.length);
}

/** Iteratively shrink a window around `center` to find the local nearest distance. */
function refineNearest(
  pathElement: SVGPathElement,
  x: number,
  y: number,
  center: number,
  window: number,
): number {
  const length = pathElement.getTotalLength();
  let best = center;
  let bestDist = distanceToPathAt(pathElement, length, best, x, y);
  let span = window;
  // Each pass halves the window; 8 passes gives precision of window / 256.
  for (let pass = 0; pass < 8; pass += 1) {
    for (const candidate of [best - span / 2, best + span / 2]) {
      const d = distanceToPathAt(pathElement, length, candidate, x, y);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    span /= 2;
  }
  return wrapDistance(best);
}

function distanceToPathAt(
  pathElement: SVGPathElement,
  length: number,
  distance: number,
  x: number,
  y: number,
): number {
  const point = pathElement.getPointAtLength(wrapDistance(distance) * length);
  return squaredDistance(x, y, point.x, point.y);
}

// --- Snap candidates ---------------------------------------------------------

export type FindSnapCandidatesOptions = {
  /** Max distance (SVG user units) a candidate may be from the click. */
  maxPixelRadius?: number;
  /**
   * Candidates closer than this along the path (normalized) are merged into
   * one. Prevents adjacent samples from appearing as separate candidates.
   */
  minSeparation?: number;
  /** Pre-computed sample table for this path (perf). */
  samples?: PathSample[];
};

/**
 * All plausible snap points near a click.
 *
 * Where a path visually overlaps or nearly touches itself (Suzuka's
 * figure-eight crossover), a single click can be near two very different lap
 * distances (e.g. 0.32 on the underpass and 0.74 on the overpass). Instead of
 * silently guessing, this finds every local minimum of distance-to-click
 * within the radius, so the editor can ask the user which one they meant.
 */
export function findSnapCandidates(
  pathElement: SVGPathElement,
  x: number,
  y: number,
  pathId: string,
  options: FindSnapCandidatesOptions = {},
): SnapCandidate[] {
  const { maxPixelRadius = 20, minSeparation = 0.02 } = options;
  const table = options.samples ?? samplePath(pathElement);
  const radiusSq = maxPixelRadius * maxPixelRadius;

  // Collect local minima of the distance-to-click function over the circular
  // sample table. A sample is a local minimum when it's closer than both its
  // neighbors; runs of equal distance are handled by the merge step below.
  const minima: PathSample[] = [];
  const n = table.length;
  for (let i = 0; i < n; i += 1) {
    const here = squaredDistance(x, y, table[i].x, table[i].y);
    if (here > radiusSq) continue;
    const prev = squaredDistance(x, y, table[(i - 1 + n) % n].x, table[(i - 1 + n) % n].y);
    const next = squaredDistance(x, y, table[(i + 1) % n].x, table[(i + 1) % n].y);
    if (here <= prev && here <= next) minima.push(table[i]);
  }

  // Refine each minimum, then merge candidates that resolve to nearly the
  // same lap distance (they were the same physical spot on the track).
  const refined: SnapCandidate[] = [];
  for (const sample of minima) {
    const distance = refineNearest(pathElement, x, y, sample.distance, 1 / n);
    const gapTo = (other: number) => {
      const forward = wrapDistance(distance - other);
      return Math.min(forward, 1 - forward);
    };
    if (refined.some((c) => gapTo(c.distance) < minSeparation)) continue;
    const point = getPointAtNormalizedDistance(pathElement, distance);
    refined.push({ distance, x: point.x, y: point.y, pathId });
  }

  refined.sort((a, b) => a.distance - b.distance);
  return refined;
}

// --- Coordinate conversion ----------------------------------------------------

/**
 * Convert a browser mouse event position to the SVG's user coordinate space,
 * accounting for viewBox scaling and any CSS transforms on the SVG.
 */
export function clientPointToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): PathPoint {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}
