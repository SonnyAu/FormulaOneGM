import type { BuildInfo } from "@/types/build";

export const CURRENT_UPDATE_LOG: BuildInfo["updateLog"] = {
  title: "Live update support",
  changes: [
    "Added an in-game update notification.",
    "Players can update to the latest deployment mid-playthrough.",
    "Active saves are checkpointed before the game reloads.",
  ],
};
