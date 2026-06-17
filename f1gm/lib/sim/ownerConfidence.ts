import { teams } from "@/data/teams";
import {
  JobSecurityState,
  OwnerConfidenceReason,
  OwnerConfidenceReview,
  OwnerRiskTier,
  OwnerWarningLevel,
  SaveData,
  SeasonState,
  TeamExpectationProfile,
  TeamSnapshot,
} from "@/types/sim";

const DEFAULT_EXPECTATION: TeamExpectationProfile = {
  prestigeRating: 42,
  roleAwareRating: 38,
  roleLabel: "Independent project",
  expectedConstructorPosition: 9,
  minimumAcceptablePosition: 11,
  patience: 72,
  financialStrictness: 45,
};

export const teamExpectationProfiles: Record<string, TeamExpectationProfile> = {
  alpine: {
    prestigeRating: 62,
    roleAwareRating: 58,
    roleLabel: "Factory rebuild",
    expectedConstructorPosition: 6,
    minimumAcceptablePosition: 8,
    patience: 56,
    financialStrictness: 62,
  },
  "aston-martin": {
    prestigeRating: 70,
    roleAwareRating: 68,
    roleLabel: "Ambitious works-backed team",
    expectedConstructorPosition: 5,
    minimumAcceptablePosition: 7,
    patience: 50,
    financialStrictness: 68,
  },
  williams: {
    prestigeRating: 64,
    roleAwareRating: 52,
    roleLabel: "Historic recovery project",
    expectedConstructorPosition: 7,
    minimumAcceptablePosition: 9,
    patience: 68,
    financialStrictness: 58,
  },
  audi: {
    prestigeRating: 58,
    roleAwareRating: 62,
    roleLabel: "New works programme",
    expectedConstructorPosition: 7,
    minimumAcceptablePosition: 9,
    patience: 62,
    financialStrictness: 60,
  },
  cadillac: {
    prestigeRating: 46,
    roleAwareRating: 44,
    roleLabel: "New entrant",
    expectedConstructorPosition: 10,
    minimumAcceptablePosition: 11,
    patience: 76,
    financialStrictness: 54,
  },
  ferrari: {
    prestigeRating: 95,
    roleAwareRating: 92,
    roleLabel: "Elite works team",
    expectedConstructorPosition: 2,
    minimumAcceptablePosition: 4,
    patience: 30,
    financialStrictness: 86,
  },
  haas: {
    prestigeRating: 40,
    roleAwareRating: 36,
    roleLabel: "Lean customer team",
    expectedConstructorPosition: 9,
    minimumAcceptablePosition: 11,
    patience: 74,
    financialStrictness: 72,
  },
  mclaren: {
    prestigeRating: 90,
    roleAwareRating: 88,
    roleLabel: "Elite challenger",
    expectedConstructorPosition: 2,
    minimumAcceptablePosition: 4,
    patience: 38,
    financialStrictness: 78,
  },
  mercedes: {
    prestigeRating: 92,
    roleAwareRating: 86,
    roleLabel: "Senior works team",
    expectedConstructorPosition: 3,
    minimumAcceptablePosition: 5,
    patience: 40,
    financialStrictness: 82,
  },
  "racing-bulls": {
    prestigeRating: 50,
    roleAwareRating: 34,
    roleLabel: "Junior sister team",
    expectedConstructorPosition: 8,
    minimumAcceptablePosition: 10,
    patience: 82,
    financialStrictness: 50,
  },
  "red-bull": {
    prestigeRating: 96,
    roleAwareRating: 96,
    roleLabel: "Senior title team",
    expectedConstructorPosition: 1,
    minimumAcceptablePosition: 3,
    patience: 24,
    financialStrictness: 88,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value);
}

export function createInitialJobSecurityState(teamId: string, season?: Pick<SeasonState, "teams">): JobSecurityState {
  const profile = getTeamExpectationProfile(teamId, season);
  const confidenceScore = clamp(round(70 - profile.roleAwareRating * 0.08 + profile.patience * 0.12), 55, 78);
  return {
    confidenceScore,
    warningLevel: "none",
    consecutiveLowConfidenceSeasons: 0,
    lastReview: null,
  };
}

