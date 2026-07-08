"use client";

// Track asset editor shell: toolbar, tool selector, drawing canvas,
// and tabbed side panels. Custom tracks persist in the browser (IndexedDB).
import { useRef, useState } from "react";
import { useTrackEditor } from "@/components/dev/track-editor/useTrackEditor";
import { usePreview } from "@/components/dev/track-editor/usePreview";
import { SvgCanvas } from "@/components/dev/track-editor/SvgCanvas";
import {
  DRAW_TOOLS,
  TOOL_LABELS,
  type EditorTool,
} from "@/components/dev/track-editor/editorTypes";
import { PointsPanel } from "@/components/dev/track-editor/panels/PointsPanel";
import { ElevationPanel } from "@/components/dev/track-editor/panels/ElevationPanel";
import { CrossoverPanel } from "@/components/dev/track-editor/panels/CrossoverPanel";
import { ValidationPanel } from "@/components/dev/track-editor/panels/ValidationPanel";
import { LayerTogglesPanel, TrackInfoPanel } from "@/components/dev/track-editor/panels/TrackInfoPanel";
import { PreviewPanel } from "@/components/dev/track-editor/panels/PreviewPanel";
import { SmallButton } from "@/components/dev/track-editor/panels/fields";

const TOOLS: EditorTool[] = [
  "select",
  "drawRacingLine",
  "drawPitLane",
  "startFinish",
  "sectorStart",
  "sectorEnd",
  "corner",
  "elevationPoint",
  "crossoverZone",
  "pitEntry",
  "pitExit",
  "pitBox",
];

/** Tools that need a drawn path before they can snap anything to it. */
const NEEDS_RACING_LINE: EditorTool[] = [
  "select",
  "startFinish",
  "sectorStart",
  "sectorEnd",
  "corner",
  "elevationPoint",
  "crossoverZone",
  "pitEntry",
  "pitExit",
];

type PanelTab = "points" | "elevation" | "crossover" | "validation" | "layers";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "points", label: "Points" },
  { id: "elevation", label: "Elevation" },
  { id: "crossover", label: "Crossover" },
  { id: "validation", label: "Validation" },
  { id: "layers", label: "Layers" },
];

