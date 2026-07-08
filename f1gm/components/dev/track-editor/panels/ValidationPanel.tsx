"use client";

// Live validation results. Errors block export; warnings are informational.

import type { TrackEditorState } from "@/components/dev/track-editor/useTrackEditor";
import { PanelSection } from "@/components/dev/track-editor/panels/fields";

export function ValidationPanel({ editor }: { editor: TrackEditorState }) {
  const { validation } = editor;

  return (
    <PanelSection title="Validation">
      <div className="flex flex-col gap-2 text-xs">
        {!editor.racingLineDrawn && (
          <div className="rounded border border-red-800 bg-red-950/40 p-2 text-red-300">
            No racing line drawn yet. Use &quot;Draw racing line&quot; and close the loop before
            placing metadata points.
          </div>
        )}
        {editor.racingLineDrawn && !editor.pitLaneDrawn && (
          <div className="rounded border border-amber-800 bg-amber-950/30 p-2 text-amber-300">
            No pit lane drawn. Pit metadata can&apos;t be fully created yet.
          </div>
        )}

        {validation.errors.length === 0 ? (
          <p className="text-emerald-400">No blocking errors. Export is allowed.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-red-400">{validation.errors.length} error(s) — export blocked:</p>
            {validation.errors.map((issue, i) => (
              <div key={i} className="rounded border border-red-900 bg-red-950/30 px-2 py-1 text-red-300">
                <span className="font-mono text-[10px] text-red-500">{issue.field}</span> {issue.message}
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-amber-400">{validation.warnings.length} warning(s):</p>
            {validation.warnings.map((issue, i) => (
              <div key={i} className="rounded border border-amber-900 bg-amber-950/20 px-2 py-1 text-amber-300">
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelSection>
  );
}
