import type { CarProfile } from "@/lib/sim/raceweekend/raceTypes";
import type {
  EventLogEntry,
  PowerUnitContract,
  PowerUnitDevelopmentProgram,
  PowerUnitFinancials,
  PowerUnitManufacturerId,
  PowerUnitManufacturerState,
  PowerUnitRatings,
  SaveData,
  SeasonState,
  TeamState,
} from "@/types/sim";

export const BASE_CUSTOMER_POWER_UNIT_PRICE = 20_000_000;
export const WORKS_POWER_UNIT_COST = Math.round(BASE_CUSTOMER_POWER_UNIT_PRICE * 0.35);
export const POWER_UNIT_SWITCH_INSTALLATION_COST = 5_000_000;

export const POWER_UNIT_DEVELOPMENT_COST: Record<PowerUnitDevelopmentProgram["level"], number> = {
  none: 0,
  standard: 18_000_000,
  aggressive: 35_000_000,
};

const WORKS_MANUFACTURER_BY_TEAM: Record<string, PowerUnitManufacturerId> = {
  mercedes: "mercedes",
  ferrari: "ferrari",
  "aston-martin": "honda",
  audi: "audi",
  "red-bull": "red-bull-ford",
};

const INITIAL_CUSTOMER_SUPPLIERS: Record<string, PowerUnitManufacturerId> = {
  alpine: "mercedes",
  williams: "mercedes",
  mclaren: "mercedes",
  cadillac: "ferrari",
  haas: "ferrari",
  "racing-bulls": "red-bull-ford",
};

const OPEN_SUPPLIER_PREFERENCE: PowerUnitManufacturerId[] = ["ferrari", "honda", "audi", "mercedes"];
const RED_BULL_FORD_ELIGIBLE_TEAMS = ["red-bull", "racing-bulls"];
const CONTRACT_TERM_YEARS = 3;

const MANUFACTURER_ORDER: PowerUnitManufacturerId[] = ["mercedes", "ferrari", "honda", "audi", "red-bull-ford"];

function clamp(value: number, min = 40, max = 99): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function withOverall(ratings: Omit<PowerUnitRatings, "overall">): PowerUnitRatings {
  return {
    ...ratings,
    overall: Math.round(ratings.ice * 0.36 + ratings.ers * 0.26 + ratings.reliability * 0.26 + ratings.integration * 0.12),
  };
}

function contractId(teamId: string, manufacturerId: PowerUnitManufacturerId, startSeason: number): string {
  return `${teamId}-${manufacturerId}-${startSeason}`;
}

function event(
  category: EventLogEntry["category"],
  message: string,
  week: number,
  tick: number,
  teamId?: string,
): EventLogEntry {
  return {
    id: `${category}-pu-${week}-${tick}-${Math.random().toString(16).slice(2, 6)}`,
    category,
    message,
    week,
    tick,
    teamId,
    createdAt: new Date().toISOString(),
  };
}

