# Track assets

Every circuit is a reusable data asset: a single `metadata.json` the race engine
consumes. The editor draws the circuit directly — you do not author an SVG by hand.

## Core principle: lapProgress is the source of truth

The race engine treats a car's position as a **normalized distance along the
racing line**, from `0` (start of lap) to `1` (end of lap). `0.5` is halfway
around. The drawn geometry is only how that number gets rendered on screen.

This matters for circuits that visually overlap themselves. On Suzuka's
figure-eight, two cars can share nearly the same screen `x, y` while being at
completely different points in the lap (`0.29` in the underpass vs `0.78` on
the overpass). Because the engine only reasons in lap progress, the overlap is
purely a rendering concern.

## What you author vs what the engine derives

The editor captures only what must be drawn or placed by hand:

- Circuit geometry (racing line, pit lane)
- Identity (id, name, country, length, laps)
- Sectors, corners, pit entry/exit/box, elevation, crossovers

The race engine derives dynamically from that layout data:

- Overtaking difficulty
- Incident / crash risk
- Performance traits (tire wear, brake stress, downforce sensitivity, etc.)

There is no DRS zone editor (2026 regulations have no DRS), no overtaking-hotspot
placements, no high-risk zones, and no traits sliders.

## Asset folder layout

```txt
public/tracks/
  index.json         manifest of built-in track ids
  suzuka/
    metadata.json    the single file the game needs (includes geometry)
    track.svg        optional compatibility artifact, not a runtime dep
    preview.png      optional thumbnail
```

Built-in tracks are committed to the repo and listed in `index.json`. Custom
tracks created in the editor are stored in the browser (IndexedDB) and override
a built-in track with the same id when loading.

The folder name is the track id and should match the ids used by
`lib/sim/raceweekend/trackProfiles.ts` (e.g. `suzuka`, `monza`, `spa`).

## Opening the editor

The editor is available in both development and production builds:

```bash
npm run dev
# then open http://localhost:3000/dev/track-editor
```

On a deployed site, open `/dev/track-editor` directly.

- **New track** — blank canvas; draw the racing line first.
- **Load track asset…** — built-in tracks from `public/tracks/` plus any custom
  tracks saved in your browser. Built-ins are labeled `(built-in)`.
- **Import metadata.json** — loads an existing metadata file (including geometry).
- **Save track** — writes the current draft to IndexedDB in your browser.
- **Delete** — removes the selected custom track from browser storage (built-ins
  cannot be deleted).

Editing a built-in track and saving creates a custom override with the same id.
That override is used by the game loader until you delete it.

## Drawing the circuit

### Racing line (required)

1. Select **Draw racing line**.
2. Click to place anchor points around the circuit.
3. Close the loop by clicking near the first anchor, or press **Close loop**.

The racing line must have at least 3 anchors. Smooth curves (Catmull-Rom → cubic
bezier) are generated from the anchors; toggle **Straight lines** in the
toolbar to preview without smoothing.

### Pit lane (optional)

1. Select **Draw pit lane**.
2. Click to place anchors along the pit route (open path, not closed).
3. Press **Finish pit lane** when done (at least 2 anchors).

Pit entry/exit/box tools stay disabled until a pit lane is drawn.

### Editing anchors

- **Select / move** — click an anchor handle to select it; drag to reshape.
- Click a segment to insert a new anchor.
- Press **Delete** to remove the selected anchor.

Reshaping the path after placing metadata markers may shift their normalized
distances slightly — place corners and sectors after the layout is mostly final.

## Placing metadata points

Pick a metadata tool, then click on (or near) the drawn path. Clicks snap to the
nearest point on the path and are stored as normalized distances.

- **Start/finish** — single point (usually distance `0`).
- **Sector start / Sector end** — place a start, then an end, to define one
  complete sector. Repeat for as many sectors as you want (numbered 1..N in
  completion order). Deleting a sector renumbers the rest.
- **Corner** — name, difficulty (0–1), type (`braking`, `traction`, `highSpeed`,
  `mediumSpeed`, `lowSpeed`, `chicane`, `hairpin`, `sweeper`).
- **Elevation point** — a point on the lap; set its height in the Elevation tab.
- **Crossover zone** — four clicks: lower start, lower end, upper start, upper
  end (for figure-eight overlaps).
- **Pit entry / Pit exit / Pit box** — entry and exit are on the racing line; pit
  box is on the pit lane (square marker).

Click an existing marker to select it (tool switches to Select / move). While
selected, click elsewhere on the path to reposition it, or press Delete to remove
it. All values are also editable as numbers in the side panels.

Hovering the track shows a tooltip with normalized distance, path type, sector,
nearby corner, and interpolated elevation.

## Pit lane metadata

```json
{
  "pit": { "entry": 0.955, "exit": 0.1, "box": 0.5, "lossSeconds": 22 }
}
```

Pit entry and exit are on the **racing line**; the pit box is along the **pit
lane**. `lossSeconds` is the expected total time lost by a stop.

The pit sequence: car crosses `entry` on the racing line → switches to the pit
lane (progress restarts at 0) → pauses at `box` → exits the pit lane → rejoins
the racing line at `exit`.

## Elevation

