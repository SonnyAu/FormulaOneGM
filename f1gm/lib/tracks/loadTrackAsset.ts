// Game-facing track asset loader.
//
// Custom tracks are stored in the browser (IndexedDB). Built-in tracks live
// under public/tracks/<id>/metadata.json and are served as static files.
// This is the entry point the race UI should use, keyed by the same trackId
// used by CalendarEvent / TrackProfile in lib/sim.

import type { TrackMetadata } from "@/lib/tracks/trackMetadata";
import { getCustomTrack } from "@/lib/tracks/trackStore";
import { validateTrackMetadata } from "@/lib/tracks/validation";

export async function loadTrackMetadata(trackId: string): Promise<TrackMetadata> {
  const custom = await getCustomTrack(trackId);
  if (custom) {
    const result = validateTrackMetadata(custom);
    if (!result.valid) {
      const details = result.errors.map((issue) => issue.message).join(" ");
      throw new Error(`Custom track "${trackId}" failed validation: ${details}`);
    }
    return custom;
  }

  const res = await fetch(`/tracks/${trackId}/metadata.json`);
  if (!res.ok) {
    throw new Error(`No track asset found for "${trackId}" (${res.status}).`);
  }
  const metadata = (await res.json()) as TrackMetadata;
  const result = validateTrackMetadata(metadata);
  if (!result.valid) {
    const details = result.errors.map((issue) => issue.message).join(" ");
    throw new Error(`Track asset "${trackId}" failed validation: ${details}`);
  }
  return metadata;
}