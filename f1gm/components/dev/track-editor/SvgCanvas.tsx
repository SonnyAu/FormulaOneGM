"use client";

// Track editor canvas: wraps the game-facing TrackMap renderer and layers the
// editing UI on top — geometry anchor handles (draw/reshape), metadata
// markers, hover tooltip, and the ambiguous-snap popover.
//
// Anchor drag updates the SVG path `d` and handle transform directly in the
// DOM (no React metadata commits per frame). Geometry is committed once on
// pointerup so reshape stays smooth.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SnapCandidate, TrackMetadata, TrackPathKind } from "@/lib/tracks/trackMetadata";
import { geometryToPathD, type TrackGeometryPoint } from "@/lib/tracks/geometry";
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
import {
  rangePoints,
  TrackMap,
  useTrackPaths,
  type TrackMapCar,
  type TrackPaths,
} from "@/components/tracks/TrackMap";
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

type HoverDetails = {
  sector: ReturnType<typeof getSectorAtDistance>;
  corner: ReturnType<typeof findNearestCorner>;
  elevation: number | null;
  crossover: ReturnType<typeof getCrossoverSectionAtDistance>;
};

type DragSession = {
  anchor: AnchorRef;
  moved: boolean;
  /** Draft anchors for the path being edited (mutated during drag). */
  anchors: TrackGeometryPoint[];
  closed: boolean;
  smoothed: boolean;
};

/** How close (SVG units) a click must be to an anchor to select it. */
const ANCHOR_HIT_RADIUS = 12;

/** Editor hover/snap sample density — denser sampling stays in game TrackMap default (800). */
const EDITOR_SAMPLE_COUNT = 80;

function applyLivePathD(svg: SVGSVGElement, pathKind: TrackPathKind, d: string) {
  if (pathKind === "racing-line") {
    svg
      .querySelectorAll('[data-track-path="asphalt"], [data-track-path="racing-line"]')
      .forEach((el) => el.setAttribute("d", d));
  } else {
    svg.querySelector('[data-track-path="pit-lane"]')?.setAttribute("d", d);
  }
}

