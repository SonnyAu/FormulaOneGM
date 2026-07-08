"use client";

// Track editor canvas: wraps the game-facing TrackMap renderer and layers the
// editing UI on top — geometry anchor handles (draw/reshape), metadata
// markers, hover tooltip, and the ambiguous-snap popover.

import { useCallback, useMemo, useRef, useState } from "react";
import type { SnapCandidate, TrackPathKind } from "@/lib/tracks/trackMetadata";
import {
  clientPointToSvg,
  findSnapCandidates,
  getPointAtNormalizedDistance,
} from "@/lib/tracks/svgPath";
import {
  findNearestCorner,
  getCrossoverSectionAtDistance,
  getElevationAtDistance,
  getSectorAtDistance,
} from "@/lib/tracks/trackMath";
import type { AnchorRef, MarkerRef, SnapPurpose } from "@/components/dev/track-editor/editorTypes";
import {
  MARKER_COLORS,
  MARKER_LAYER,
  markerPathKind,
  markerRefEquals,
} from "@/components/dev/track-editor/editorTypes";
import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import { rangePoints, TrackMap, useTrackPaths, type TrackMapCar } from "@/components/tracks/TrackMap";
import { SnapCandidatePopover } from "@/components/dev/track-editor/SnapCandidatePopover";

type MarkerVM = {
  ref: MarkerRef;
  distance: number;
  pathKind: TrackPathKind;
  color: string;
  label: string;
};

type HoverInfo = {
  /** Tooltip position in pixels relative to the canvas container. */
  left: number;
  top: number;
  distance: number;
  pathKind: TrackPathKind;
};

/** How close (SVG units) a click must be to an anchor to select it. */
const ANCHOR_HIT_RADIUS = 12;

