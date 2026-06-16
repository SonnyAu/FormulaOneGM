import { teams as teamSeeds } from "@/data/teams";
import { getTeamExpectationProfile } from "@/lib/sim/ownerConfidence";
import type { SponsorAmbition, SponsorCategory, Team, TeamSponsorSeed } from "@/types/f1";
import type {
  EventLogEntry,
  SaveData,
  SeasonState,
  SponsorContract,
  SponsorRenewalTarget,
  TeamState,
} from "@/types/sim";

const CATEGORY_TARGET_OFFSET: Record<SponsorCategory, number> = {
  title: 0,
  major: 1,
  technical: 2,
  apparel: 3,
  supplier: 4,
};

const AMBITION_TARGET_OFFSET: Record<SponsorAmbition, number> = {
  elite: -1,
  high: 0,
  medium: 1,
  low: 2,
};

const GENERIC_SPONSORS: TeamSponsorSeed[] = [
  { sponsorId: "global-bank", name: "Global Bank", category: "major", annualValue: 12_000_000, ambition: "medium" },
  { sponsorId: "apex-cloud", name: "Apex Cloud", category: "technical", annualValue: 10_000_000, ambition: "medium" },
  { sponsorId: "velocity-kit", name: "Velocity Kit", category: "apparel", annualValue: 7_000_000, ambition: "low" },
  { sponsorId: "summit-tools", name: "Summit Tools", category: "supplier", annualValue: 4_000_000, ambition: "low" },
  { sponsorId: "continental-energy", name: "Continental Energy", titleName: "Continental", category: "title", annualValue: 42_000_000, ambition: "low" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function contractId(teamId: string, sponsorId: string, startSeason: number): string {
  return `${teamId}-${sponsorId}-${startSeason}`;
}

function event(message: string, season: SeasonState, teamId?: string): EventLogEntry {
  return {
    id: `sponsor-${season.currentWeek}-${season.tick}-${Math.random().toString(16).slice(2, 6)}`,
    category: "sponsor",
    message,
    week: season.currentWeek,
    tick: season.tick,
    teamId,
    createdAt: new Date().toISOString(),
  };
}

function teamSeed(teamId: string): Team | null {
  return teamSeeds.find((team) => team.id === teamId) ?? null;
}

function weeksInSeason(season: SeasonState): number {
  return Math.max(1, season.calendar.length || 50);
}

function sponsorDisplayName(contract: SponsorContract | null | undefined): string {
  return contract?.titleName ?? contract?.name ?? "";
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function renderTeamName(
  template: string,
  fallbackName: string,
  contracts: SponsorContract[],
): string {
  const titleSponsor = [...contracts]
    .filter((contract) => contract.category === "title")
    .sort((a, b) => b.annualValue - a.annualValue)[0];
  const namingPartner = [...contracts]
    .filter((contract) => contract.namingPartner)
    .sort((a, b) => b.annualValue - a.annualValue)[0];

  const rendered = collapseSpaces(
    template
      .replaceAll("{titleSponsor}", sponsorDisplayName(titleSponsor))
      .replaceAll("{namingPartner}", sponsorDisplayName(namingPartner)),
  );

  return rendered || fallbackName;
}

export function renderTeamNameForSeason(season: SeasonState, team: TeamState): string {
  return renderTeamName(team.nameTemplate, team.name, activeSponsorContracts(season, team.id));
}

export function activeSponsorContracts(
  season: SeasonState,
  teamId: string,
  seasonYear = season.seasonYear,
): SponsorContract[] {
  return (season.sponsorContracts ?? [])
    .filter((contract) => contract.teamId === teamId && contract.startSeason <= seasonYear && contract.endSeason >= seasonYear)
    .sort((a, b) => {
      const categoryRank: Record<SponsorCategory, number> = { title: 0, major: 1, technical: 2, apparel: 3, supplier: 4 };
      return categoryRank[a.category] - categoryRank[b.category] || b.annualValue - a.annualValue;
    });
}

export function futureSponsorContracts(
  season: SeasonState,
  teamId: string,
  seasonYear = season.seasonYear,
): SponsorContract[] {
  return (season.sponsorContracts ?? []).filter((contract) => contract.teamId === teamId && contract.startSeason > seasonYear);
}

export function sponsorWeeklyIncome(season: SeasonState, teamId: string): number {
  const annual = activeSponsorContracts(season, teamId).reduce((sum, contract) => sum + contract.annualValue, 0);
  return Math.round(annual / weeksInSeason(season));
}

export function buildSponsorRenewalTarget(
  teamId: string,
  sponsor: TeamSponsorSeed,
  season: Pick<SeasonState, "teams">,
): SponsorRenewalTarget {
  const teamCount = Math.max(1, Object.keys(season.teams).length || 11);
  const profile = getTeamExpectationProfile(teamId);
  const ambition = sponsor.ambition ?? "medium";
  const minimumConstructorPosition = clamp(
    profile.expectedConstructorPosition + CATEGORY_TARGET_OFFSET[sponsor.category] + AMBITION_TARGET_OFFSET[ambition],
    1,
    teamCount,
  );
  const target: SponsorRenewalTarget = {
    minimumConstructorPosition,
    description: `Finish P${minimumConstructorPosition} or better in the Constructors' Championship.`,
  };

  if ((sponsor.category === "title" || sponsor.category === "major") && sponsor.annualValue >= 70_000_000) {
    target.minimumPoints = Math.max(20, Math.round((teamCount - minimumConstructorPosition + 1) * 24));
    target.description += ` Score at least ${target.minimumPoints} points.`;
  }
  if (ambition === "elite" && minimumConstructorPosition <= 3) {
    target.minimumPodiums = sponsor.category === "title" ? 2 : 1;
    target.description += ` Reach ${target.minimumPodiums} podium${target.minimumPodiums === 1 ? "" : "s"}.`;
  }
  if (ambition === "elite" && minimumConstructorPosition <= 2 && sponsor.category === "title") {
    target.minimumWins = 1;
    target.description += " Win at least once.";
  }

  return target;
}

export function createSponsorContract(
  teamId: string,
  sponsor: TeamSponsorSeed,
  season: Pick<SeasonState, "seasonYear" | "teams">,
  startSeason = season.seasonYear,
  termYears = sponsor.termYears ?? 1,
): SponsorContract {
  return {
    id: contractId(teamId, sponsor.sponsorId, startSeason),
    sponsorId: sponsor.sponsorId,
    teamId,
    name: sponsor.name,
    titleName: sponsor.titleName,
    category: sponsor.category,
    annualValue: sponsor.annualValue,
    startSeason,
    endSeason: startSeason + Math.max(1, termYears) - 1,
    confidence: 62,
    renewalTarget: buildSponsorRenewalTarget(teamId, sponsor, season),
    ambition: sponsor.ambition ?? "medium",
    namingPartner: sponsor.namingPartner,
  };
}

export function buildInitialSponsorContracts(
  teamIds: string[],
  seasonYear: number,
  customTeam?: { teamId: string; constructorName: string },
): SponsorContract[] {
  const seasonLike: Pick<SeasonState, "seasonYear" | "teams"> = {
    seasonYear,
    teams: Object.fromEntries(teamIds.map((teamId) => [teamId, {} as TeamState])),
  };

  const contracts: SponsorContract[] = [];
  for (const teamId of teamIds) {
    const seed = teamSeed(teamId);
    if (!seed) continue;
    contracts.push(...seed.sponsors.map((sponsor) => createSponsorContract(teamId, sponsor, seasonLike)));
  }

  if (customTeam) {
    const customSponsors: TeamSponsorSeed[] = [
      {
        sponsorId: `${customTeam.teamId}-ventures`,
        name: `${customTeam.constructorName} Ventures`,
        titleName: customTeam.constructorName,
        category: "title",
        annualValue: 36_000_000,
        ambition: "low",
      },
      { sponsorId: `${customTeam.teamId}-engineering`, name: "Apex Cloud", category: "technical", annualValue: 8_000_000 },
      { sponsorId: `${customTeam.teamId}-kit`, name: "Velocity Kit", category: "apparel", annualValue: 5_000_000 },
    ];
    contracts.push(...customSponsors.map((sponsor) => createSponsorContract(customTeam.teamId, sponsor, seasonLike)));
  }

  return contracts;
}

export function syncTeamSponsorState(season: SeasonState): void {
  season.sponsorContracts = Array.isArray(season.sponsorContracts) ? season.sponsorContracts : [];
  for (const team of Object.values(season.teams)) {
    const active = activeSponsorContracts(season, team.id);
    const title = active.find((contract) => contract.category === "title");
    team.sponsors = {
      titleSponsor: sponsorDisplayName(title) || "None",
      confidence: active.length
        ? Math.round(active.reduce((sum, contract) => sum + contract.confidence, 0) / active.length)
        : team.sponsors?.confidence ?? 50,
      basePayout: sponsorWeeklyIncome(season, team.id),
      portfolio: active,
    };
    team.name = renderTeamName(team.nameTemplate, team.name, active);
  }
}

export function ensureSponsorState(save: SaveData): void {
  const season = save.season;
  const teamIds = Object.keys(season.teams);
  if (!Array.isArray(season.sponsorContracts) || season.sponsorContracts.length === 0) {
    const customTeam = season.teams["custom-player-team"]
      ? { teamId: "custom-player-team", constructorName: season.teams["custom-player-team"].name }
      : undefined;
    season.sponsorContracts = buildInitialSponsorContracts(teamIds, season.seasonYear, customTeam);
  }

  for (const team of Object.values(season.teams)) {
    const seed = teamSeed(team.id);
    team.nameTemplate = team.nameTemplate ?? seed?.nameTemplate ?? "{titleSponsor}";
  }

  syncTeamSponsorState(season);
}

export function evaluateSponsorRenewal(contract: SponsorContract, season: SeasonState) {
  const team = season.teams[contract.teamId];
  const standings = Object.values(season.teams).sort(
    (a, b) => b.standings.points - a.standings.points || b.standings.wins - a.standings.wins || b.standings.podiums - a.standings.podiums,
  );
  const constructorPosition = Math.max(1, standings.findIndex((row) => row.id === contract.teamId) + 1 || standings.length);
  const actual = {
    constructorPosition,
    points: team?.standings.points ?? 0,
    wins: team?.standings.wins ?? 0,
    podiums: team?.standings.podiums ?? 0,
  };
  const target = contract.renewalTarget;
  const passed =
    actual.constructorPosition <= target.minimumConstructorPosition &&
    (target.minimumPoints === undefined || actual.points >= target.minimumPoints) &&
    (target.minimumPodiums === undefined || actual.podiums >= target.minimumPodiums) &&
    (target.minimumWins === undefined || actual.wins >= target.minimumWins);

  return { passed, actual, target };
}

export function expiringSponsorContracts(season: SeasonState, teamId: string): SponsorContract[] {
  return (season.sponsorContracts ?? [])
    .filter((contract) => contract.teamId === teamId && contract.endSeason <= season.seasonYear)
    .sort((a, b) => b.annualValue - a.annualValue);
}

export function sponsorCatalog(): TeamSponsorSeed[] {
  const map = new Map<string, TeamSponsorSeed>();
  for (const team of teamSeeds) {
    for (const sponsor of team.sponsors) {
      const existing = map.get(sponsor.sponsorId);
      if (!existing || sponsor.annualValue > existing.annualValue) {
        map.set(sponsor.sponsorId, sponsor);
      }
    }
  }
  for (const sponsor of GENERIC_SPONSORS) map.set(sponsor.sponsorId, sponsor);
  return [...map.values()].sort((a, b) => {
    const categoryRank: Record<SponsorCategory, number> = { title: 0, major: 1, technical: 2, apparel: 3, supplier: 4 };
    return categoryRank[a.category] - categoryRank[b.category] || b.annualValue - a.annualValue;
  });
}

export function availableSponsorMarket(season: SeasonState, teamId: string): TeamSponsorSeed[] {
  const activeOrFuture = new Set(
    [...activeSponsorContracts(season, teamId), ...futureSponsorContracts(season, teamId)].map((contract) => contract.sponsorId),
  );
  return sponsorCatalog().filter((sponsor) => !activeOrFuture.has(sponsor.sponsorId)).slice(0, 16);
}

function hasFutureSponsor(season: SeasonState, teamId: string, sponsorId: string): boolean {
  return (season.sponsorContracts ?? []).some(
    (contract) => contract.teamId === teamId && contract.sponsorId === sponsorId && contract.startSeason > season.seasonYear,
  );
}

export function renewSponsorContract(
  save: SaveData,
  teamId: string,
  contractIdToRenew: string,
  termYears = 1,
): { ok: true; contract: SponsorContract } | { ok: false; error: string } {
  ensureSponsorState(save);
  const season = save.season;
  const existing = (season.sponsorContracts ?? []).find((contract) => contract.id === contractIdToRenew && contract.teamId === teamId);
  if (!existing) return { ok: false, error: "Sponsor contract not found." };
  if (existing.endSeason > season.seasonYear) return { ok: false, error: "That sponsor is not up for renewal yet." };
  const evaluation = evaluateSponsorRenewal(existing, season);
  if (!evaluation.passed) return { ok: false, error: "Renewal target was missed; this sponsor will not re-sign." };
  if (hasFutureSponsor(season, teamId, existing.sponsorId)) return { ok: false, error: "A future deal with that sponsor already exists." };
  if (existing.category === "title" && futureSponsorContracts(season, teamId).some((contract) => contract.category === "title")) {
    return { ok: false, error: "A future title sponsor is already signed." };
  }

  const seed: TeamSponsorSeed = {
    sponsorId: existing.sponsorId,
    name: existing.name,
    titleName: existing.titleName,
    category: existing.category,
    annualValue: Math.round(existing.annualValue * 1.04),
    termYears,
    ambition: existing.ambition,
    namingPartner: existing.namingPartner,
  };
  const contract = createSponsorContract(teamId, seed, season, season.seasonYear + 1, termYears);
  contract.confidence = clamp(existing.confidence + 5, 0, 100);
  season.sponsorContracts.push(contract);
  season.eventLog.push(event(`${season.teams[teamId]?.abbreviation ?? teamId} renewed ${existing.name}.`, season, teamId));
  syncTeamSponsorState(season);
  return { ok: true, contract };
}

export function signSponsorFromMarket(
  save: SaveData,
  teamId: string,
  sponsorId: string,
  termYears = 1,
): { ok: true; contract: SponsorContract } | { ok: false; error: string } {
  ensureSponsorState(save);
  const season = save.season;
  const sponsor = sponsorCatalog().find((item) => item.sponsorId === sponsorId);
  if (!sponsor) return { ok: false, error: "Sponsor is not available." };
  if (hasFutureSponsor(season, teamId, sponsor.sponsorId)) return { ok: false, error: "A future deal with that sponsor already exists." };

  if (sponsor.category === "title") {
    const futureTitle = futureSponsorContracts(season, teamId).find((contract) => contract.category === "title");
    if (futureTitle) return { ok: false, error: "A future title sponsor is already signed." };
  }

  const valueMultiplier = season.teams[teamId]?.standings.wins ? 1.08 : season.teams[teamId]?.standings.podiums ? 1.04 : 0.96;
  const contract = createSponsorContract(
    teamId,
    { ...sponsor, annualValue: Math.round(sponsor.annualValue * valueMultiplier), termYears },
    season,
    season.seasonYear + 1,
    termYears,
  );
  season.sponsorContracts.push(contract);
  season.eventLog.push(event(`${season.teams[teamId]?.abbreviation ?? teamId} signed ${sponsor.name} as a future sponsor.`, season, teamId));
  syncTeamSponsorState(season);
  return { ok: true, contract };
}

export function applySponsorConfidenceDelta(team: TeamState, delta: number): TeamState {
  return {
    ...team,
    sponsors: {
      ...team.sponsors,
      confidence: clamp(team.sponsors.confidence + delta, 0, 100),
      portfolio: team.sponsors.portfolio.map((contract) => ({
        ...contract,
        confidence: clamp(contract.confidence + delta, 0, 100),
      })),
    },
  };
}

export function autoProcessAiSponsors(save: SaveData): EventLogEntry[] {
  ensureSponsorState(save);
  const season = save.season;
  const events: EventLogEntry[] = [];
  for (const team of Object.values(season.teams)) {
    if (team.id === save.meta.playerTeamId) continue;
    for (const contract of expiringSponsorContracts(season, team.id)) {
      if (hasFutureSponsor(season, team.id, contract.sponsorId)) continue;
      const evaluation = evaluateSponsorRenewal(contract, season);
      if (evaluation.passed) {
        const renewed = renewSponsorContract(save, team.id, contract.id, 1);
        if (renewed.ok) events.push(event(`${team.abbreviation} renewed ${contract.name}.`, season, team.id));
      }
    }

    const categories = new Set(futureSponsorContracts(season, team.id, season.seasonYear).map((contract) => contract.category));
    for (const sponsor of availableSponsorMarket(season, team.id)) {
      if (categories.has(sponsor.category)) continue;
      const signed = signSponsorFromMarket(save, team.id, sponsor.sponsorId, 1);
      if (signed.ok) {
        categories.add(sponsor.category);
        events.push(event(`${team.abbreviation} signed ${sponsor.name}.`, season, team.id));
      }
      if (categories.size >= 4) break;
    }
  }
  syncTeamSponsorState(season);
  return events;
}