export function SvgCanvas({ editor, cars }: { editor: TrackEditorState; cars: TrackMapCar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  /** Frozen path samples for the duration of a drag (sectors/markers stay put). */
  const [dragSnapshot, setDragSnapshot] = useState<TrackPaths | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const pendingDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const hoverPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const hoverRef = useRef<HoverInfo | null>(null);

  const { metadata, layers, tool, selectedMarker, mode } = editor;
  const computedPaths = useTrackPaths(metadata, EDITOR_SAMPLE_COUNT);
  const paths = dragSnapshot ?? computedPaths;
  const { racingPath, pitPath, racingSamples, pitSamples } = paths;

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

  /** Paint draft anchors onto the live SVG without a React commit. */
  const paintDragOverlay = useCallback((session: DragSession) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { anchor, anchors, closed, smoothed } = session;
    const d = geometryToPathD(anchors, closed, smoothed);
    applyLivePathD(svg, anchor.path, d);
    const handle = svg.querySelector(`[data-anchor-index="${anchor.index}"]`);
    const point = anchors[anchor.index];
    if (handle && point) {
      handle.setAttribute("transform", `translate(${point.x}, ${point.y})`);
    }
  }, []);

  const flushDragMove = useCallback(() => {
    dragRafRef.current = null;
    const drag = dragRef.current;
    const point = pendingDragPointRef.current;
    if (!drag || !point) return;
    drag.anchors[drag.anchor.index] = { x: point.x, y: point.y };
    paintDragOverlay(drag);
  }, [paintDragOverlay]);

  // --- Anchor dragging (DOM overlay; commit on pointerup) ---

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = toSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      drag.moved = true;
      pendingDragPointRef.current = point;
      if (dragRafRef.current == null) {
        dragRafRef.current = requestAnimationFrame(flushDragMove);
      }
    },
    [toSvgPoint, flushDragMove],
  );

  const handlePointerUp = useCallback(() => {
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
      flushDragMove();
    }
    const drag = dragRef.current;
    const finalPoint = pendingDragPointRef.current;
    pendingDragPointRef.current = null;
    setDragSnapshot(null);
    if (!drag) return;
    const moved = drag.moved;
    if (moved && finalPoint) {
      editor.moveAnchor(drag.anchor, finalPoint);
    }
    dragRef.current = moved ? drag : null;
    // Keep the drag record until after the synthetic click fires, then clear.
    if (moved) setTimeout(() => (dragRef.current = null), 0);
  }, [flushDragMove, editor]);

  const startAnchorDrag = useCallback(
    (anchor: AnchorRef) => (event: React.PointerEvent) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const source =
        anchor.path === "racing-line"
          ? metadata.geometry.racingLine
          : metadata.geometry.pitLane ?? [];
      dragRef.current = {
        anchor,
        moved: false,
        anchors: source.map((p) => ({ x: p.x, y: p.y })),
        closed: anchor.path === "racing-line",
        smoothed: metadata.geometry.smoothed,
      };
      pendingDragPointRef.current = null;
      setDragSnapshot(computedPaths);
      editor.setSelectedAnchor(anchor);
    },
    [editor, metadata.geometry, computedPaths],
  );

  const applyHoverFromPointer = useCallback(() => {
    hoverRafRef.current = null;
    const pointer = hoverPointerRef.current;
    if (!pointer || dragRef.current) return;

    if (racingSamples.length === 0) {
      if (hoverRef.current !== null) {
        hoverRef.current = null;
        setHover(null);
      }
      return;
    }

    const point = toSvgPoint(pointer.clientX, pointer.clientY);
    if (!point) return;
    const radius = svgRadius(18);

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
    const next: HoverInfo | null =
      best && rect
        ? {
            left: pointer.clientX - rect.left + 14,
            top: pointer.clientY - rect.top + 14,
            distance: best.distance,
            pathKind: best.pathKind,
          }
        : null;

    const prev = hoverRef.current;
    if (
      (prev === null && next === null) ||
      (prev !== null &&
        next !== null &&
        prev.pathKind === next.pathKind &&
        Math.abs(prev.distance - next.distance) <= 0.002 &&
        Math.abs(prev.left - next.left) <= 2 &&
        Math.abs(prev.top - next.top) <= 2)
    ) {
      return;
    }

    hoverRef.current = next;
    setHover(next);
  }, [racingSamples, pitSamples, toSvgPoint, svgRadius]);

  // --- Hover tooltip (RAF-throttled; skipped during drag) ---
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (dragRef.current) return;
      hoverPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (hoverRafRef.current == null) {
        hoverRafRef.current = requestAnimationFrame(applyHoverFromPointer);
      }
    },
    [applyHoverFromPointer],
  );

  const handleMouseLeave = useCallback(() => {
    hoverPointerRef.current = null;
    if (hoverRafRef.current != null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    hoverRef.current = null;
    setHover(null);
  }, []);

  useEffect(() => {
    return () => {
      if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current);
      if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current);
    };
  }, []);

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

  const hoverDetails = useMemo<HoverDetails | null>(() => {
    if (!hover) return null;
    return {
      sector: getSectorAtDistance(metadata, hover.distance),
      corner: findNearestCorner(metadata, hover.distance),
      elevation: getElevationAtDistance(metadata, hover.distance),
      crossover: getCrossoverSectionAtDistance(metadata.crossoverZones, hover.distance),
    };
  }, [hover, metadata]);

  const markerBaseRadius = 6;
  const showAnchors = activeDrawPath !== null;

  const onSelectMarker = useCallback(
    (ref: MarkerRef) => {
      editor.setSelectedMarker(ref);
      editor.setTool("select");
    },
    [editor],
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded border border-zinc-700 bg-[#10151d] outline-none"
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <EditorTrackScene
        metadata={metadata}
        paths={paths}
        cars={cars}
        layers={layers}
        mode={mode}
        markers={markers}
        selectedMarker={selectedMarker}
        selectedAnchor={editor.selectedAnchor}
        activeDrawPath={activeDrawPath}
        showAnchors={showAnchors}
        drawingInProgress={drawingInProgress}
        anchors={activeDrawPath ? anchorsFor(activeDrawPath) : []}
        racingSamples={racingSamples}
        markerBaseRadius={markerBaseRadius}
        svgRef={svgRef}
        onSelectMarker={onSelectMarker}
        onStartAnchorDrag={startAnchorDrag}
        markerPosition={markerPosition}
      />

      {metadata.geometry.racingLine.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Pick &quot;Draw racing line&quot; and click to place anchors, or load a track asset.
        </div>
      )}

      <HoverTooltip hover={hover} details={hoverDetails} />

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

/** Memoized scene so hover `setHover` does not re-reconcile TrackMap. */
const EditorTrackScene = memo(function EditorTrackScene({
  metadata,
  paths,
  cars,
  layers,
  mode,
  markers,
  selectedMarker,
  selectedAnchor,
  activeDrawPath,
  showAnchors,
  drawingInProgress,
  anchors,
  racingSamples,
  markerBaseRadius,
  svgRef,
  onSelectMarker,
  onStartAnchorDrag,
  markerPosition,
}: {
  metadata: TrackMetadata;
  paths: TrackPaths;
  cars: TrackMapCar[];
  layers: TrackEditorState["layers"];
  mode: TrackEditorState["mode"];
  markers: MarkerVM[];
  selectedMarker: MarkerRef | null;
  selectedAnchor: AnchorRef | null;
  activeDrawPath: TrackPathKind | null;
  showAnchors: boolean;
  drawingInProgress: boolean;
  anchors: TrackGeometryPoint[];
  racingSamples: TrackPaths["racingSamples"];
  markerBaseRadius: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onSelectMarker: (ref: MarkerRef) => void;
  onStartAnchorDrag: (anchor: AnchorRef) => (event: React.PointerEvent) => void;
  markerPosition: (marker: MarkerVM) => { x: number; y: number } | null;
}) {
  return (
    <TrackMap
      metadata={metadata}
      paths={paths}
      cars={cars}
      showRacingLine={layers.racingLine}
      showPitLane={layers.pitLane}
      showSectors={layers.sectors}
      showBridges={layers.bridgeOverlays}
      showCars={layers.previewCars}
      svgRef={svgRef}
      className="h-full w-full p-2"
    >
      {mode === "edit" &&
        layers.crossoverZones &&
        metadata.crossoverZones.map((zone, i) => (
          <g key={`crossover-${i}`}>
            <CrossoverRange samples={racingSamples} section={zone.lowerPath} color="#c084fc" />
            <CrossoverRange samples={racingSamples} section={zone.upperPath} color="#f472b6" />
          </g>
        ))}

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
                onSelectMarker(marker.ref);
              }}
            >
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

      {mode === "edit" &&
        showAnchors &&
        activeDrawPath &&
        anchors.map((anchor, index) => {
          const isSelected = selectedAnchor?.path === activeDrawPath && selectedAnchor.index === index;
          const isFirstRacing = activeDrawPath === "racing-line" && index === 0 && drawingInProgress;
          return (
            <g
              key={`anchor-${index}`}
              data-anchor-index={index}
              transform={`translate(${anchor.x}, ${anchor.y})`}
            >
              {isFirstRacing && (
                <circle r={14} fill="none" stroke="#4ade80" strokeWidth={1.5} strokeDasharray="3 3" />
              )}
              <circle
                r={isSelected ? 8 : 5.5}
                fill={isSelected ? "#ffffff" : "#94a3b8"}
                stroke="#0b0f14"
                strokeWidth={1.5}
                style={{ cursor: "grab" }}
                onPointerDown={onStartAnchorDrag({ path: activeDrawPath, index })}
                onClick={(event) => event.stopPropagation()}
              />
            </g>
          );
        })}
    </TrackMap>
  );
});

const HoverTooltip = memo(function HoverTooltip({
  hover,
  details,
}: {
  hover: HoverInfo | null;
  details: HoverDetails | null;
}) {
  if (!hover || !details) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded border border-zinc-600 bg-[#0b0f14]/95 px-2 py-1.5 text-[11px] leading-4 text-zinc-200 shadow-lg"
      style={{ left: hover.left, top: hover.top }}
    >
      <div className="font-mono text-cyan-300">{hover.distance.toFixed(3)}</div>
      <div className="text-zinc-400">{hover.pathKind === "pit-lane" ? "Pit lane" : "Racing line"}</div>
      {hover.pathKind === "racing-line" && details.sector && <div>Sector {details.sector.sector}</div>}
      {hover.pathKind === "racing-line" && details.corner && <div>Near {details.corner.name}</div>}
      {hover.pathKind === "racing-line" && details.elevation !== null && (
        <div>{details.elevation.toFixed(1)} m elevation</div>
      )}
      {hover.pathKind === "racing-line" && details.crossover && (
        <div className="text-pink-300">
          {details.crossover.part === "lowerPath" ? "Lower crossover" : "Upper crossover"}
        </div>
      )}
    </div>
  );
});

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