export function ensureJobSecurityState(save: SaveData): JobSecurityState {
  if (!save.season.jobSecurity) {
    save.season.jobSecurity = createInitialJobSecurityState(save.meta.playerTeamId);
  }
  if (!save.season.jobSecurity.lastReview) {
    save.season.jobSecurity.lastReview = null;
  }
  return save.season.jobSecurity;
}

export function createInitialTeamExpectation(teamId: string): TeamExpectationProfile {
  const seed = teamExpectationProfiles[teamId] ?? DEFAULT_EXPECTATION;
  return { ...seed };
}

export function ensureTeamExpectations(save: SaveData): void {
  for (const team of Object.values(save.season.teams)) {
    if (!team.expectation) {
      team.expectation = createInitialTeamExpectation(team.id);
    }
  }
}

function deriveRoleLabel(prestigeRating: number, roleAwareRating: number): string {
  const blend = (prestigeRating + roleAwareRating) / 2;
  if (blend >= 90) return "Championship contender";
  if (blend >= 78) return "Elite challenger";
  if (blend >= 65) return "Established front-runner";
  if (blend >= 52) return "Established midfield";
  if (blend >= 40) return "Developing programme";
  return "Recovery project";
}

function constructorPositionForTeam(season: SeasonState, teamId: string): number {
  const standings = Object.values(season.teams).sort(
    (a, b) => b.standings.points - a.standings.points || b.standings.wins - a.standings.wins || b.standings.podiums - a.standings.podiums,
  );
  const index = standings.findIndex((team) => team.id === teamId);
  return index === -1 ? standings.length : index + 1;
}

/** Shift live team prestige/expectations from season-end constructor results (all teams). */
export function updateTeamExpectations(save: SaveData): void {
  ensureTeamExpectations(save);
  const season = save.season;
  const teamCount = Math.max(1, Object.keys(season.teams).length);

  for (const team of Object.values(season.teams)) {
    const profile = team.expectation!;
    const position = constructorPositionForTeam(season, team.id);
    const beatExpected = profile.expectedConstructorPosition - position;
    const missedFloor = position - profile.minimumAcceptablePosition;

    let prestigeDelta = 0;
    let roleAwareDelta = 0;
    let expectedPosDelta = 0;

    if (beatExpected >= 2) {
      prestigeDelta = 6;
      roleAwareDelta = 5;
      expectedPosDelta = -1;
    } else if (beatExpected >= 1) {
      prestigeDelta = 4;
      roleAwareDelta = 3;
      expectedPosDelta = -1;
    } else if (missedFloor >= 2) {
      prestigeDelta = -6;
      roleAwareDelta = -5;
      expectedPosDelta = 1;
    } else if (missedFloor >= 1) {
      prestigeDelta = -4;
      roleAwareDelta = -3;
      expectedPosDelta = 1;
    } else if (beatExpected <= -2) {
      prestigeDelta = -3;
      roleAwareDelta = -2;
      expectedPosDelta = 1;
    }

    if (team.standings.wins > 0 && profile.prestigeRating < 88) {
      prestigeDelta += 2;
      roleAwareDelta += 2;
    } else if (team.standings.podiums >= 3 && profile.prestigeRating < 75) {
      prestigeDelta += 1;
      roleAwareDelta += 1;
    }

    if (profile.roleAwareRating >= 82 && team.standings.wins === 0 && position > 4) {
      prestigeDelta -= 3;
      roleAwareDelta -= 2;
    }

    profile.prestigeRating = clamp(profile.prestigeRating + prestigeDelta, 28, 99);
    profile.roleAwareRating = clamp(profile.roleAwareRating + roleAwareDelta, 28, 99);
    profile.expectedConstructorPosition = clamp(profile.expectedConstructorPosition + expectedPosDelta, 1, teamCount);
    const floorSlack = profile.prestigeRating >= 82 ? 2 : profile.prestigeRating >= 58 ? 1 : 2;
    profile.minimumAcceptablePosition = clamp(profile.expectedConstructorPosition + floorSlack, profile.expectedConstructorPosition, teamCount);
    profile.roleLabel = deriveRoleLabel(profile.prestigeRating, profile.roleAwareRating);
  }
}

/** Best (lowest P) constructor target this team's current backing can support for sponsors. */
export function teamStrictestSponsorPosition(profile: TeamExpectationProfile, teamCount: number): number {
  const lift = Math.floor(profile.roleAwareRating / 28);
  return clamp(profile.expectedConstructorPosition - lift, 1, teamCount);
}

