import { ChassisNamingPattern, CustomTeam, TeamSelection } from "@/types/f1";

export const TEAM_SELECTION_STORAGE_KEY = "f1gm-team-selection";

const TEAM_SELECTION_CHANGE_EVENT = "f1gm-team-selection-change";

export function formatCustomChassis(
  prefix: string,
  pattern: ChassisNamingPattern,
  seasonYear: number,
  iteration = 1,
) {
  const normalizedPrefix = prefix.trim().toUpperCase().slice(0, 3);
  if (!normalizedPrefix) {
    return "—";
  }

  if (pattern === "year-based") {
    return `${normalizedPrefix}-${seasonYear.toString().slice(-2)}`;
  }

  return `${normalizedPrefix} ${iteration.toString().padStart(2, "0")}`;
}

export function saveTeamSelection(selection: TeamSelection) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TEAM_SELECTION_STORAGE_KEY, JSON.stringify(selection));
  window.dispatchEvent(new Event(TEAM_SELECTION_CHANGE_EVENT));
}

export function parseTeamSelectionRaw(raw: string | null): TeamSelection | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TeamSelection;
    if (parsed.mode === "existing" && typeof parsed.teamId === "string") {
      return parsed;
    }

    if (parsed.mode === "custom" && parsed.team) {
      const customTeam = parsed.team as CustomTeam;
      if (customTeam.constructorName && customTeam.driverOne && customTeam.driverTwo) {
        return {
          mode: "custom",
          team: customTeam,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function loadTeamSelection(): TeamSelection | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseTeamSelectionRaw(
    window.localStorage.getItem(TEAM_SELECTION_STORAGE_KEY),
  );
}

export function subscribeTeamSelection(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === TEAM_SELECTION_STORAGE_KEY || e.key === null) {
      onStoreChange();
    }
  };

  const onLocalChange = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(TEAM_SELECTION_CHANGE_EVENT, onLocalChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(TEAM_SELECTION_CHANGE_EVENT, onLocalChange);
  };
}

export function getTeamSelectionStorageSnapshot(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TEAM_SELECTION_STORAGE_KEY);
}

export function getTeamSelectionStorageServerSnapshot(): string | null {
  return null;
}
