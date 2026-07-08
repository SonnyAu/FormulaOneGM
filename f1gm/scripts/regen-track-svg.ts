// One-shot utility: regenerate public/tracks/<id>/track.svg from the drawn
// geometry in metadata.json. Usage: npx tsx scripts/regen-track-svg.ts <id>

import { promises as fs } from "fs";
import path from "path";
import { generateTrackSvg } from "../lib/tracks/geometry";

async function main() {
  const trackId = process.argv[2];
  if (!trackId) {
    console.error("Usage: npx tsx scripts/regen-track-svg.ts <trackId>");
    process.exit(1);
  }
  const dir = path.join(process.cwd(), "public", "tracks", trackId);
  const metadata = JSON.parse(await fs.readFile(path.join(dir, "metadata.json"), "utf8"));
  await fs.writeFile(path.join(dir, "track.svg"), generateTrackSvg(metadata.geometry), "utf8");
  console.log(`Regenerated ${path.join(dir, "track.svg")}`);
}

main();