Stored as profile points (`distance` 0–1, `elevationM` meters); values between
points are linearly interpolated. Add points with the elevation tool, then set
heights in the Elevation tab (includes a small chart).

## Crossovers (Suzuka)

```json
{
  "crossoverZones": [
    {
      "name": "Suzuka Crossover",
      "lowerPath": { "start": 0.27, "end": 0.31, "renderLayer": 1 },
      "upperPath": { "start": 0.7, "end": 0.74, "renderLayer": 3 }
    }
  ]
}
```

`renderLayer` controls stacking: layer 1 under the bridge, layer 2 normal track,
layer 3 on top. Bridge visuals are generated from crossover metadata (not a
separate SVG layer). Use Preview mode to verify cars pass under/over correctly.

**Ambiguous snaps.** Near a crossover, one click may be close to two different
lap distances. The editor never guesses — it shows a chooser listing each
candidate with context (e.g. "Lower crossover / underpass" vs "Sector 3").

## Validation and export

The Validation tab runs continuously. Errors block export; warnings do not.

Errors include: missing id/name/country, no drawn racing line, no complete
sectors, out-of-range distances, missing pit points when a pit lane exists, etc.

Warnings include: no elevation profile, no crossover zones, sectors that do not
tile the whole lap, no pit lane drawn.

Two export paths:

- **Export metadata.json** — downloads the file (use this to promote a custom
  track to a built-in: drop into `public/tracks/<id>/`, add the id to
  `public/tracks/index.json`, and commit).
- **Save track** — persists the draft to IndexedDB in your browser. Works on
  any host, including serverless deployments.

## How the game renders tracks

Exported assets are game-ready without any editor code.

### Loader

```ts
import { loadTrackMetadata } from "@/lib/tracks/loadTrackAsset";

const metadata = await loadTrackMetadata(trackId);
// Custom tracks: IndexedDB first, then /tracks/<id>/metadata.json from public/
// Validates before returning
```

Use the same `trackId` already on `CalendarEvent` / `TrackProfile`.

### Renderer

```tsx
import { TrackMap } from "@/components/tracks/TrackMap";

<TrackMap metadata={metadata} cars={liveCars} showSectors />
```

`TrackMap` is independent of the dev editor. It renders geometry → smooth paths,
sector highlights, crossover bridges, and cars positioned/rotated from
`lapProgress`. The editor preview uses this same component, so what you see in
Preview is what the race UI will show.

## Full metadata example (Suzuka)

```json
{
  "id": "suzuka",
  "name": "Suzuka Circuit",
  "country": "Japan",
  "layoutLengthKm": 5.807,
  "laps": 53,
  "geometry": {
    "racingLine": [{ "x": 140, "y": 220 }, "..."],
    "pitLane": [{ "x": 196, "y": 186 }, "..."],
    "smoothed": true
  },
  "startFinish": { "distance": 0 },
  "sectors": [
    { "sector": 1, "start": 0, "end": 0.33 },
    { "sector": 2, "start": 0.33, "end": 0.68 },
    { "sector": 3, "start": 0.68, "end": 1 }
  ],
  "pit": { "entry": 0.955, "exit": 0.1, "box": 0.5, "lossSeconds": 22 },
  "corners": [
    { "name": "Turn 1", "distance": 0.1, "difficulty": 0.7, "type": "braking" }
  ],
  "elevationProfile": [
    { "distance": 0, "elevationM": 0 },
    { "distance": 0.72, "elevationM": 31 },
    { "distance": 1, "elevationM": 0 }
  ],
  "crossoverZones": [
    {
      "name": "Suzuka Crossover",
      "lowerPath": { "start": 0.27, "end": 0.31, "renderLayer": 1 },
      "upperPath": { "start": 0.7, "end": 0.74, "renderLayer": 3 }
    }
  ]
}
```

## Shared helpers (`lib/tracks/`)

- `trackMetadata.ts` — `TrackMetadata` schema, geometry helpers.
- `geometry.ts` — anchor points, Catmull-Rom smoothing, `generateTrackSvg`.
- `svgPath.ts` — `getPointAtNormalizedDistance`, `findSnapCandidates` (browser).
- `trackMath.ts` — `isDistanceInRange` (wraparound), `getSectorAtDistance`,
  `getElevationAtDistance`, `getCrossoverLayerAtDistance`.
- `validation.ts` — `validateTrackMetadata`.
- `loadTrackAsset.ts` — `loadTrackMetadata` for the game.
- `trackStore.ts` — IndexedDB persistence for custom tracks; built-in manifest.

The engine should drive everything from `lapProgress` + these helpers; never read
positions back off the screen.

## Sanity-check workflow

1. Open the editor, load or draw a track.
2. Place sectors, corners, pit data, elevation, crossovers as needed.
3. Switch to **Preview**, spawn a car, trigger a pit stop.
4. Confirm crossover layering (underpass below bridge, overpass above).
5. **Save track**, then use **Verify game load** (or call
   `loadTrackMetadata("<id>")`) and confirm it renders with `TrackMap`.
6. To ship a track in the repo: **Export metadata.json**, add it under
   `public/tracks/<id>/`, list the id in `public/tracks/index.json`, commit.
