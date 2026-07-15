"use client";

// State container for the track asset editor. Holds the metadata
// draft (including drawn geometry), tool/selection state, and every mutation
// the panels and canvas need. Kept UI-free so the components stay
// presentational.

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { SnapCandidate, TrackMetadata, TrackPathKind } from "@/lib/tracks/trackMetadata";
import {
  createEmptyTrackMetadata,
  hasDrawnPitLane,
  hasDrawnRacingLine,
  MIN_PIT_LANE_ANCHORS,
  MIN_RACING_LINE_ANCHORS,
} from "@/lib/tracks/trackMetadata";
import type { TrackGeometryPoint } from "@/lib/tracks/geometry";
import { nearestSegmentIndex } from "@/lib/tracks/geometry";
import { renumberSectors } from "@/lib/tracks/trackMath";
import { validateTrackMetadata } from "@/lib/tracks/validation";
import {
  deleteCustomTrack,
  getCustomTrack,
  listBuiltInTrackIds,
  listCustomTrackIds,
  saveCustomTrack,
} from "@/lib/tracks/trackStore";
import type {
  AnchorRef,
  CrossoverDraft,
  EditorMode,
  EditorTool,
  LayerKey,
  MarkerRef,
  PendingSnap,
  SnapPurpose,
} from "@/components/dev/track-editor/editorTypes";
import { CROSSOVER_SEQUENCE, DEFAULT_LAYERS } from "@/components/dev/track-editor/editorTypes";

export type TrackEditorState = ReturnType<typeof useTrackEditor>;

/** Clicking within this radius (SVG user units) of the first anchor closes the loop. */
const CLOSE_LOOP_RADIUS = 18;

