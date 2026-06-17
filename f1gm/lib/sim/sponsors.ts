import { teams as teamSeeds } from "@/data/teams";
import { ensureTeamExpectations, getTeamExpectationProfile, teamStrictestSponsorPosition } from "@/lib/sim/ownerConfidence";
import type { SponsorAmbition, SponsorCategory, Team, TeamSponsorSeed } from "@/types/f1";
import type {
  EventLogEntry,
  SaveData,
  SeasonState,
  SponsorContract,
  SponsorRenewalTarget,
  TeamExpectationProfile,
  TeamState,
} from "@/types/sim";

export const SPONSOR_MIN_TERM_YEARS = 3;
export const SPONSOR_MAX_TERM_YEARS = 5;

export type SponsorDealPreview = {
  target: SponsorRenewalTarget;
  termYears: number;
  teamAnchor: number;
  prestigeCap: number;
};

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

export function clampSponsorTermYears(termYears: number): number {
  return clamp(termYears, SPONSOR_MIN_TERM_YEARS, SPONSOR_MAX_TERM_YEARS);
}

function inferredTermYears(contract: SponsorContract): number {
  return Math.max(1, contract.endSeason - contract.startSeason + 1);
}

function profileForTeam(season: Pick<SeasonState, "teams">, teamId: string): TeamExpectationProfile {
  return getTeamExpectationProfile(teamId, season);
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
  termYears = SPONSOR_MIN_TERM_YEARS,
): SponsorRenewalTarget {
  const teamCount = Math.max(1, Object.keys(season.teams).length || 11);
  const profile = profileForTeam(season, teamId);
  const ambition = sponsor.ambition ?? "medium";
  const term = clampSponsorTermYears(termYears);
  const termStrictness = term - SPONSOR_MIN_TERM_YEARS;

  const rawPosition =
    profile.expectedConstructorPosition +
    CATEGORY_TARGET_OFFSET[sponsor.category] +
    AMBITION_TARGET_OFFSET[ambition] -
    termStrictness;

  const prestigeCap = teamStrictestSponsorPosition(profile, teamCount);
  const minimumConstructorPosition = clamp(rawPosition, prestigeCap, teamCount);

  const target: SponsorRenewalTarget = {
    minimumConstructorPosition,
    description: `Finish P${minimumConstructorPosition} or better in the Constructors' Championship.`,
  };

  const canDemandPoints =
    (sponsor.category === "title" || sponsor.category === "major") &&
    sponsor.annualValue >= 70_000_000 &&
    profile.prestigeRating >= 62 &&
    minimumConstructorPosition <= 6;

  if (canDemandPoints) {
    target.minimumPoints = Math.max(20, Math.round((teamCount - minimumConstructorPosition + 1) * 24));
    target.description += ` Score at least ${target.minimumPoints} points.`;
  }

  const canDemandPodiums =
    ambition === "elite" &&
    minimumConstructorPosition <= 3 &&
    profile.prestigeRating >= 78 &&
    profile.roleAwareRating >= 72;

  if (canDemandPodiums) {
    target.minimumPodiums = sponsor.category === "title" ? 2 : 1;
    target.description += ` Reach ${target.minimumPodiums} podium${target.minimumPodiums === 1 ? "" : "s"}.`;
  }

  const canDemandWins =
    ambition === "elite" &&
    minimumConstructorPosition <= 2 &&
    sponsor.category === "title" &&
    profile.prestigeRating >= 88 &&
    profile.roleAwareRating >= 85;

  if (canDemandWins) {
    target.minimumWins = 1;
    target.description += " Win at least once.";
  }

  if (term > SPONSOR_MIN_TERM_YEARS) {
    target.description += ` ${term}-year commitment raises expectations.`;
  }

  return target;
}

export function previewSponsorDeal(
  save: SaveData,
  teamId: string,
  sponsor: TeamSponsorSeed,
  termYears = SPONSOR_MIN_TERM_YEARS,
): SponsorDealPreview {
  ensureTeamExpectations(save);
  const season = save.season;
  const profile = profileForTeam(season, teamId);
  const teamCount = Math.max(1, Object.keys(season.teams).length || 11);
  const term = clampSponsorTermYears(termYears);
  return {
    target: buildSponsorRenewalTarget(teamId, sponsor, season, term),
    termYears: term,
    teamAnchor: profile.expectedConstructorPosition,
    prestigeCap: teamStrictestSponsorPosition(profile, teamCount),
  };
}

export function previewSponsorRenewal(
  save: SaveData,
  teamId: string,
  contract: SponsorContract,
  termYears = SPONSOR_MIN_TERM_YEARS,
): SponsorDealPreview {
  const seed: TeamSponsorSeed = {
    sponsorId: contract.sponsorId,
    name: contract.name,
    titleName: contract.titleName,
    category: contract.category,
    annualValue: Math.round(contract.annualValue * 1.04),
    ambition: contract.ambition,
    namingPartner: contract.namingPartner,
  };
  return previewSponsorDeal(save, teamId, seed, termYears);
}

