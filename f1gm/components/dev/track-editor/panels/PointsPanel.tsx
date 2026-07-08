"use client";

// Metadata point lists + inline editing for the currently selected marker.

import type { CornerType } from "@/lib/tracks/trackMetadata";
import { CORNER_TYPES } from "@/lib/tracks/trackMetadata";
import type { MarkerRef } from "@/components/dev/track-editor/editorTypes";
import { markerRefEquals } from "@/components/dev/track-editor/editorTypes";
import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import {
  FieldRow,
  NumberInput,
  PanelSection,
  SliderRow,
  SmallButton,
  TextInput,
} from "@/components/dev/track-editor/panels/fields";

function RowButton({
  selected,
  onSelect,
  onDelete,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs ${
        selected ? "border-cyan-600 bg-cyan-900/20" : "border-zinc-700 bg-[#10151d]"
      }`}
    >
      <button type="button" className="flex-1 text-left text-zinc-200" onClick={onSelect}>
        {children}
      </button>
      <SmallButton tone="danger" onClick={onDelete}>
        ×
      </SmallButton>
    </div>
  );
}

export function PointsPanel({ editor }: { editor: TrackEditorState }) {
  const { metadata, selectedMarker, setSelectedMarker, deleteMarker, updateMetadata } = editor;
  const isSelected = (ref: MarkerRef) => markerRefEquals(ref, selectedMarker);

  return (
    <div className="flex flex-col gap-3">
      <PanelSection title="Key points">
        <div className="flex flex-col gap-1.5 text-xs text-zinc-300">
          <RowButton
            selected={isSelected({ kind: "startFinish" })}
            onSelect={() => setSelectedMarker({ kind: "startFinish" })}
            onDelete={() => deleteMarker({ kind: "startFinish" })}
          >
            Start/finish <span className="font-mono text-cyan-300">{metadata.startFinish.distance.toFixed(3)}</span>
          </RowButton>
          {metadata.pit ? (
            <>
              <RowButton
                selected={isSelected({ kind: "pitEntry" })}
                onSelect={() => setSelectedMarker({ kind: "pitEntry" })}
                onDelete={() => deleteMarker({ kind: "pitEntry" })}
              >
                Pit entry <span className="font-mono text-cyan-300">{metadata.pit.entry.toFixed(3)}</span>
              </RowButton>
              <RowButton
                selected={isSelected({ kind: "pitExit" })}
                onSelect={() => setSelectedMarker({ kind: "pitExit" })}
                onDelete={() => deleteMarker({ kind: "pitExit" })}
              >
                Pit exit <span className="font-mono text-cyan-300">{metadata.pit.exit.toFixed(3)}</span>
              </RowButton>
              <RowButton
                selected={isSelected({ kind: "pitBox" })}
                onSelect={() => setSelectedMarker({ kind: "pitBox" })}
                onDelete={() => deleteMarker({ kind: "pitBox" })}
              >
                Pit box (pit lane) <span className="font-mono text-cyan-300">{metadata.pit.box.toFixed(3)}</span>
              </RowButton>
              <FieldRow label="Pit loss (s)">
                <NumberInput
                  value={metadata.pit.lossSeconds}
                  step={0.1}
                  min={0}
                  onChange={(value) =>
                    updateMetadata((draft) => {
                      if (draft.pit) draft.pit.lossSeconds = value;
                    })
                  }
                />
              </FieldRow>
            </>
          ) : (
            <p className="text-zinc-500">
              No pit metadata yet. Draw a pit lane, then use the pit entry/exit/box tools.
            </p>
          )}
        </div>
      </PanelSection>

      <PanelSection title={`Sectors (${metadata.sectors.length})`}>
        <div className="flex flex-col gap-1.5">
          {editor.pendingSectorStart !== null && (
            <p className="rounded border border-violet-800 bg-violet-950/30 px-2 py-1 text-[11px] text-violet-200">
              Sector start placed at{" "}
              <span className="font-mono">{editor.pendingSectorStart.toFixed(3)}</span> — use the
              &quot;Sector end&quot; tool to complete sector {metadata.sectors.length + 1}.
            </p>
          )}
          {metadata.sectors.map((sector, index) => {
            const startRef: MarkerRef = { kind: "sector", index, point: "start" };
            const endRef: MarkerRef = { kind: "sector", index, point: "end" };
            const rowSelected = isSelected(startRef) || isSelected(endRef);
            return (
              <div key={index} className="flex flex-col gap-1.5">
                <RowButton
                  selected={rowSelected}
                  onSelect={() => setSelectedMarker(startRef)}
                  onDelete={() => deleteMarker(startRef)}
                >
                  Sector {sector.sector}{" "}
                  <span className="font-mono text-cyan-300">
                    {sector.start.toFixed(3)}→{sector.end.toFixed(3)}
                  </span>
                </RowButton>
                {rowSelected && (
                  <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-700 bg-[#10151d] p-2">
                    <FieldRow label="Start">
                      <NumberInput
                        value={sector.start}
                        min={0}
                        max={1}
                        onChange={(value) =>
                          updateMetadata((draft) => {
                            draft.sectors[index].start = value;
                          })
                        }
                      />
                    </FieldRow>
                    <FieldRow label="End">
                      <NumberInput
                        value={sector.end}
                        min={0}
                        max={1}
                        onChange={(value) =>
                          updateMetadata((draft) => {
                            draft.sectors[index].end = value;
                          })
                        }
                      />
                    </FieldRow>
                  </div>
                )}
              </div>
            );
          })}
          {metadata.sectors.length === 0 && (
            <p className="text-xs text-zinc-500">
              Place a &quot;Sector start&quot; then a &quot;Sector end&quot; on the track — repeat
              for as many sectors as you need.
            </p>
          )}
        </div>
      </PanelSection>

      <PanelSection title={`Corners (${metadata.corners.length})`}>
        <div className="flex flex-col gap-1.5">
          {metadata.corners.map((corner, index) => {
            const ref: MarkerRef = { kind: "corner", index };
            return (
              <div key={index} className="flex flex-col gap-1.5">
                <RowButton selected={isSelected(ref)} onSelect={() => setSelectedMarker(ref)} onDelete={() => deleteMarker(ref)}>
                  {corner.name} <span className="font-mono text-cyan-300">{corner.distance.toFixed(3)}</span>
                </RowButton>
                {isSelected(ref) && (
                  <div className="flex flex-col gap-1.5 rounded border border-zinc-700 bg-[#10151d] p-2">
                    <FieldRow label="Name">
                      <TextInput
                        value={corner.name}
                        onChange={(value) =>
                          updateMetadata((draft) => {
                            draft.corners[index].name = value;
                          })
                        }
                      />
                    </FieldRow>
                    <FieldRow label="Distance">
                      <NumberInput
                        value={corner.distance}
                        min={0}
                        max={1}
                        onChange={(value) =>
                          updateMetadata((draft) => {
                            draft.corners[index].distance = value;
                          })
                        }
                      />
                    </FieldRow>
                    <SliderRow
                      label="Difficulty"
                      value={corner.difficulty}
                      onChange={(value) =>
                        updateMetadata((draft) => {
                          draft.corners[index].difficulty = value;
                        })
                      }
                    />
                    <FieldRow label="Type">
                      <select
                        value={corner.type}
                        onChange={(event) =>
                          updateMetadata((draft) => {
                            draft.corners[index].type = event.target.value as CornerType;
                          })
                        }
                        className="ui-input rounded border border-zinc-600 bg-[#10151d] px-2 py-1 text-xs text-zinc-200"
                      >
                        {CORNER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </FieldRow>
                  </div>
                )}
              </div>
            );
          })}
          {metadata.corners.length === 0 && <p className="text-xs text-zinc-500">Use the corner tool, then click the track.</p>}
        </div>
      </PanelSection>
    </div>
  );
}
