// Public track asset editor — custom tracks persist in the browser (IndexedDB).
// See docs/track-assets.md for how to create a new track asset.

import { TrackEditor } from "@/components/dev/track-editor/TrackEditor";

export const metadata = {
  title: "Track Asset Editor",
};

export default function TrackEditorPage() {
  return <TrackEditor />;
}