export function TrackEditor() {
  const editor = useTrackEditor();
  const preview = usePreview(editor.metadata, editor.mode === "preview");
  const [tab, setTab] = useState<PanelTab>("points");
  const jsonFileInput = useRef<HTMLInputElement>(null);

  const drawingRacing = editor.tool === "drawRacingLine" && !editor.racingClosed;
  const drawingPit = editor.tool === "drawPitLane" && !editor.pitFinished;

  return (
    <div className="flex h-full min-h-screen flex-col gap-3 bg-[#0e131a] p-4 text-zinc-200">
      {/* Header / toolbar */}
      <header className="flex flex-wrap items-center gap-3 rounded border border-zinc-700 bg-[#151a23] px-3 py-2">
        <div>
          <h1 className="text-sm font-semibold tracking-wide">Track Asset Editor</h1>
          <p className="text-[10px] uppercase tracking-widest text-amber-500">
            Create custom tracks — saved in your browser
          </p>        </div>

        <div className="flex items-center gap-2">
          <SmallButton tone="accent" onClick={editor.newTrack}>
            New track
          </SmallButton>
          <select
            value={editor.trackId ?? ""}
            onChange={(event) => event.target.value && editor.loadTrack(event.target.value)}
            className="ui-input rounded border border-zinc-600 bg-[#10151d] px-2 py-1 text-xs"
          >
            <option value="">Load track asset…</option>
            {editor.trackList.map((id) => {
              const isBuiltIn = editor.builtInIds.includes(id);
              const isCustom = editor.customTrackIds.includes(id);
              const label = isBuiltIn && !isCustom ? `${id} (built-in)` : id;
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              );
            })}
          </select>
          {editor.trackId && editor.customTrackIds.includes(editor.trackId) && (
            <SmallButton
              tone="danger"
              title={`Delete custom track "${editor.trackId}" from browser storage`}
              onClick={() => void editor.deleteTrack(editor.trackId!)}
            >
              Delete
            </SmallButton>
          )}          <SmallButton onClick={() => jsonFileInput.current?.click()}>Import metadata.json</SmallButton>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded border border-zinc-600 p-0.5 text-xs" role="tablist">
            {(["edit", "preview"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={editor.mode === mode}
                onClick={() => editor.setMode(mode)}
                className={
                  editor.mode === mode
                    ? "rounded bg-zinc-700 px-2.5 py-1 text-zinc-100"
                    : "ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
                }
              >
                {mode === "edit" ? "Edit" : "Preview"}
              </button>
            ))}
          </div>
          <SmallButton
            tone="accent"
            disabled={!editor.validation.valid}
            title={editor.validation.valid ? "Download metadata.json" : "Fix validation errors first"}
            onClick={() => {
              if (!editor.exportMetadata()) setTab("validation");
            }}
          >
            Export metadata.json
          </SmallButton>
          <SmallButton
            disabled={!editor.validation.valid || !(editor.metadata.id || editor.trackId)}
            title="Save this track to browser storage (IndexedDB)"
            onClick={async () => {
              const ok = await editor.saveTrack();
              if (!ok) setTab("validation");
            }}
          >
            Save track
          </SmallButton>        </div>
      </header>

      {(editor.loadError || editor.statusMessage) && (
        <div
          className={`rounded border px-3 py-1.5 text-xs ${
            editor.loadError
              ? "border-red-800 bg-red-950/40 text-red-300"
              : "border-emerald-800 bg-emerald-950/30 text-emerald-300"
          }`}
        >
          {editor.loadError ?? editor.statusMessage}
        </div>
      )}

      {/* Tool selector */}
      {editor.mode === "edit" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-zinc-700 bg-[#151a23] px-3 py-2">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-zinc-500">Tool</span>
          {TOOLS.map((tool) => {
            const isDraw = DRAW_TOOLS.includes(tool);
            const disabled =
              (!isDraw && NEEDS_RACING_LINE.includes(tool) && !editor.racingLineDrawn) ||
              (tool === "pitBox" && !editor.pitLaneDrawn);
            const active = editor.tool === tool;
            return (
              <button
                key={tool}
                type="button"
                disabled={disabled}
                title={
                  disabled
                    ? tool === "pitBox"
                      ? "Draw a pit lane first"
                      : "Draw and close the racing line first"
                    : undefined
                }
                onClick={() => {
                  editor.setTool(tool);
                  editor.cancelDrafts();
                }}
                className={`ui-interactive rounded border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? "border-cyan-500 bg-cyan-900/30 text-cyan-200"
                    : "border-zinc-600 bg-[#10151d] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {TOOL_LABELS[tool]}
              </button>
            );
          })}

          {/* Drawing controls */}
          <span className="mx-1 h-4 w-px bg-zinc-700" />
          <SmallButton onClick={editor.toggleSmoothing} title="Toggle smooth curves vs straight segments">
            {editor.metadata.geometry.smoothed ? "Smoothed" : "Straight"}
          </SmallButton>
          {editor.tool === "drawRacingLine" && (
            <>
              {drawingRacing && (
                <SmallButton tone="accent" onClick={editor.closeRacingLoop}>
                  Close loop
                </SmallButton>
              )}
              <SmallButton tone="danger" onClick={() => editor.clearPath("racing-line")}>
                Clear racing line
              </SmallButton>
            </>
          )}
          {editor.tool === "drawPitLane" && (
            <>
              {drawingPit && (
                <SmallButton tone="accent" onClick={editor.finishPitLane}>
                  Finish pit lane
                </SmallButton>
              )}
              <SmallButton tone="danger" onClick={() => editor.clearPath("pit-lane")}>
                Clear pit lane
              </SmallButton>
            </>
          )}

          {/* Contextual hints */}
          {drawingRacing && (
            <span className="ml-2 text-[11px] text-emerald-400">
              Click to place anchors ({editor.metadata.geometry.racingLine.length} placed) — click the
              first anchor or &quot;Close loop&quot; to finish.
            </span>
          )}
          {drawingPit && (
            <span className="ml-2 text-[11px] text-emerald-400">
              Click to place pit lane anchors ({editor.metadata.geometry.pitLane?.length ?? 0} placed), in
              the direction of travel.
            </span>
          )}
          {((editor.tool === "drawRacingLine" && editor.racingClosed) ||
            (editor.tool === "drawPitLane" && editor.pitFinished)) && (
            <span className="ml-2 text-[11px] text-zinc-400">
              Drag anchors to reshape, click the path to insert an anchor, Delete to remove one.
            </span>
          )}
          {editor.tool === "sectorStart" && (
            <span className="ml-2 text-[11px] text-violet-300">
              Click the track to place the start of sector {editor.metadata.sectors.length + 1}.
            </span>
          )}
          {editor.tool === "sectorEnd" && (
            <span className="ml-2 text-[11px] text-violet-300">
              {editor.pendingSectorStart !== null
                ? `Click the track to place the end of sector ${editor.metadata.sectors.length + 1}.`
                : "Place a sector start first."}
            </span>
          )}
          {editor.tool === "select" && editor.selectedMarker && (
            <span className="ml-2 text-[11px] text-zinc-400">
              Click the track to reposition the selected marker, or press Delete to remove it.
            </span>
          )}
        </div>
      )}

      {/* Canvas + side panel. The canvas stays pinned while the panel scrolls. */}
      <div className="flex min-h-0 flex-1 items-start gap-3">
        <div className="sticky top-3 h-[calc(100vh-190px)] min-h-[420px] min-w-0 flex-1">
          <SvgCanvas editor={editor} cars={editor.mode === "preview" ? preview.cars : []} />
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto standings-scroll">
          {editor.mode === "preview" ? (
            <PreviewPanel editor={editor} preview={preview} />
          ) : (
            <>
              <div className="flex flex-wrap gap-1" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`ui-tab rounded px-2 py-1 text-[11px] ${
                      tab === t.id ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.label}
                    {t.id === "validation" && editor.validation.errors.length > 0 && (
                      <span className="ml-1 rounded bg-red-900 px-1 text-red-200">{editor.validation.errors.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {tab === "points" && (
                <>
                  <TrackInfoPanel editor={editor} />
                  <PointsPanel editor={editor} />
                </>
              )}
              {tab === "elevation" && <ElevationPanel editor={editor} />}
              {tab === "crossover" && <CrossoverPanel editor={editor} />}
              {tab === "validation" && <ValidationPanel editor={editor} />}
              {tab === "layers" && <LayerTogglesPanel editor={editor} />}
            </>
          )}
        </aside>
      </div>

      {/* Hidden file input */}
      <input
        ref={jsonFileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) editor.importMetadataFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