export function getTeamExpectationProfile(teamId: string, season?: Pick<SeasonState, "teams">): TeamExpectationProfile {
  const live = season?.teams[teamId]?.expectation;
  if (live) return live;
  return teamExpectationProfiles[teamId] ?? DEFAULT_EXPECTATION;
}

function riskTierForScore(score: number): OwnerRiskTier {
  if (score >= 72) return "secure";
  if (score >= 55) return "watched";
  if (score >= 38) return "at-risk";
  return "final-warning";
}

function warningForScore(score: number, previous: OwnerWarningLevel, lowStreak: number, catastrophic: boolean): OwnerWarningLevel {
  if (score >= 55) return "none";
  if (catastrophic && lowStreak >= 1) return "final-warning";
  if (previous === "final-warning" && lowStreak >= 2) return "fired";
  if (previous === "at-risk" && lowStreak >= 2) return "final-warning";
  if (previous === "watched" || lowStreak >= 2) return "at-risk";
  return "watched";
}

function latestPreviousSnapshot(save: SaveData, teamId: string): TeamSnapshot | null {
  for (let i = save.season.archive.length - 1; i >= 0; i -= 1) {
    const snapshot = save.season.archive[i]?.teamSnapshots.find((row) => row.teamId === teamId);
    if (snapshot) return snapshot;
  }
  return null;
}

function fallbackStartingBudget(teamId: string, teamType: "works" | "customer" | undefined): number {
  if (teamId === "custom-player-team") return 95_000_000;
  return teamType === "works" ? 200_000_000 : 130_000_000;
}

function buildReason(label: string, detail: string, tone: OwnerConfidenceReason["tone"]): OwnerConfidenceReason {
  return { label, detail, tone };
}

