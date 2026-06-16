import { playerNeedsFreeAgentSigning } from "@/lib/sim/driverContracts";
import type { OffseasonState, OffseasonStep, SaveData } from "@/types/sim";

export const OFFSEASON_SEQUENCE: OffseasonStep[] = [
  "season-summary",
  "owner-confidence",
  "resign-drivers",
  "free-agent-drivers",
  "resign-sponsors",
  "technical-review",
  "ready",
];

export const OFFSEASON_LABELS: Record<OffseasonStep, string> = {
  "season-summary": "Season Summary",
  "owner-confidence": "Owner Confidence",
  "resign-drivers": "Re-sign Drivers",
  "free-agent-drivers": "Free Agent Drivers",
  "resign-sponsors": "Re-sign Sponsors",
  "technical-review": "Technical Review",
  ready: "Ready",
};

function defaultOffseasonState(): OffseasonState {
  return { active: false, step: "season-summary", completedSteps: [] };
}

export function ensureOffseasonState(save: SaveData): OffseasonState {
  if (!save.season.offseason) save.season.offseason = defaultOffseasonState();
  save.season.offseason.completedSteps = Array.isArray(save.season.offseason.completedSteps)
    ? save.season.offseason.completedSteps
    : [];
  save.season.offseason.step = OFFSEASON_SEQUENCE.includes(save.season.offseason.step)
    ? save.season.offseason.step
    : "season-summary";
  return save.season.offseason;
}

export function startOffseason(save: SaveData): OffseasonState {
  const state = ensureOffseasonState(save);
  state.active = true;
  if (state.step === "ready" && state.completedSteps.includes("ready")) return state;
  if (!state.completedSteps.length) state.step = "season-summary";
  return state;
}

function nextStepAfter(save: SaveData, step: OffseasonStep): OffseasonStep {
  if (step === "resign-drivers" && !playerNeedsFreeAgentSigning(save)) return "resign-sponsors";
  const index = OFFSEASON_SEQUENCE.indexOf(step);
  return OFFSEASON_SEQUENCE[Math.min(OFFSEASON_SEQUENCE.length - 1, index + 1)] ?? "ready";
}

export function completeOffseasonStep(save: SaveData, step: OffseasonStep): OffseasonState {
  const state = startOffseason(save);
  if (!state.completedSteps.includes(step)) state.completedSteps.push(step);
  state.step = nextStepAfter(save, step);
  if (state.step === "ready" && !state.completedSteps.includes("ready")) {
    state.completedSteps.push("ready");
  }
  return state;
}

export function canStartNextSeason(save: SaveData): boolean {
  const state = ensureOffseasonState(save);
  return state.active && state.step === "ready" && state.completedSteps.includes("technical-review");
}

export function resetOffseasonForNewSeason(save: SaveData): void {
  save.season.offseason = defaultOffseasonState();
}