export function SvgCanvas({ editor, cars }: { editor: TrackEditorState; cars: TrackMapCar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  // Anchor being dragged, plus whether it actually moved (to suppress the
  // click event that fires after pointerup ends a drag).
  const dragRef = useRef<{ anchor: AnchorRef; moved: boolean } | null>(null);

  const { metadata, layers, tool, selectedMarker, mode } = editor;
  const { racingPath, pitPath, racingSamples, pitSamples } = useTrackPaths(metadata);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    return clientPointToSvg(svg, clientX, clientY);
  }, []);

  /** Pixel radius converted to SVG user units using the current screen scale. */
  const svgRadius = useCallback((pixels: number) => {
    const scale = svgRef.current?.getScreenCTM()?.a ?? 1;
    return pixels / Math.abs(scale);
  }, []);

  // --- Marker view models from the metadata draft ---
  const markers = useMemo<MarkerVM[]>(() => {
    const list: MarkerVM[] = [];
    const add = (ref: MarkerRef, distance: number, label: string) => {
      list.push({
        ref,
        distance,
        pathKind: markerPathKind(ref),
        color: MARKER_COLORS[ref.kind],
        label,
      });
    };

    add({ kind: "startFinish" }, metadata.startFinish.distance, "Start/finish");
    metadata.sectors.forEach((sector, index) => {
      add({ kind: "sector", index, point: "start" }, sector.start, `Sector ${sector.sector} start`);
      add({ kind: "sector", index, point: "end" }, sector.end, `Sector ${sector.sector} end`);
    });
    if (metadata.pit) {
      add({ kind: "pitEntry" }, metadata.pit.entry, "Pit entry");
      add({ kind: "pitExit" }, metadata.pit.exit, "Pit exit");
      add({ kind: "pitBox" }, metadata.pit.box, "Pit box");
    }
    metadata.corners.forEach((corner, index) => {
      add({ kind: "corner", index }, corner.distance, corner.name);
    });
    metadata.elevationProfile.forEach((point, index) => {
      add({ kind: "elevationPoint", index }, point.distance, `${point.elevationM} m`);
    });
    metadata.crossoverZones.forEach((zone, index) => {
      add({ kind: "crossoverZone", index, point: "lowerStart" }, zone.lowerPath.start, `${zone.name} lower start`);
      add({ kind: "crossoverZone", index, point: "lowerEnd" }, zone.lowerPath.end, `${zone.name} lower end`);
      add({ kind: "crossoverZone", index, point: "upperStart" }, zone.upperPath.start, `${zone.name} upper start`);
      add({ kind: "crossoverZone", index, point: "upperEnd" }, zone.upperPath.end, `${zone.name} upper end`);
    });

    return list.filter((marker) => layers[MARKER_LAYER[marker.ref.kind]]);
  }, [metadata, layers]);

  const markerPosition = useCallback(
    (marker: MarkerVM) => {
      const path = marker.pathKind === "pit-lane" ? pitPath : racingPath;
      if (!path) return null;
      return getPointAtNormalizedDistance(path, marker.distance);
    },
    [racingPath, pitPath],
  );

  // --- Geometry helpers ---

  const activeDrawPath: TrackPathKind | null =
    tool === "drawRacingLine" ? "racing-line" : tool === "drawPitLane" ? "pit-lane" : null;

  const anchorsFor = useCallback(
    (pathKind: TrackPathKind) =>
      pathKind === "racing-line" ? metadata.geometry.racingLine : metadata.geometry.pitLane ?? [],
    [metadata.geometry],
  );

  const nearestAnchor = useCallback(
    (pathKind: TrackPathKind, x: number, y: number): AnchorRef | null => {
      const anchors = anchorsFor(pathKind);
      const radius = svgRadius(ANCHOR_HIT_RADIUS);
      let best: AnchorRef | null = null;
      let bestDist = radius;
      anchors.forEach((anchor, index) => {
        const dist = Math.hypot(anchor.x - x, anchor.y - y);
        if (dist <= bestDist) {
          best = { path: pathKind, index };
          bestDist = dist;
        }
      });
      return best;
    },
    [anchorsFor, svgRadius],
  );

  const drawingInProgress =
    (tool === "drawRacingLine" && !editor.racingClosed) ||
    (tool === "drawPitLane" && !editor.pitFinished);

  // --- Click handling ---

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (mode === "preview") return;
      if (dragRef.current?.moved) return; // click generated by ending a drag
      const point = toSvgPoint(event.clientX, event.clientY);
      if (!point) return;

      // Drawing tools: append anchors, or select/insert once the path is done.
      if (activeDrawPath) {
        if (drawingInProgress) {
          editor.appendAnchor(activeDrawPath, point);
          return;
        }
        const anchor = nearestAnchor(activeDrawPath, point.x, point.y);
        if (anchor) {
          editor.setSelectedAnchor(anchor);
        } else {
          editor.insertAnchor(activeDrawPath, point);
        }
        return;
      }

      // Metadata tools: snap to the drawn paths. Draw tools returned above,
      // so narrow them away explicitly for the SnapPurpose union.
      if (tool === "drawRacingLine" || tool === "drawPitLane") return;
      let purpose: SnapPurpose;
      if (tool === "select") {
        if (!selectedMarker) return;
        purpose = { type: "reposition", ref: selectedMarker };
      } else {
        purpose = { type: "tool", tool };
      }

      const targetKind: TrackPathKind =
        purpose.type === "reposition"
          ? markerPathKind(purpose.ref)
          : purpose.tool === "pitBox"
            ? "pit-lane"
            : "racing-line";
      const path = targetKind === "pit-lane" ? pitPath : racingPath;
      if (!path) return;

      const candidates = findSnapCandidates(path, point.x, point.y, targetKind, {
        maxPixelRadius: svgRadius(24),
        samples: targetKind === "pit-lane" ? pitSamples : racingSamples,
      });
      if (candidates.length === 0) return;

      const rect = containerRef.current?.getBoundingClientRect();
      editor.handleSnapResult(
        candidates,
        purpose,
        event.clientX - (rect?.left ?? 0),
        event.clientY - (rect?.top ?? 0),
      );
    },
    [
      mode,
      tool,
      selectedMarker,
      activeDrawPath,
      drawingInProgress,
      nearestAnchor,
      toSvgPoint,
      svgRadius,
      racingPath,
      pitPath,
      racingSamples,
      pitSamples,
      editor,
    ],
  );

  // --- Anchor dragging ---

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = toSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      drag.moved = true;
      editor.moveAnchor(drag.anchor, point);
    },
    [toSvgPoint, editor],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const moved = dragRef.current.moved;
    dragRef.current = moved ? dragRef.current : null;
    // Keep the drag record until after the synthetic click fires, then clear.
    if (moved) setTimeout(() => (dragRef.current = null), 0);
  }, []);

  const startAnchorDrag = useCallback(
    (anchor: AnchorRef) => (event: React.PointerEvent) => {
      event.stopPropagation();
      dragRef.current = { anchor, moved: false };
      editor.setSelectedAnchor(anchor);
    },
    [editor],
  );

  // --- Hover tooltip ---
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (racingSamples.length === 0) {
        setHover(null);
        return;
      }
      const point = toSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      const radius = svgRadius(18);

      // Prefer the racing line; fall back to the pit lane when it's closer.
      let best: { distance: number; pathKind: TrackPathKind; gap: number } | null = null;
      for (const [samples, pathKind] of [
        [racingSamples, "racing-line"],
        [pitSamples, "pit-lane"],
      ] as const) {
        for (const sample of samples) {
          const gap = Math.hypot(sample.x - point.x, sample.y - point.y);
          if (gap <= radius && (!best || gap < best.gap)) {
            best = { distance: sample.distance, pathKind, gap };
          }
        }
      }
      const rect = containerRef.current?.getBoundingClientRect();
      setHover(
        best && rect
          ? {
              left: event.clientX - rect.left + 14,
              top: event.clientY - rect.top + 14,
              distance: best.distance,
              pathKind: best.pathKind,
            }
          : null,
      );
    },
    [racingSamples, pitSamples, toSvgPoint, svgRadius],
  );

  // Delete key removes the selected anchor (draw mode) or marker.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (editor.selectedAnchor) {
        editor.deleteAnchor(editor.selectedAnchor);
      } else if (selectedMarker) {
        editor.deleteMarker(selectedMarker);
      }
    },
    [editor, selectedMarker],
  );

  const hoverDetails = useMemo(() => {
    if (!hover) return null;
    const sector = getSectorAtDistance(metadata, hover.distance);
    const corner = findNearestCorner(metadata, hover.distance);
    const elevation = getElevationAtDistance(metadata, hover.distance);
    const crossover = getCrossoverSectionAtDistance(metadata.crossoverZones, hover.distance);
    return { sector, corner, elevation, crossover };
  }, [hover, metadata]);

  const markerBaseRadius = 6;
  const showAnchors = activeDrawPath !== null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded border border-zinc-700 bg-[#10151d] outline-none"
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <TrackMap
        metadata={metadata}
        cars={cars}
        showRacingLine={layers.racingLine}
        showPitLane={layers.pitLane}
        showSectors={layers.sectors}
        showBridges={layers.bridgeOverlays}
        showCars={layers.previewCars}
        svgRef={svgRef}
        className="h-full w-full p-2"
      >
        {/* Crossover section highlights */}
        {mode === "edit" &&
          layers.crossoverZones &&
          metadata.crossoverZones.map((zone, i) => (
            <g key={`crossover-${i}`}>
              <CrossoverRange samples={racingSamples} section={zone.lowerPath} color="#c084fc" />
              <CrossoverRange samples={racingSamples} section={zone.upperPath} color="#f472b6" />
            </g>
          ))}

        {/* Metadata markers */}
        {mode === "edit" &&
          markers.map((marker) => {
            const position = markerPosition(marker);
            if (!position) return null;
            const isSelected = markerRefEquals(marker.ref, selectedMarker);
            const isPit = marker.pathKind === "pit-lane";
            return (
              <g
                key={`${marker.ref.kind}-${"index" in marker.ref ? marker.ref.index : 0}-${"point" in marker.ref ? marker.ref.point : ""}`}
                transform={`translate(${position.x}, ${position.y})`}
                style={{ cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  editor.setSelectedMarker(marker.ref);
                  editor.setTool("select");
                }}
              >
                {/* Pit-lane points are squares, racing-line points circles. */}
                {isPit ? (
                  <rect
                    x={-markerBaseRadius}
                    y={-markerBaseRadius}
                    width={markerBaseRadius * 2}
                    height={markerBaseRadius * 2}
                    fill={marker.color}
                    stroke={isSelected ? "#ffffff" : "#0b0f14"}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                ) : (
                  <circle
                    r={isSelected ? markerBaseRadius * 1.4 : markerBaseRadius}
                    fill={marker.color}
                    stroke={isSelected ? "#ffffff" : "#0b0f14"}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                )}
              </g>
            );
          })}

        {/* Geometry anchor handles (visible while a draw tool is active) */}
        {mode === "edit" &&
          showAnchors &&
          anchorsFor(activeDrawPath!).map((anchor, index) => {
            const isSelected =
              editor.selectedAnchor?.path === activeDrawPath && editor.selectedAnchor.index === index;
            const isFirstRacing = activeDrawPath === "racing-line" && index === 0 && drawingInProgress;
            return (
              <g key={`anchor-${index}`} transform={`translate(${anchor.x}, ${anchor.y})`}>
                {/* Highlight the first anchor while drawing: clicking it closes the loop. */}
                {isFirstRacing && (
                  <circle r={14} fill="none" stroke="#4ade80" strokeWidth={1.5} strokeDasharray="3 3" />
                )}
                <circle
                  r={isSelected ? 8 : 5.5}
                  fill={isSelected ? "#ffffff" : "#94a3b8"}
                  stroke="#0b0f14"
                  strokeWidth={1.5}
                  style={{ cursor: "grab" }}
                  onPointerDown={startAnchorDrag({ path: activeDrawPath!, index })}
                  onClick={(event) => event.stopPropagation()}
                />
              </g>
            );
          })}
      </TrackMap>

      {metadata.geometry.racingLine.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Pick &quot;Draw racing line&quot; and click to place anchors, or load a track asset.
        </div>
      )}

      {/* Hover tooltip */}
      {hover && hoverDetails && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-zinc-600 bg-[#0b0f14]/95 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 shadow-lg"
          style={{ left: hover.left, top: hover.top }}
        >
          <div className="font-mono text-cyan-300">{hover.distance.toFixed(3)}</div>
          <div className="text-zinc-400">
            {hover.pathKind === "pit-lane" ? "Pit lane" : "Racing line"}
          </div>
          {hover.pathKind === "racing-line" && hoverDetails.sector && (
            <div>Sector {hoverDetails.sector.sector}</div>
          )}
          {hover.pathKind === "racing-line" && hoverDetails.corner && (
            <div>Near {hoverDetails.corner.name}</div>
          )}
          {hover.pathKind === "racing-line" && hoverDetails.elevation !== null && (
            <div>{hoverDetails.elevation.toFixed(1)} m elevation</div>
          )}
          {hover.pathKind === "racing-line" && hoverDetails.crossover && (
            <div className="text-pink-300">
              {hoverDetails.crossover.part === "lowerPath" ? "Lower crossover" : "Upper crossover"}
            </div>
          )}
        </div>
      )}

      {/* Ambiguous snap candidate chooser */}
      {editor.pendingSnap && (
        <SnapCandidatePopover
          pending={editor.pendingSnap}
          metadata={metadata}
          onPick={(candidate: SnapCandidate | null) => editor.resolvePendingSnap(candidate)}
        />
      )}
    </div>
  );
}

function CrossoverRange({
  samples,
  section,
  color,
}: {
  samples: { distance: number; x: number; y: number }[];
  section: { start: number; end: number };
  color: string;
}) {
  const points = rangePoints(samples, section.start, section.end);
  if (!points) return null;
  return (
    <polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={6}
      strokeOpacity={0.6}
      strokeLinecap="round"
    />
  );
}