export function evaluateOwnerConfidence(save: SaveData): OwnerConfidenceReview {
  const jobSecurity = ensureJobSecurityState(save);
  if (jobSecurity.lastReview?.seasonYear === save.season.seasonYear) {
    return jobSecurity.lastReview;
  }

  const teamId = save.meta.playerTeamId;
  const team = save.season.teams[teamId];
  const profile = getTeamExpectationProfile(teamId, save.season);
  const standings = Object.values(save.season.teams).sort(
    (a, b) => b.standings.points - a.standings.points || b.standings.wins - a.standings.wins || b.standings.podiums - a.standings.podiums,
  );
  const constructorCount = standings.length;
  const constructorPosition = Math.max(1, standings.findIndex((row) => row.id === teamId) + 1 || constructorCount);
  const previousSnapshot = latestPreviousSnapshot(save, teamId);
  const previousBudget = previousSnapshot?.budget ?? fallbackStartingBudget(teamId, team?.teamType);
  const budget = team?.budget ?? 0;
  const budgetDelta = budget - previousBudget;
  const positionGap = constructorPosition - profile.expectedConstructorPosition;
  const minimumGap = constructorPosition - profile.minimumAcceptablePosition;
  const scoreParts: number[] = [];
  const reasons: OwnerConfidenceReason[] = [];

  scoreParts.push(78);
  scoreParts.push(-Math.max(0, positionGap) * (6 + profile.roleAwareRating / 20));
  scoreParts.push(Math.max(0, -positionGap) * 5);

  if (minimumGap > 0) {
    scoreParts.push(-minimumGap * (5 + profile.prestigeRating / 25));
    reasons.push(buildReason("Below the board's floor", `${team?.abbreviation ?? "Team"} finished P${constructorPosition}, below the P${profile.minimumAcceptablePosition} minimum.`, "bad"));
  } else if (positionGap <= 0) {
    reasons.push(buildReason("Target met", `P${constructorPosition} matched or beat the board's P${profile.expectedConstructorPosition} expectation.`, "good"));
  } else {
    reasons.push(buildReason("Short of target", `P${constructorPosition} trailed the board's P${profile.expectedConstructorPosition} target.`, "neutral"));
  }

  const costPressure = budgetDelta < -25_000_000 ? Math.abs(budgetDelta) / 1_000_000 : 0;
  const spendingPenalty = costPressure * (profile.financialStrictness / 100) * (positionGap > 0 ? 0.55 : 0.18);
  scoreParts.push(-spendingPenalty);
  if (spendingPenalty > 10) {
    reasons.push(buildReason("Expensive underperformance", "Heavy spending without matching results hurt owner confidence.", "bad"));
  } else if (budgetDelta >= 10_000_000) {
    scoreParts.push(Math.min(10, budgetDelta / 5_000_000));
    reasons.push(buildReason("Healthy profitability", "The team ended the year with stronger cash reserves.", "good"));
  } else {
    reasons.push(buildReason("Finances controlled", "Spending stayed within an acceptable range for the team's expectations.", "neutral"));
  }

  const pointsShare = team?.standings.points ?? 0;
  if (profile.roleAwareRating >= 85 && (team?.standings.wins ?? 0) === 0) {
    scoreParts.push(-14);
    reasons.push(buildReason("No wins for an elite seat", "A senior title team expects victories, not just points finishes.", "bad"));
  } else if ((team?.standings.wins ?? 0) > 0) {
    scoreParts.push(Math.min(12, (team?.standings.wins ?? 0) * 4));
    reasons.push(buildReason("Race-winning proof", `${team?.standings.wins ?? 0} wins reassured ownership that the programme can deliver.`, "good"));
  }

  if (previousSnapshot) {
    const pointsGrowth = pointsShare - previousSnapshot.points;
    if (pointsGrowth > 20) {
      scoreParts.push(8);
      reasons.push(buildReason("Clear upward trend", "The points total improved meaningfully year over year.", "good"));
    } else if (pointsGrowth < -20) {
      scoreParts.push(-8);
      reasons.push(buildReason("Momentum slipped", "Results moved backwards from the previous archived season.", "bad"));
    }
  } else if (profile.patience >= 70 && positionGap > 0) {
    scoreParts.push(8);
    reasons.push(buildReason("Development patience", `${profile.roleLabel} ownership is prepared to tolerate a building season.`, "good"));
  }

  if (jobSecurity.warningLevel === "at-risk") scoreParts.push(-6);
  if (jobSecurity.warningLevel === "final-warning") scoreParts.push(-12);

  const confidenceScore = clamp(round(scoreParts.reduce((sum, part) => sum + part, 0)), 0, 100);
  const lowConfidence = confidenceScore < 55;
  const consecutiveLowConfidenceSeasons = lowConfidence ? jobSecurity.consecutiveLowConfidenceSeasons + 1 : 0;
  const catastrophic = confidenceScore < 28 && minimumGap >= 3 && budgetDelta < -40_000_000;
  const warningLevel = warningForScore(confidenceScore, jobSecurity.warningLevel, consecutiveLowConfidenceSeasons, catastrophic);
  const riskTier = warningLevel === "fired" ? "final-warning" : riskTierForScore(confidenceScore);

  if (catastrophic) {
    reasons.unshift(buildReason("Catastrophic board review", "Major losses and a deep competitive miss accelerated the warning process.", "bad"));
  }

  return {
    seasonYear: save.season.seasonYear,
    teamId,
    teamName: team?.name ?? teams.find((item) => item.id === teamId)?.entrant ?? save.meta.playerTeamName,
    confidenceScore,
    previousConfidenceScore: jobSecurity.confidenceScore,
    riskTier,
    warningLevel,
    consecutiveLowConfidenceSeasons,
    wasFired: warningLevel === "fired",
    expectationProfile: {
      prestigeRating: profile.prestigeRating,
      roleAwareRating: profile.roleAwareRating,
      roleLabel: profile.roleLabel,
      expectedConstructorPosition: profile.expectedConstructorPosition,
      minimumAcceptablePosition: profile.minimumAcceptablePosition,
    },
    seasonResult: {
      constructorPosition,
      constructorCount,
      points: team?.standings.points ?? 0,
      wins: team?.standings.wins ?? 0,
      podiums: team?.standings.podiums ?? 0,
      budget,
      budgetDelta,
    },
    reasons: reasons.slice(0, 4),
  };
}

export function recordOwnerConfidenceReview(save: SaveData): OwnerConfidenceReview {
  const review = evaluateOwnerConfidence(save);
  const jobSecurity = ensureJobSecurityState(save);
  jobSecurity.confidenceScore = review.confidenceScore;
  jobSecurity.warningLevel = review.warningLevel;
  jobSecurity.consecutiveLowConfidenceSeasons = review.consecutiveLowConfidenceSeasons;
  jobSecurity.lastReview = review;
  return review;
}
