"use client";

// Crossover zone editor for overlapping track sections (Suzuka's
// figure-eight). Zones are created with four snapped clicks (lower start,
// lower end, upper start, upper end); values and render layers are editable
// here afterwards.

import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import { CROSSOVER_SEQUENCE } from "@/components/dev/track-editor/editorTypes";
import {
  FieldRow,
  NumberInput,
  PanelSection,
  SmallButton,
  TextInput,
} from "@/components/dev/track-editor/panels/fields";

const SEQUENCE_LABELS: Record<(typeof CROSSOVER_SEQUENCE)[number], string> = {
  lowerStart: "lower start",
  lowerEnd: "lower end",
  upperStart: "upper start",
  upperEnd: "upper end",
};

export function CrossoverPanel({ editor }: { editor: TrackEditorState }) {
  const { metadata, updateMetadata, deleteMarker, crossoverDraft, tool } = editor;

  const nextClick = CROSSOVER_SEQUENCE.find((key) => crossoverDraft[key] === undefined);

  return (
    <PanelSection title={`Crossover zones (${metadata.crossoverZones.length})`}>
      <div className="flex flex-col gap-2">
        {tool === "crossoverZone" && (
          <div className="rounded border border-pink-800 bg-pink-950/30 p-2 text-[11px] text-pink-200">
            {nextClick ? (
              <>
                Click the track to place the <span className="font-semibold">{SEQUENCE_LABELS[nextClick]}</span> point.
                {Object.entries(crossoverDraft).map(([key, value]) => (
                  <div key={key} className="font-mono text-pink-300">
                    {SEQUENCE_LABELS[key as keyof typeof SEQUENCE_LABELS]}: {value?.toFixed(3)}
                  </div>
                ))}
              </>
            ) : (
              "Zone completed."
            )}
          </div>
        )}

        {metadata.crossoverZones.map((zone, index) => (
          <div key={index} className="flex flex-col gap-1.5 rounded border border-zinc-700 bg-[#10151d] p-2">
            <div className="flex items-center justify-between gap-2">
              <TextInput
                value={zone.name}
                onChange={(value) =>
                  updateMetadata((draft) => {
                    draft.crossoverZones[index].name = value;
                  })
                }
              />
              <SmallButton
                tone="danger"
                onClick={() => deleteMarker({ kind: "crossoverZone", index, point: "lowerStart" })}
              >
                ×
              </SmallButton>
            </div>
            {(["lowerPath", "upperPath"] as const).map((part) => (
              <div key={part} className="rounded border border-zinc-800 p-1.5">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  {part === "lowerPath" ? "Lower path (renders underneath)" : "Upper path (renders on top)"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <FieldRow label="start">
                    <NumberInput
                      value={zone[part].start}
                      min={0}
                      max={1}
                      onChange={(value) =>
                        updateMetadata((draft) => {
                          draft.crossoverZones[index][part].start = value;
                        })
                      }
                    />
                  </FieldRow>
                  <FieldRow label="end">
                    <NumberInput
                      value={zone[part].end}
                      min={0}
                      max={1}
                      onChange={(value) =>
                        updateMetadata((draft) => {
                          draft.crossoverZones[index][part].end = value;
                        })
                      }
                    />
                  </FieldRow>
                  <FieldRow label="layer">
                    <NumberInput
                      value={zone[part].renderLayer}
                      step={1}
                      onChange={(value) =>
                        updateMetadata((draft) => {
                          draft.crossoverZones[index][part].renderLayer = value;
                        })
                      }
                    />
                  </FieldRow>
                </div>
              </div>
            ))}
          </div>
        ))}
        {metadata.crossoverZones.length === 0 && (
          <p className="text-xs text-zinc-500">
            Use the crossover tool and click four points: lower start, lower end, upper start, upper end.
          </p>
        )}
      </div>
    </PanelSection>
  );
}