export function useTrackEditor() {
  // --- Asset loading ---
  const [builtInIds, setBuiltInIds] = useState<string[]>([]);
  const [customTrackIds, setCustomTrackIds] = useState<string[]>([]);
  const [trackList, setTrackList] = useState<string[]>([]);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // --- Draft state ---
  const [metadata, setMetadata] = useState<TrackMetadata>(() => createEmptyTrackMetadata());

  // --- Editor UI state ---
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedMarker, setSelectedMarker] = useState<MarkerRef | null>(null);
  const [selectedAnchor, setSelectedAnchor] = useState<AnchorRef | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [pendingSnap, setPendingSnap] = useState<PendingSnap | null>(null);
  const [crossoverDraft, setCrossoverDraft] = useState<CrossoverDraft>({});
  const [pendingSectorStart, setPendingSectorStart] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");

  // --- Drawing state ---
  // While false, clicks with the draw tool append anchors; once closed/finished,
  // clicks with the draw tool select/insert/drag anchors instead.
  const [racingClosed, setRacingClosed] = useState(false);
  const [pitFinished, setPitFinished] = useState(false);

  const pitLaneDrawn = hasDrawnPitLane(metadata);
  const racingLineDrawn = hasDrawnRacingLine(metadata) && racingClosed;

  // --- Track list + loading ---

  useEffect(() => {
    let cancelled = false;
    Promise.all([listBuiltInTrackIds(), listCustomTrackIds()])
      .then(([builtIn, custom]) => {
        if (cancelled) return;
        setBuiltInIds(builtIn);
        setCustomTrackIds(custom);
        setTrackList([...new Set([...builtIn, ...custom])].sort());
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not list track assets.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyLoadedAsset = useCallback((id: string | null, meta: TrackMetadata | null) => {
    const nextMetadata = meta ?? createEmptyTrackMetadata(id ?? "");
    setTrackId(id);
    setMetadata(nextMetadata);
    setRacingClosed(nextMetadata.geometry.racingLine.length >= MIN_RACING_LINE_ANCHORS);
    setPitFinished((nextMetadata.geometry.pitLane?.length ?? 0) >= MIN_PIT_LANE_ANCHORS);
    setSelectedMarker(null);
    setSelectedAnchor(null);
    setPendingSnap(null);
    setCrossoverDraft({});
    setPendingSectorStart(null);
    setTool("select");
    setMode("edit");
    setLoadError(null);
    setStatusMessage(null);
  }, []);

  const newTrack = useCallback(() => {
    applyLoadedAsset(null, null);
    setTool("drawRacingLine");
    setStatusMessage("Blank canvas — click to place racing line anchors, close the loop to finish.");
  }, [applyLoadedAsset]);

  const loadTrack = useCallback(
    async (id: string) => {
      setLoadError(null);
      try {
        const custom = await getCustomTrack(id);
        if (custom) {
          applyLoadedAsset(id, custom);
          setStatusMessage(`Loaded custom track "${id}" from browser storage.`);
          return;
        }

        const res = await fetch(`/tracks/${id}/metadata.json`);
        if (!res.ok) {
          setLoadError(`No track asset found for "${id}".`);
          return;
        }
        const metadata = (await res.json()) as TrackMetadata;
        if (!metadata.geometry) {
          metadata.geometry = { racingLine: [], pitLane: null, smoothed: true };
        }
        applyLoadedAsset(id, metadata);
        const isBuiltIn = builtInIds.includes(id);
        setStatusMessage(
          isBuiltIn
            ? `Loaded built-in track "${id}". Edits save as a custom override in your browser.`
            : `Loaded track "${id}".`,
        );
      } catch {
        setLoadError(`Failed to load track "${id}".`);
      }
    },
    [applyLoadedAsset, builtInIds],
  );

  const importMetadataFile = useCallback(
    async (file: File) => {
      try {
        const parsed = JSON.parse(await file.text()) as TrackMetadata;
        if (!parsed.geometry) {
          // Old-format file without drawn geometry; keep the metadata usable.
          parsed.geometry = { racingLine: [], pitLane: null, smoothed: true };
        }
        applyLoadedAsset(parsed.id || null, parsed);
        setStatusMessage(`Imported metadata for "${parsed.id || "untitled"}".`);
      } catch {
        setLoadError("Could not parse metadata.json (invalid JSON).");
      }
    },
    [applyLoadedAsset],
  );

  // --- Metadata mutation helpers ---

  const updateMetadata = useCallback((updater: (draft: TrackMetadata) => void) => {
    setMetadata((current) => {
      const draft = structuredClone(current);
      updater(draft);
      return draft;
    });
  }, []);

  const ensurePit = useCallback((draft: TrackMetadata) => {
    if (!draft.pit) {
      draft.pit = { entry: 0, exit: 0, box: 0, lossSeconds: 22 };
    }
    return draft.pit;
  }, []);

  // --- Geometry drawing ---

  /**
   * Handle a canvas click while a draw tool is active and the path is still
   * being laid down. For the racing line, clicking near the first anchor
   * (with enough anchors placed) closes the loop.
   */
  const appendAnchor = useCallback(
    (pathKind: TrackPathKind, point: TrackGeometryPoint) => {
      if (pathKind === "racing-line") {
        setMetadata((current) => {
          const anchors = current.geometry.racingLine;
          const first = anchors[0];
          if (
            first &&
            anchors.length >= MIN_RACING_LINE_ANCHORS &&
            Math.hypot(point.x - first.x, point.y - first.y) <= CLOSE_LOOP_RADIUS
          ) {
            setRacingClosed(true);
            setStatusMessage("Racing line closed.");
            return current;
          }
          return {
            ...current,
            geometry: {
              ...current.geometry,
              racingLine: [...anchors, { x: point.x, y: point.y }],
            },
          };
        });
      } else {
        setMetadata((current) => {
          const anchors = current.geometry.pitLane ?? [];
          return {
            ...current,
            geometry: {
              ...current.geometry,
              pitLane: [...anchors, { x: point.x, y: point.y }],
            },
          };
        });
      }
    },
    [],
  );

  const closeRacingLoop = useCallback(() => {
    if (metadata.geometry.racingLine.length >= MIN_RACING_LINE_ANCHORS) {
      setRacingClosed(true);
      setStatusMessage("Racing line closed.");
    } else {
      setLoadError(`Place at least ${MIN_RACING_LINE_ANCHORS} anchors before closing the loop.`);
    }
  }, [metadata.geometry.racingLine.length]);

  const finishPitLane = useCallback(() => {
    if ((metadata.geometry.pitLane?.length ?? 0) >= MIN_PIT_LANE_ANCHORS) {
      setPitFinished(true);
      setStatusMessage("Pit lane finished.");
    } else {
      setLoadError(`Place at least ${MIN_PIT_LANE_ANCHORS} anchors for the pit lane.`);
    }
  }, [metadata.geometry.pitLane]);

  const moveAnchor = useCallback((ref: AnchorRef, point: TrackGeometryPoint) => {
    setMetadata((current) => {
      const pathKey = ref.path === "racing-line" ? "racingLine" : "pitLane";
      const anchors = current.geometry[pathKey];
      if (!anchors || !anchors[ref.index]) return current;
      const nextAnchors = anchors.slice();
      nextAnchors[ref.index] = { x: point.x, y: point.y };
      return {
        ...current,
        geometry: { ...current.geometry, [pathKey]: nextAnchors },
      };
    });
  }, []);

  /** Insert an anchor on the segment nearest to `point` (path already drawn). */
  const insertAnchor = useCallback((pathKind: TrackPathKind, point: TrackGeometryPoint) => {
    setMetadata((current) => {
      const anchors =
        pathKind === "racing-line" ? current.geometry.racingLine : current.geometry.pitLane;
      if (!anchors || anchors.length < 2) return current;
      const segment = nearestSegmentIndex(anchors, pathKind === "racing-line", point.x, point.y);
      if (!segment) return current;
      const nextAnchors = anchors.slice();
      nextAnchors.splice(segment.index + 1, 0, { x: point.x, y: point.y });
      setSelectedAnchor({ path: pathKind, index: segment.index + 1 });
      return {
        ...current,
        geometry: {
          ...current.geometry,
          ...(pathKind === "racing-line" ? { racingLine: nextAnchors } : { pitLane: nextAnchors }),
        },
      };
    });
  }, []);

  const deleteAnchor = useCallback((ref: AnchorRef) => {
    setMetadata((current) => {
      const pathKey = ref.path === "racing-line" ? "racingLine" : "pitLane";
      const anchors = current.geometry[pathKey];
      const minimum = ref.path === "racing-line" ? MIN_RACING_LINE_ANCHORS : MIN_PIT_LANE_ANCHORS;
      if (!anchors || anchors.length <= minimum) return current;
      const nextAnchors = anchors.slice();
      nextAnchors.splice(ref.index, 1);
      return {
        ...current,
        geometry: { ...current.geometry, [pathKey]: nextAnchors },
      };
    });
    setSelectedAnchor(null);
  }, []);

  const clearPath = useCallback((pathKind: TrackPathKind) => {
    setMetadata((current) => {
      if (pathKind === "racing-line") {
        return {
          ...current,
          geometry: { ...current.geometry, racingLine: [] },
        };
      }
      return {
        ...current,
        pit: null,
        geometry: { ...current.geometry, pitLane: null },
      };
    });
    if (pathKind === "racing-line") setRacingClosed(false);
    else setPitFinished(false);
    setSelectedAnchor(null);
  }, []);

  const toggleSmoothing = useCallback(() => {
    setMetadata((current) => ({
      ...current,
      geometry: { ...current.geometry, smoothed: !current.geometry.smoothed },
    }));
  }, []);

  // --- Snap resolution ---

  /**
   * Apply one confirmed snap candidate for the given purpose. Called directly
   * when a click had a single unambiguous candidate, or from the candidate
   * popover when the user picked one of several.
   */
  const applySnap = useCallback(
    (candidate: SnapCandidate, purpose: SnapPurpose) => {
      const distance = Number(candidate.distance.toFixed(4));

      if (purpose.type === "reposition") {
        const ref = purpose.ref;
        updateMetadata((draft) => {
          switch (ref.kind) {
            case "startFinish":
              draft.startFinish = { distance };
              break;
            case "sector":
              if (draft.sectors[ref.index]) draft.sectors[ref.index][ref.point] = distance;
              break;
            case "pitEntry":
              ensurePit(draft).entry = distance;
              break;
            case "pitExit":
              ensurePit(draft).exit = distance;
              break;
            case "pitBox":
              ensurePit(draft).box = distance;
              break;
            case "corner":
              draft.corners[ref.index].distance = distance;
              break;
            case "elevationPoint":
              draft.elevationProfile[ref.index].distance = distance;
              break;
            case "crossoverZone": {
              const zone = draft.crossoverZones[ref.index];
              if (ref.point === "lowerStart") zone.lowerPath.start = distance;
              if (ref.point === "lowerEnd") zone.lowerPath.end = distance;
              if (ref.point === "upperStart") zone.upperPath.start = distance;
              if (ref.point === "upperEnd") zone.upperPath.end = distance;
              break;
            }
          }
        });
        setSelectedMarker(purpose.ref);
        return;
      }

      // Tool placement.
      switch (purpose.tool) {
        case "startFinish":
          updateMetadata((draft) => {
            draft.startFinish = { distance };
          });
          setSelectedMarker({ kind: "startFinish" });
          break;
        case "sectorStart":
          setPendingSectorStart(distance);
          setStatusMessage(`Sector start placed at ${distance.toFixed(3)} — now place the sector end.`);
          break;
        case "sectorEnd":
          setPendingSectorStart((start) => {
            if (start === null) {
              setStatusMessage("Place a sector start first.");
              return null;
            }
            setMetadata((current) => {
              const draft = structuredClone(current);
              draft.sectors.push({ sector: draft.sectors.length + 1, start, end: distance });
              draft.sectors = renumberSectors(draft.sectors);
              setSelectedMarker({ kind: "sector", index: draft.sectors.length - 1, point: "end" });
              setStatusMessage(`Sector ${draft.sectors.length} completed.`);
              return draft;
            });
            return null;
          });
          break;
        case "pitEntry":
          updateMetadata((draft) => {
            ensurePit(draft).entry = distance;
          });
          setSelectedMarker({ kind: "pitEntry" });
          break;
        case "pitExit":
          updateMetadata((draft) => {
            ensurePit(draft).exit = distance;
          });
          setSelectedMarker({ kind: "pitExit" });
          break;
        case "pitBox":
          updateMetadata((draft) => {
            ensurePit(draft).box = distance;
          });
          setSelectedMarker({ kind: "pitBox" });
          break;
        case "corner":
          setMetadata((current) => {
            const draft = structuredClone(current);
            draft.corners.push({
              name: `Turn ${draft.corners.length + 1}`,
              distance,
              difficulty: 0.5,
              type: "braking",
            });
            setSelectedMarker({ kind: "corner", index: draft.corners.length - 1 });
            return draft;
          });
          break;
        case "elevationPoint":
          setMetadata((current) => {
            const draft = structuredClone(current);
            draft.elevationProfile.push({ distance, elevationM: 0 });
            draft.elevationProfile.sort((a, b) => a.distance - b.distance);
            const index = draft.elevationProfile.findIndex((p) => p.distance === distance);
            setSelectedMarker({ kind: "elevationPoint", index });
            return draft;
          });
          break;
        case "crossoverZone": {
          // Four clicks in order: lower start, lower end, upper start, upper end.
          setCrossoverDraft((current) => {
            const nextKey = CROSSOVER_SEQUENCE.find((key) => current[key] === undefined);
            if (!nextKey) return current;
            const next = { ...current, [nextKey]: distance };
            if (CROSSOVER_SEQUENCE.every((key) => next[key] !== undefined)) {
              setMetadata((meta) => {
                const draft = structuredClone(meta);
                draft.crossoverZones.push({
                  name: `Crossover ${draft.crossoverZones.length + 1}`,
                  lowerPath: { start: next.lowerStart!, end: next.lowerEnd!, renderLayer: 1 },
                  upperPath: { start: next.upperStart!, end: next.upperEnd!, renderLayer: 3 },
                });
                setSelectedMarker({
                  kind: "crossoverZone",
                  index: draft.crossoverZones.length - 1,
                  point: "lowerStart",
                });
                return draft;
              });
              return {};
            }
            return next;
          });
          break;
        }
      }
    },
    [ensurePit, updateMetadata],
  );

  /**
   * Entry point from the canvas: one or more snap candidates for a click.
   * A single candidate applies immediately; multiple candidates (overlapping
   * track sections) open the disambiguation popover instead of guessing.
   */
  const handleSnapResult = useCallback(
    (candidates: SnapCandidate[], purpose: SnapPurpose, anchorX: number, anchorY: number) => {
      if (candidates.length === 0) return;
      if (candidates.length === 1) {
        applySnap(candidates[0], purpose);
        return;
      }
      setPendingSnap({ candidates, purpose, anchorX, anchorY });
    },
    [applySnap],
  );

  const resolvePendingSnap = useCallback(
    (candidate: SnapCandidate | null) => {
      setPendingSnap((current) => {
        if (candidate && current) applySnap(candidate, current.purpose);
        return null;
      });
    },
    [applySnap],
  );

  // --- Marker deletion ---

  const deleteMarker = useCallback((ref: MarkerRef) => {
    setMetadata((current) => {
      const draft = structuredClone(current);
      switch (ref.kind) {
        case "startFinish":
          draft.startFinish = { distance: 0 };
          break;
        case "sector":
          draft.sectors.splice(ref.index, 1);
          draft.sectors = renumberSectors(draft.sectors);
          break;
        case "pitEntry":
        case "pitExit":
        case "pitBox":
          draft.pit = null;
          break;
        case "corner":
          draft.corners.splice(ref.index, 1);
          break;
        case "elevationPoint":
          draft.elevationProfile.splice(ref.index, 1);
          break;
        case "crossoverZone":
          draft.crossoverZones.splice(ref.index, 1);
          break;
      }
      return draft;
    });
    setSelectedMarker(null);
  }, []);

  const cancelDrafts = useCallback(() => {
    setCrossoverDraft({});
    setPendingSectorStart(null);
    setPendingSnap(null);
    setSelectedAnchor(null);
  }, []);

  // --- Validation + export ---

  const deferredMetadata = useDeferredValue(metadata);
  const validation = useMemo(() => validateTrackMetadata(deferredMetadata), [deferredMetadata]);

  const exportMetadata = useCallback(() => {
    if (!validation.valid) return false;
    const blob = new Blob([JSON.stringify(metadata, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "metadata.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Exported metadata.json.");
    return true;
  }, [metadata, validation]);

  const saveTrack = useCallback(async () => {
    const id = metadata.id || trackId;
    if (!id || !validation.valid) return false;
    try {
      await saveCustomTrack({ ...metadata, id });
      setTrackId(id);
      setCustomTrackIds((list) => (list.includes(id) ? list : [...list, id].sort()));
      setTrackList((list) => (list.includes(id) ? list : [...list, id].sort()));
      setStatusMessage(`Saved custom track "${id}" to browser storage (IndexedDB).`);
      setLoadError(null);
      return true;
    } catch {
      setLoadError("Save failed (could not write to browser storage).");
      return false;
    }
  }, [metadata, trackId, validation]);

  const deleteTrack = useCallback(
    async (id: string) => {
      if (!customTrackIds.includes(id)) {
        setLoadError(`"${id}" is a built-in track and cannot be deleted from the browser.`);
        return false;
      }
      try {
        await deleteCustomTrack(id);
        setCustomTrackIds((list) => list.filter((entry) => entry !== id));
        if (trackId === id) {
          applyLoadedAsset(null, null);
        }
        setTrackList((list) => {
          const next = list.filter((entry) => entry !== id);
          return builtInIds.includes(id) ? [...next, id].sort() : next;
        });
        setStatusMessage(`Deleted custom track "${id}" from browser storage.`);
        setLoadError(null);
        return true;
      } catch {
        setLoadError(`Failed to delete track "${id}".`);
        return false;
      }
    },
    [applyLoadedAsset, builtInIds, customTrackIds, trackId],
  );

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  return {
    // Loading
    builtInIds,
    customTrackIds,
    trackList,
    trackId,
    loadError,
    statusMessage,
    newTrack,
    loadTrack,
    deleteTrack,
    importMetadataFile,
    // Draft
    metadata,
    updateMetadata,
    // Drawing
    racingClosed,
    pitFinished,
    racingLineDrawn,
    pitLaneDrawn,
    appendAnchor,
    closeRacingLoop,
    finishPitLane,
    moveAnchor,
    insertAnchor,
    deleteAnchor,
    clearPath,
    toggleSmoothing,
    selectedAnchor,
    setSelectedAnchor,
    // Tools & selection
    tool,
    setTool,
    selectedMarker,
    setSelectedMarker,
    deleteMarker,
    // Snapping
    pendingSnap,
    handleSnapResult,
    resolvePendingSnap,
    crossoverDraft,
    pendingSectorStart,
    cancelDrafts,
    // Layers, validation, export
    layers,
    toggleLayer,
    validation,
    exportMetadata,
    saveTrack,
    // Mode
    mode,
    setMode,
  };
}