export function createSponsorContract(
  teamId: string,
  sponsor: TeamSponsorSeed,
  season: Pick<SeasonState, "seasonYear" | "teams">,
  startSeason = season.seasonYear,
  termYears = sponsor.termYears ?? SPONSOR_MIN_TERM_YEARS,
): SponsorContract {
  const term = clampSponsorTermYears(termYears);
  return {
    id: contractId(teamId, sponsor.sponsorId, startSeason),
    sponsorId: sponsor.sponsorId,
    teamId,
    name: sponsor.name,
    titleName: sponsor.titleName,
    category: sponsor.category,
    annualValue: sponsor.annualValue,
    startSeason,
    endSeason: startSeason + term - 1,
    confidence: 62,
    renewalTarget: buildSponsorRenewalTarget(teamId, sponsor, season, term),
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
    contracts.push(...seed.sponsors.map((sponsor) => createSponsorContract(teamId, sponsor, seasonLike, seasonYear, SPONSOR_MIN_TERM_YEARS)));
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
    contracts.push(...customSponsors.map((sponsor) => createSponsorContract(customTeam.teamId, sponsor, seasonLike, seasonYear, SPONSOR_MIN_TERM_YEARS)));
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
  ensureTeamExpectations(save);
  const teamIds = Object.keys(season.teams);
  if (!Array.isArray(season.sponsorContracts) || season.sponsorContracts.length === 0) {
    const customTeam = season.teams["custom-player-team"]
      ? { teamId: "custom-player-team", constructorName: season.teams["custom-player-team"].name }
      : undefined;
    season.sponsorContracts = buildInitialSponsorContracts(teamIds, season.seasonYear, customTeam);
  }

  for (const contract of season.sponsorContracts) {
    if (contract.endSeason === contract.startSeason) {
      contract.endSeason = contract.startSeason + SPONSOR_MIN_TERM_YEARS - 1;
    }
    const term = inferredTermYears(contract);
    const seed: TeamSponsorSeed = {
      sponsorId: contract.sponsorId,
      name: contract.name,
      titleName: contract.titleName,
      category: contract.category,
      annualValue: contract.annualValue,
      ambition: contract.ambition,
      namingPartner: contract.namingPartner,
    };
    contract.renewalTarget = buildSponsorRenewalTarget(contract.teamId, seed, season, term);
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

const ALL_SPONSOR_CATEGORIES: SponsorCategory[] = ["title", "major", "technical", "apparel", "supplier"];

export function contractCoversSeason(contract: SponsorContract, seasonYear: number): boolean {
  return contract.startSeason <= seasonYear && contract.endSeason >= seasonYear;
}

export function leagueTakenSponsorIds(season: SeasonState, seasonYear: number): Set<string> {
  const taken = new Set<string>();
  for (const contract of season.sponsorContracts ?? []) {
    if (contractCoversSeason(contract, seasonYear)) {
      taken.add(contract.sponsorId);
    }
  }
  return taken;
}

export function teamFilledCategories(season: SeasonState, teamId: string, seasonYear: number): Set<SponsorCategory> {
  const filled = new Set<SponsorCategory>();
  for (const contract of season.sponsorContracts ?? []) {
    if (contract.teamId === teamId && contractCoversSeason(contract, seasonYear)) {
      filled.add(contract.category);
    }
  }
  return filled;
}

export function openTeamCategories(season: SeasonState, teamId: string, seasonYear: number): Set<SponsorCategory> {
  const filled = teamFilledCategories(season, teamId, seasonYear);
  return new Set(ALL_SPONSOR_CATEGORIES.filter((category) => !filled.has(category)));
}

export function teamSponsorSlotsFull(season: SeasonState, teamId: string, seasonYear: number): boolean {
  return openTeamCategories(season, teamId, seasonYear).size === 0;
}

export function playerSponsorSlotsFull(season: SeasonState, teamId: string, seasonYear: number): boolean {
  return teamSponsorSlotsFull(season, teamId, seasonYear);
}

export function availableSponsorMarket(season: SeasonState, teamId: string): TeamSponsorSeed[] {
  const nextYear = season.seasonYear + 1;
  const takenGlobally = leagueTakenSponsorIds(season, nextYear);
  const openCategories = openTeamCategories(season, teamId, nextYear);

  if (openCategories.size === 0) return [];

  return sponsorCatalog()
    .filter((sponsor) => !takenGlobally.has(sponsor.sponsorId) && openCategories.has(sponsor.category))
    .slice(0, 16);
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
  termYears = SPONSOR_MIN_TERM_YEARS,
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

  const term = clampSponsorTermYears(termYears);
  const seed: TeamSponsorSeed = {
    sponsorId: existing.sponsorId,
    name: existing.name,
    titleName: existing.titleName,
    category: existing.category,
    annualValue: Math.round(existing.annualValue * 1.04),
    termYears: term,
    ambition: existing.ambition,
    namingPartner: existing.namingPartner,
  };
  const contract = createSponsorContract(teamId, seed, season, season.seasonYear + 1, term);
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
  termYears = SPONSOR_MIN_TERM_YEARS,
): { ok: true; contract: SponsorContract } | { ok: false; error: string } {
  ensureSponsorState(save);
  const season = save.season;
  const sponsor = availableSponsorMarket(season, teamId).find((item) => item.sponsorId === sponsorId);
  if (!sponsor) return { ok: false, error: "Sponsor is not on the market." };

  const term = clampSponsorTermYears(termYears);
  const valueMultiplier = season.teams[teamId]?.standings.wins ? 1.08 : season.teams[teamId]?.standings.podiums ? 1.04 : 0.96;
  const contract = createSponsorContract(
    teamId,
    { ...sponsor, annualValue: Math.round(sponsor.annualValue * valueMultiplier), termYears: term },
    season,
    season.seasonYear + 1,
    term,
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
        const renewed = renewSponsorContract(save, team.id, contract.id, SPONSOR_MIN_TERM_YEARS);
        if (renewed.ok) events.push(event(`${team.abbreviation} renewed ${contract.name}.`, season, team.id));
      }
    }

    const categories = new Set(futureSponsorContracts(season, team.id, season.seasonYear).map((contract) => contract.category));
    for (const sponsor of availableSponsorMarket(season, team.id)) {
      if (categories.has(sponsor.category)) continue;
      const signed = signSponsorFromMarket(save, team.id, sponsor.sponsorId, SPONSOR_MIN_TERM_YEARS);
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
