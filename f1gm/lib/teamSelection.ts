import { ChassisNamingPattern, CustomTeam, TeamSelection } from "@/types/f1";

export const TEAM_SELECTION_STORAGE_KEY = "f1gm-team-selection";

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
}

export function loadTeamSelection(): TeamSelection | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(TEAM_SELECTION_STORAGE_KEY);
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