function createRng(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDefaultPowerUnits(): Record<PowerUnitManufacturerId, PowerUnitManufacturerState> {
  return {
    mercedes: {
      id: "mercedes",
      name: "Mercedes-AMG",
      engineName: "Mercedes-AMG F1 M17",
      worksTeamId: "mercedes",
      customerCapacity: 3,
      ratings: withOverall({ ice: 93, ers: 94, reliability: 91, integration: 92 }),
      pendingDevelopmentProgram: null,
    },
    ferrari: {
      id: "ferrari",
      name: "Ferrari",
      engineName: "Ferrari 067/6",
      worksTeamId: "ferrari",
      customerCapacity: 3,
      ratings: withOverall({ ice: 91, ers: 92, reliability: 88, integration: 90 }),
      pendingDevelopmentProgram: null,
    },
    honda: {
      id: "honda",
      name: "Honda",
      engineName: "Honda RA626H",
      worksTeamId: "aston-martin",
      customerCapacity: 3,
      ratings: withOverall({ ice: 90, ers: 91, reliability: 89, integration: 90 }),
      pendingDevelopmentProgram: null,
    },
    audi: {
      id: "audi",
      name: "Audi",
      engineName: "Audi AFR 26 Hybrid",
      worksTeamId: "audi",
      customerCapacity: 3,
      ratings: withOverall({ ice: 88, ers: 88, reliability: 84, integration: 82 }),
      pendingDevelopmentProgram: null,
    },
    "red-bull-ford": {
      id: "red-bull-ford",
      name: "Red Bull-Ford",
      engineName: "Red Bull Ford DM01",
      worksTeamId: "red-bull",
      customerCapacity: 3,
      exclusiveTeamIds: RED_BULL_FORD_ELIGIBLE_TEAMS,
      ratings: withOverall({ ice: 96, ers: 92, reliability: 85, integration: 84 }),
      pendingDevelopmentProgram: null,
    },
  };
}

export function isWorksTeamId(teamId: string): boolean {
  return WORKS_MANUFACTURER_BY_TEAM[teamId] !== undefined;
}

export function worksManufacturerForTeam(teamId: string): PowerUnitManufacturerId | null {
  return WORKS_MANUFACTURER_BY_TEAM[teamId] ?? null;
}

export function isPowerUnitEligibleForTeam(manufacturerId: PowerUnitManufacturerId, teamId: string): boolean {
  const worksManufacturer = worksManufacturerForTeam(teamId);
  if (worksManufacturer) return worksManufacturer === manufacturerId;
  if (manufacturerId === "red-bull-ford") return RED_BULL_FORD_ELIGIBLE_TEAMS.includes(teamId);
  return true;
}

export function activePowerUnitContract(
  season: SeasonState,
  teamId: string,
  seasonYear = season.seasonYear,
): PowerUnitContract | null {
  return [...(season.powerUnitContracts ?? [])]
    .filter((contract) => contract.teamId === teamId && contract.startSeason <= seasonYear && contract.endSeason >= seasonYear)
    .sort((a, b) => b.startSeason - a.startSeason || b.endSeason - a.endSeason)[0] ?? null;
}

export function activeManufacturerForTeam(
  season: SeasonState,
  teamId: string,
  seasonYear = season.seasonYear,
): PowerUnitManufacturerId | null {
  return activePowerUnitContract(season, teamId, seasonYear)?.manufacturerId ?? null;
}

export function customerContractsForManufacturer(
  season: SeasonState,
  manufacturerId: PowerUnitManufacturerId,
  seasonYear = season.seasonYear,
): PowerUnitContract[] {
  return (season.powerUnitContracts ?? []).filter(
    (contract) =>
      contract.manufacturerId === manufacturerId &&
      !contract.isWorksSupply &&
      contract.startSeason <= seasonYear &&
      contract.endSeason >= seasonYear,
  );
}

export function availableCustomerSlots(
  season: SeasonState,
  manufacturerId: PowerUnitManufacturerId,
  seasonYear = season.seasonYear,
  excludingTeamId?: string,
): number {
  const manufacturer = season.powerUnits?.[manufacturerId] ?? createDefaultPowerUnits()[manufacturerId];
  const customerTeamIds = new Set(
    customerContractsForManufacturer(season, manufacturerId, seasonYear)
      .filter((contract) => contract.teamId !== excludingTeamId)
      .map((contract) => contract.teamId),
  );
  return Math.max(0, manufacturer.customerCapacity - customerTeamIds.size);
}

export function canManufacturerSupplyTeam(
  season: SeasonState,
  manufacturerId: PowerUnitManufacturerId,
  teamId: string,
  seasonYear = season.seasonYear,
): boolean {
  if (!isPowerUnitEligibleForTeam(manufacturerId, teamId)) return false;
  if (worksManufacturerForTeam(teamId)) return true;
  return availableCustomerSlots(season, manufacturerId, seasonYear, teamId) > 0;
}

function annualPriceForManufacturer(season: SeasonState, manufacturerId: PowerUnitManufacturerId): number {
  const ratings = season.powerUnits?.[manufacturerId]?.ratings ?? createDefaultPowerUnits()[manufacturerId].ratings;
  const discount = Math.max(0, Math.round((90 - ratings.overall) * 300_000));
  return Math.max(16_000_000, BASE_CUSTOMER_POWER_UNIT_PRICE - discount);
}

function createWorksContract(teamId: string, manufacturerId: PowerUnitManufacturerId, seasonYear: number): PowerUnitContract {
  return {
    id: contractId(teamId, manufacturerId, seasonYear),
    teamId,
    manufacturerId,
    startSeason: seasonYear,
    endSeason: seasonYear + CONTRACT_TERM_YEARS - 1,
    annualPrice: WORKS_POWER_UNIT_COST,
    isWorksSupply: true,
    signedSeason: seasonYear,
  };
}

function createCustomerContract(
  season: SeasonState,
  teamId: string,
  manufacturerId: PowerUnitManufacturerId,
  startSeason: number,
  lengthYears: number,
  previousManufacturerId?: PowerUnitManufacturerId,
  isFiaAssigned = false,
): PowerUnitContract {
  const changedSupplier = previousManufacturerId !== undefined && previousManufacturerId !== manufacturerId;
  return {
    id: contractId(teamId, manufacturerId, startSeason),
    teamId,
    manufacturerId,
    startSeason,
    endSeason: startSeason + Math.min(3, Math.max(1, lengthYears)) - 1,
    annualPrice: annualPriceForManufacturer(season, manufacturerId),
    isWorksSupply: false,
    signedSeason: season.seasonYear,
    adaptationPenaltyUntilSeason: changedSupplier ? startSeason : undefined,
    installationCost: changedSupplier ? POWER_UNIT_SWITCH_INSTALLATION_COST : undefined,
    isFiaAssigned,
  };
}

function initialCustomerManufacturerForTeam(teamId: string): PowerUnitManufacturerId | null {
  return INITIAL_CUSTOMER_SUPPLIERS[teamId] ?? null;
}

function chooseFallbackSupplier(
  season: SeasonState,
  teamId: string,
  seasonYear = season.seasonYear,
): PowerUnitManufacturerId {
  const preferred = initialCustomerManufacturerForTeam(teamId);
  if (preferred && canManufacturerSupplyTeam(season, preferred, teamId, seasonYear)) return preferred;

  for (const manufacturerId of OPEN_SUPPLIER_PREFERENCE) {
    if (canManufacturerSupplyTeam(season, manufacturerId, teamId, seasonYear)) return manufacturerId;
  }

  const eligible = OPEN_SUPPLIER_PREFERENCE.filter((manufacturerId) => isPowerUnitEligibleForTeam(manufacturerId, teamId));
  return eligible.sort((a, b) => availableCustomerSlots(season, b, seasonYear) - availableCustomerSlots(season, a, seasonYear))[0] ?? "ferrari";
}

export function buildInitialPowerUnitState(
  teamIds: string[],
  seasonYear: number,
): {
  powerUnits: Record<PowerUnitManufacturerId, PowerUnitManufacturerState>;
  powerUnitContracts: PowerUnitContract[];
} {
  const powerUnits = createDefaultPowerUnits();
  const seasonLike: SeasonState = {
    seasonYear,
    currentWeek: 1,
    currentRound: 1,
    tick: 0,
    calendar: [],
    teams: {},
    pendingDecisions: [],
    decisionHistory: [],
    raceHistory: [],
    archive: [],
    constructorDevelopmentHistory: [],
    eventLog: [],
    driverStandings: {},
    roster: {},
    academy: { prospects: [] },
    jobSecurity: {
      confidenceScore: 70,
      warningLevel: "none",
      consecutiveLowConfidenceSeasons: 0,
      lastReview: null,
    },
    powerUnits,
    powerUnitContracts: [],
  };

  for (const teamId of teamIds) {
    const worksManufacturer = worksManufacturerForTeam(teamId);
    if (worksManufacturer) {
      seasonLike.powerUnitContracts.push(createWorksContract(teamId, worksManufacturer, seasonYear));
    }
  }

  for (const teamId of teamIds) {
    if (worksManufacturerForTeam(teamId)) continue;
    const manufacturerId = chooseFallbackSupplier(seasonLike, teamId, seasonYear);
    seasonLike.powerUnitContracts.push(createCustomerContract(seasonLike, teamId, manufacturerId, seasonYear, CONTRACT_TERM_YEARS));
  }

  return { powerUnits, powerUnitContracts: seasonLike.powerUnitContracts };
}

function normalizePowerUnitState(state: PowerUnitManufacturerState): PowerUnitManufacturerState {
  const defaults = createDefaultPowerUnits()[state.id];
  return {
    ...defaults,
    ...state,
    ratings: withOverall({
      ice: clamp(state.ratings?.ice ?? defaults.ratings.ice),
      ers: clamp(state.ratings?.ers ?? defaults.ratings.ers),
      reliability: clamp(state.ratings?.reliability ?? defaults.ratings.reliability),
      integration: clamp(state.ratings?.integration ?? defaults.ratings.integration),
    }),
    pendingDevelopmentProgram: state.pendingDevelopmentProgram ?? null,
  };
}

export function ensurePowerUnitState(save: SaveData): void {
  const season = save.season;
  const teamIds = Object.keys(season.teams);
  const initial = buildInitialPowerUnitState(teamIds, season.seasonYear);

  season.powerUnits = {
    ...initial.powerUnits,
    ...(season.powerUnits ?? {}),
  };

  for (const manufacturerId of MANUFACTURER_ORDER) {
    season.powerUnits[manufacturerId] = normalizePowerUnitState(season.powerUnits[manufacturerId]);
  }

  season.powerUnitContracts = Array.isArray(season.powerUnitContracts)
    ? [...season.powerUnitContracts]
    : [...initial.powerUnitContracts];

  season.powerUnitContracts = season.powerUnitContracts.filter((contract) => {
    if (contract.manufacturerId !== "red-bull-ford") return true;
    return isPowerUnitEligibleForTeam("red-bull-ford", contract.teamId);
  });

  for (const team of Object.values(season.teams)) {
    team.teamType = isWorksTeamId(team.id) ? "works" : "customer";
  }

  for (const teamId of teamIds) {
    if (activePowerUnitContract(season, teamId)) continue;
    const worksManufacturer = worksManufacturerForTeam(teamId);
    if (worksManufacturer) {
      season.powerUnitContracts.push(createWorksContract(teamId, worksManufacturer, season.seasonYear));
      continue;
    }
    const manufacturerId = chooseFallbackSupplier(season, teamId);
    season.powerUnitContracts.push(
      createCustomerContract(season, teamId, manufacturerId, season.seasonYear, CONTRACT_TERM_YEARS, undefined, true),
    );
  }

}

function weeksInSeason(season: SeasonState): number {
  return Math.max(1, season.calendar.length || 50);
}

export function calculatePowerUnitFinancials(season: SeasonState, teamId: string): PowerUnitFinancials {
  const contract = activePowerUnitContract(season, teamId);
  const manufacturerId = worksManufacturerForTeam(teamId);
  const annualCost = contract?.annualPrice ?? 0;
  const annualRevenue = manufacturerId
    ? customerContractsForManufacturer(season, manufacturerId).reduce((sum, item) => sum + item.annualPrice, 0)
    : 0;
  const weeks = weeksInSeason(season);

  return {
    annualCost,
    annualRevenue,
    weeklyCost: Math.round(annualCost / weeks),
    weeklyRevenue: Math.round(annualRevenue / weeks),
    weeklyNet: Math.round((annualRevenue - annualCost) / weeks),
  };
}

export function applyPowerUnitWeeklyEconomy(season: SeasonState): void {
  for (const team of Object.values(season.teams)) {
    const financials = calculatePowerUnitFinancials(season, team.id);
    team.budget += financials.weeklyNet;
  }
}

export function applyPowerUnitPerformance(profile: CarProfile, season: SeasonState | undefined, teamId: string): CarProfile {
  if (!season?.powerUnits) return profile;

  const contract = activePowerUnitContract(season, teamId);
  if (!contract) return profile;

  const powerUnit = season.powerUnits[contract.manufacturerId];
  if (!powerUnit) return profile;

  const adaptationPenalty =
    contract.adaptationPenaltyUntilSeason !== undefined && contract.adaptationPenaltyUntilSeason >= season.seasonYear ? 3 : 0;
  const ratings = powerUnit.ratings;
  const iceDelta = (ratings.ice - 90) * 0.45;
  const ersDelta = (ratings.ers - 90) * 0.35;
  const reliabilityDelta = (ratings.reliability - 88) * 0.45 - adaptationPenalty;
  const integrationDelta = (ratings.integration - 88) * 0.2 - adaptationPenalty * 0.45;

  const topSpeed = clamp(profile.topSpeed + iceDelta + ersDelta * 0.35 + integrationDelta);
  const cooling = clamp(profile.cooling + ersDelta * 0.5 + integrationDelta * 0.4);
  const reliability = clamp(profile.reliability + reliabilityDelta + integrationDelta * 0.3);
  const tireWear = clamp(profile.tireWear + ersDelta * 0.2);
  const overall = clamp(profile.overall + iceDelta * 0.25 + ersDelta * 0.2 + reliabilityDelta * 0.18 + integrationDelta * 0.15);

  return {
    ...profile,
    overall,
    topSpeed,
    tireWear,
    cooling,
    reliability,
  };
}

function contractLengthForTeam(team: TeamState, manufacturer: PowerUnitManufacturerState): number {
  if (team.budget < 70_000_000) return 1;
  if (manufacturer.ratings.overall >= 91 || team.strategyProfile.budgetDiscipline > 0.7) return 3;
  return 2;
}

function scoreSupplier(
  season: SeasonState,
  team: TeamState,
  manufacturerId: PowerUnitManufacturerId,
  previousManufacturerId?: PowerUnitManufacturerId,
): number {
  const manufacturer = season.powerUnits[manufacturerId];
  const ratings = manufacturer.ratings;
  const annualPrice = annualPriceForManufacturer(season, manufacturerId);
  const budgetPressure = team.budget < 75_000_000 ? 1.4 : team.budget < 110_000_000 ? 1.1 : 0.8;
  const continuity = previousManufacturerId === manufacturerId ? 5 : 0;
  const switchPenalty = previousManufacturerId && previousManufacturerId !== manufacturerId ? 2.5 : 0;
  return (
    ratings.ice * 0.34 +
    ratings.ers * 0.2 +
    ratings.reliability * 0.3 +
    ratings.integration * 0.16 +
    continuity -
    switchPenalty -
    (annualPrice / 1_000_000) * budgetPressure * 0.45
  );
}

function chooseAiSupplier(
  season: SeasonState,
  team: TeamState,
  seasonYear: number,
  previousManufacturerId?: PowerUnitManufacturerId,
): PowerUnitManufacturerId {
  return OPEN_SUPPLIER_PREFERENCE.filter((manufacturerId) =>
    canManufacturerSupplyTeam(season, manufacturerId, team.id, seasonYear),
  ).sort((a, b) => {
    const scoreDelta = scoreSupplier(season, team, b, previousManufacturerId) - scoreSupplier(season, team, a, previousManufacturerId);
    if (Math.abs(scoreDelta) > 0.01) return scoreDelta;
    return MANUFACTURER_ORDER.indexOf(a) - MANUFACTURER_ORDER.indexOf(b);
  })[0] ?? chooseFallbackSupplier(season, team.id, seasonYear);
}

function applyInstallationCost(
  season: SeasonState,
  contract: PowerUnitContract,
  events: EventLogEntry[],
): void {
  if (contract.startSeason !== season.seasonYear || !contract.installationCost) return;
  const team = season.teams[contract.teamId];
  if (!team) return;
  team.budget = Math.max(0, team.budget - contract.installationCost);
  events.push(
    event(
      "finance",
      `${team.abbreviation} paid ${contract.installationCost.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })} to integrate a new ${season.powerUnits[contract.manufacturerId]?.name ?? "power unit"} package.`,
      season.currentWeek,
      season.tick,
      team.id,
    ),
  );
}

function applyDevelopmentProgram(
  season: SeasonState,
  manufacturer: PowerUnitManufacturerState,
  events: EventLogEntry[],
): void {
  const program = manufacturer.pendingDevelopmentProgram ?? { level: "none", focus: "balanced" as const };
  if (program.level === "none") {
    manufacturer.pendingDevelopmentProgram = null;
    return;
  }

  const worksTeam = season.teams[manufacturer.worksTeamId];
  const cost = POWER_UNIT_DEVELOPMENT_COST[program.level];
  if (worksTeam) worksTeam.budget = Math.max(0, worksTeam.budget - cost);

  const rng = createRng(`${season.seasonYear}:${manufacturer.id}:${program.level}:${program.focus}`);
  const currentAverage = average([manufacturer.ratings.ice, manufacturer.ratings.ers, manufacturer.ratings.reliability]);
  const catchup = clamp((93 - currentAverage) / 12 + 1, 0.65, 1.45);
  const benchmarkPenalty = manufacturer.id === "red-bull-ford" ? 0.72 : 1;
  const spendMultiplier = program.level === "aggressive" ? 1.8 : 1;
  const gain = (base: number) => Math.max(0, Math.round((base + rng() * 1.2) * catchup * benchmarkPenalty * spendMultiplier));
  let iceGain = 0;
  let ersGain = 0;
  let reliabilityGain = 0;
  const integrationGain = gain(0.35);

  if (program.focus === "ice") iceGain = gain(1.2);
  if (program.focus === "ers") ersGain = gain(1.2);
  if (program.focus === "reliability") reliabilityGain = gain(1.2);
  if (program.focus === "balanced") {
    iceGain = gain(0.65);
    ersGain = gain(0.65);
    reliabilityGain = gain(0.65);
  }

  const aggressiveReliabilityRisk = program.level === "aggressive" && rng() < 0.18 ? 1 : 0;
  manufacturer.ratings = withOverall({
    ice: clamp(manufacturer.ratings.ice + iceGain),
    ers: clamp(manufacturer.ratings.ers + ersGain),
    reliability: clamp(manufacturer.ratings.reliability + reliabilityGain - aggressiveReliabilityRisk),
    integration: clamp(manufacturer.ratings.integration + integrationGain),
  });
  manufacturer.pendingDevelopmentProgram = null;

  events.push(
    event(
      "rd",
      `${manufacturer.name} completed an offseason PU program: +${iceGain} ICE, +${ersGain} ERS, +${Math.max(
        0,
        reliabilityGain - aggressiveReliabilityRisk,
      )} reliability.`,
      season.currentWeek,
      season.tick,
      manufacturer.worksTeamId,
    ),
  );
}

function ensureWorksContract(season: SeasonState, teamId: string, manufacturerId: PowerUnitManufacturerId): void {
  if (activePowerUnitContract(season, teamId, season.seasonYear)) return;
  season.powerUnitContracts.push(createWorksContract(teamId, manufacturerId, season.seasonYear));
}

export function applyPowerUnitOffseason(save: SaveData, newYear: number): EventLogEntry[] {
  ensurePowerUnitState(save);
  const season = save.season;
  const events: EventLogEntry[] = [];

  for (const manufacturerId of MANUFACTURER_ORDER) {
    applyDevelopmentProgram(season, season.powerUnits[manufacturerId], events);
  }

  for (const [teamId, manufacturerId] of Object.entries(WORKS_MANUFACTURER_BY_TEAM)) {
    if (season.teams[teamId]) ensureWorksContract(season, teamId, manufacturerId);
  }

  for (const team of Object.values(season.teams)) {
    if (isWorksTeamId(team.id)) continue;

    const current = activePowerUnitContract(season, team.id, newYear);
    if (current) {
      applyInstallationCost(season, current, events);
      continue;
    }

    const previous = activePowerUnitContract(season, team.id, newYear - 1);
    const manufacturerId = chooseAiSupplier(season, team, newYear, previous?.manufacturerId);
    const lengthYears = contractLengthForTeam(team, season.powerUnits[manufacturerId]);
    const contract = createCustomerContract(season, team.id, manufacturerId, newYear, lengthYears, previous?.manufacturerId);
    season.powerUnitContracts.push(contract);
    applyInstallationCost(season, contract, events);
    events.push(
      event(
        "finance",
        `${team.abbreviation} signed a ${lengthYears}-year ${season.powerUnits[manufacturerId].name} power unit deal.`,
        season.currentWeek,
        season.tick,
        team.id,
      ),
    );
  }

  for (const team of Object.values(season.teams)) {
    if (activePowerUnitContract(season, team.id, newYear)) continue;
    const manufacturerId = chooseFallbackSupplier(season, team.id, newYear);
    season.powerUnitContracts.push(
      createCustomerContract(season, team.id, manufacturerId, newYear, 1, undefined, true),
    );
    events.push(
      event(
        "finance",
        `The FIA allocated ${team.abbreviation} a ${season.powerUnits[manufacturerId].name} power unit supply.`,
        season.currentWeek,
        season.tick,
        team.id,
      ),
    );
  }

  return events;
}

export function commitPowerUnitDevelopmentProgram(
  save: SaveData,
  teamId: string,
  program: PowerUnitDevelopmentProgram,
): { ok: true } | { ok: false; error: string } {
  ensurePowerUnitState(save);
  const manufacturerId = worksManufacturerForTeam(teamId);
  if (!manufacturerId) return { ok: false, error: "Only works teams can set a power unit development program." };
  save.season.powerUnits[manufacturerId].pendingDevelopmentProgram = program;
  return { ok: true };
}

export function signPlayerPowerUnitContract(
  save: SaveData,
  teamId: string,
  manufacturerId: PowerUnitManufacturerId,
  lengthYears: number,
): { ok: true } | { ok: false; error: string } {
  ensurePowerUnitState(save);
  if (isWorksTeamId(teamId)) return { ok: false, error: "Works teams cannot switch away from their factory power unit." };
  if (lengthYears < 1 || lengthYears > 3) return { ok: false, error: "Power unit contracts must run for one to three seasons." };

  const season = save.season;
  const current = activePowerUnitContract(season, teamId);
  if (current && current.endSeason > season.seasonYear) {
    return { ok: false, error: "The current power unit contract has not expired yet." };
  }

  const startSeason = season.seasonYear + 1;
  if ((season.powerUnitContracts ?? []).some((contract) => contract.teamId === teamId && contract.startSeason >= startSeason)) {
    return { ok: false, error: "A future power unit contract is already signed." };
  }
  if (!canManufacturerSupplyTeam(season, manufacturerId, teamId, startSeason)) {
    return { ok: false, error: "That manufacturer cannot legally supply this team." };
  }

  season.powerUnitContracts.push(
    createCustomerContract(season, teamId, manufacturerId, startSeason, lengthYears, current?.manufacturerId),
  );
  return { ok: true };
}

export function powerUnitMarketForTeam(season: SeasonState, teamId: string, seasonYear = season.seasonYear) {
  const current = activePowerUnitContract(season, teamId, seasonYear);
  return MANUFACTURER_ORDER.map((manufacturerId) => {
    const manufacturer = season.powerUnits[manufacturerId];
    const eligible = isPowerUnitEligibleForTeam(manufacturerId, teamId);
    const slots = availableCustomerSlots(season, manufacturerId, seasonYear + 1, teamId);
    const isCurrentSupplier = current?.manufacturerId === manufacturerId;
    return {
      manufacturerId,
      manufacturer,
      annualPrice: annualPriceForManufacturer(season, manufacturerId),
      availableSlots: slots,
      eligible,
      isCurrentSupplier,
      canSupply: eligible && (isCurrentSupplier || slots > 0),
      customerCount: customerContractsForManufacturer(season, manufacturerId, seasonYear).length,
    };
  });
}
