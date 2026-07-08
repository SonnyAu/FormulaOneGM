"use client";

// Basic track identity fields plus layer visibility toggles.

import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import { LAYER_LABELS, type LayerKey } from "@/components/dev/track-editor/editorTypes";
import { FieldRow, NumberInput, PanelSection, TextInput } from "@/components/dev/track-editor/panels/fields";

export function TrackInfoPanel({ editor }: { editor: TrackEditorState }) {
  const { metadata, updateMetadata } = editor;
  return (
    <PanelSection title="Track info">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Id">
          <TextInput
            value={metadata.id}
            placeholder="suzuka"
            onChange={(value) =>
              updateMetadata((draft) => {
                draft.id = value;
              })
            }
          />
        </FieldRow>
        <FieldRow label="Name">
          <TextInput
            value={metadata.name}
            placeholder="Suzuka Circuit"
            onChange={(value) =>
              updateMetadata((draft) => {
                draft.name = value;
              })
            }
          />
        </FieldRow>
        <FieldRow label="Country">
          <TextInput
            value={metadata.country}
            placeholder="Japan"
            onChange={(value) =>
              updateMetadata((draft) => {
                draft.country = value;
              })
            }
          />
        </FieldRow>
        <FieldRow label="Length (km)">
          <NumberInput
            value={metadata.layoutLengthKm}
            step={0.001}
            min={0}
            onChange={(value) =>
              updateMetadata((draft) => {
                draft.layoutLengthKm = value;
              })
            }
          />
        </FieldRow>
        <FieldRow label="Laps">
          <NumberInput
            value={metadata.laps}
            step={1}
            min={0}
            onChange={(value) =>
              updateMetadata((draft) => {
                draft.laps = value;
              })
            }
          />
        </FieldRow>
      </div>
    </PanelSection>
  );
}

export function LayerTogglesPanel({ editor }: { editor: TrackEditorState }) {
  return (
    <PanelSection title="Layers">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {(Object.keys(LAYER_LABELS) as LayerKey[]).map((key) => (
          <label key={key} className="flex items-center gap-1.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={editor.layers[key]}
              onChange={() => editor.toggleLayer(key)}
              className="accent-cyan-400"
            />
            {LAYER_LABELS[key]}
          </label>
        ))}
      </div>
    </PanelSection>
  );
}
