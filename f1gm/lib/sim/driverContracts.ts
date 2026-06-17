import { buildDriverSeasonInfo } from "@/lib/sim/roster";
import { getTeamExpectationProfile } from "@/lib/sim/ownerConfidence";
import type {
  DriverContract,
  DriverLineupRole,
  DriverMood,
  DriverMoodFactor,
  EventLogEntry,
  SaveData,
  SeasonState,
} from "@/types/sim";

export type DriverOffer = {
  years: number;
  salary: number;
  role: DriverLineupRole;
};

export type DriverMarketRow = {
  driverId: string;
  name: string;
  age: number;
  currentTeamId: string;
  currentTeamName: string;
  role: DriverLineupRole;
  overall: number;
  potential: number;
  mood: DriverMood;
  expectedSalary: number;
  contractEnds: number | null;
  signDisabledReason: string | null;
  optimalOffer: DriverOffer | null;
  salaryOptions: number[];
  yearOptions: number[];
};

const FREE_AGENT_NAMES = [
  "Theo Pourchaire",
  "Felipe Drugovich",
  "Mick Schumacher",
  "Pato O'Ward",
  "Robert Shwartzman",
  "Jak Crawford",
  "Ayumu Iwasa",
  "Paul Aron",
  "Victor Martins",
  "Ritomo Miyata",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function contractId(driverId: string, teamId: string, startSeason: number): string {
  return `${driverId}-${teamId}-${startSeason}`;
}

function event(message: string, season: SeasonState, teamId?: string): EventLogEntry {
  return {
    id: `driver-contract-${season.currentWeek}-${season.tick}-${Math.random().toString(16).slice(2, 6)}`,
    category: "staff",
    message,
    week: season.currentWeek,
    tick: season.tick,
    teamId,
    createdAt: new Date().toISOString(),
  };
}

function weeksInSeason(season: SeasonState): number {
  return Math.max(1, season.calendar.length || 50);
}

export function activeDriverContract(
  season: SeasonState,
  driverId: string,
  seasonYear = season.seasonYear,
): DriverContract | null {
  return [...(season.driverContracts ?? [])]
    .filter((contract) => contract.driverId === driverId && contract.startSeason <= seasonYear && contract.endSeason >= seasonYear)
    .sort((a, b) => b.startSeason - a.startSeason || b.endSeason - a.endSeason)[0] ?? null;
}

export function futureDriverContract(
  season: SeasonState,
  driverId: string,
  seasonYear = season.seasonYear,
): DriverContract | null {
  return [...(season.driverContracts ?? [])]
    .filter((contract) => contract.driverId === driverId && contract.startSeason > seasonYear)
    .sort((a, b) => a.startSeason - b.startSeason)[0] ?? null;
}

export function teamDriverContracts(
  season: SeasonState,
  teamId: string,
  seasonYear = season.seasonYear,
): DriverContract[] {
  return (season.driverContracts ?? []).filter(
    (contract) => contract.teamId === teamId && contract.startSeason <= seasonYear && contract.endSeason >= seasonYear,
  );
}

function annualSalaryForDriver(driver: { profile: { overall: number }; age: number }, role: DriverLineupRole): number {
  const overall = driver.profile.overall;
  const roleMultiplier = role === "race" ? 1 : 0.28;
  const agePrime = driver.age >= 24 && driver.age <= 34 ? 1.08 : driver.age > 38 ? 0.88 : 1;
  const raw = Math.round((1_000_000 + Math.max(0, overall - 62) ** 2 * 42_000) * roleMultiplier * agePrime);
  return Math.max(role === "race" ? 2_000_000 : 450_000, raw);
}

export function calculateDriverContractFinancials(season: SeasonState, teamId: string) {
  const annualCost = teamDriverContracts(season, teamId).reduce((sum, contract) => sum + contract.salary, 0);
  return {
    annualCost,
    weeklyCost: Math.round(annualCost / weeksInSeason(season)),
  };
}

export function applyDriverContractWeeklyEconomy(season: SeasonState): void {
  for (const team of Object.values(season.teams)) {
    team.budget -= calculateDriverContractFinancials(season, team.id).weeklyCost;
  }
}

export function createDriverContract(
  driverId: string,
  teamId: string,
  salary: number,
  startSeason: number,
  years: number,
  role: DriverLineupRole,
): DriverContract {
  return {
    id: contractId(driverId, teamId, startSeason),
    driverId,
    teamId,
    salary,
    startSeason,
    endSeason: startSeason + Math.max(1, years) - 1,
    role,
    status: startSeason > new Date().getFullYear() ? "future" : "active",
  };
}

function createInitialContracts(season: SeasonState): DriverContract[] {
  return Object.values(season.roster)
    .filter((driver) => driver.active && driver.teamId !== "free-agent")
    .map((driver) => ({
      ...createDriverContract(
        driver.driverId,
        driver.teamId,
        annualSalaryForDriver(driver, driver.lineupRole),
        season.seasonYear,
        1,
        driver.lineupRole,
      ),
      status: "active" as const,
    }));
}

function ensureFreeAgentPool(season: SeasonState): void {
  const freeAgents = Object.values(season.roster).filter((driver) => driver.active && driver.teamId === "free-agent");
  if (freeAgents.length >= 8) return;

  for (let i = freeAgents.length; i < 8; i += 1) {
    const driverId = `free-agent-${season.seasonYear}-${i + 1}`;
    if (season.roster[driverId]) continue;
    season.roster[driverId] = buildDriverSeasonInfo(driverId, "free-agent", season.seasonYear, {
      name: FREE_AGENT_NAMES[i % FREE_AGENT_NAMES.length],
      age: 21 + ((i * 3) % 15),
      lineupRole: "reserve",
      debutYear: season.seasonYear,
    });
  }
}

function moodLabel(score: number): DriverMood["label"] {
  if (score >= 75) return "eager";
  if (score >= 58) return "open";
  if (score >= 40) return "uncertain";
  return "unhappy";
}

function factor(label: string, detail: string, delta: number): DriverMoodFactor {
  return {
    label,
    detail,
    delta,
    tone: delta > 2 ? "good" : delta < -2 ? "bad" : "neutral",
  };
}

function constructorPosition(season: SeasonState, teamId: string): number {
  const standings = Object.values(season.teams).sort(
    (a, b) => b.standings.points - a.standings.points || b.standings.wins - a.standings.wins || b.standings.podiums - a.standings.podiums,
  );
  const index = standings.findIndex((team) => team.id === teamId);
  return index === -1 ? standings.length : index + 1;
}

function recentInvestmentScore(season: SeasonState, teamId: string): number {
  const decisions = season.decisionHistory.filter((decision) => decision.teamId === teamId).slice(-8);
  if (!decisions.length) return 0;
  const averageSpend =
    decisions.reduce(
      (sum, decision) => sum + decision.rdSpend + decision.reliabilitySpend + decision.facilitySpend + decision.staffSpend,
      0,
    ) / decisions.length;
  return clamp(Math.round((averageSpend - 1_400_000) / 180_000), -8, 10);
}

export type DriverOfferPreview = {
  accepted: boolean;
  label: "likely" | "uncertain" | "unlikely" | "refused";
  reason: string;
  score: number;
  factors: DriverMoodFactor[];
};

function evaluateOfferTerms(
  driver: { age: number },
  offer: DriverOffer,
  expectedSalary: number,
): { salaryDelta: number; lengthDelta: number; factors: DriverMoodFactor[] } {
  const salaryRatio = offer.salary / Math.max(1, expectedSalary);
  const salaryDelta = (salaryRatio - 1) * 78;

  let lengthDelta = 0;
  let lengthDetail = "";
  if (driver.age <= 24) {
    if (offer.years >= 3) {
      lengthDelta = 10;
      lengthDetail = "A long deal offers security early in their career.";
    } else if (offer.years >= 2) {
      lengthDelta = 6;
      lengthDetail = "A multi-year deal is attractive.";
    } else {
      lengthDelta = -4;
      lengthDetail = "A one-year deal feels short for a young driver.";
    }
  } else if (driver.age >= 36) {
    if (offer.years <= 2) {
      lengthDelta = 8;
      lengthDetail = "A shorter commitment suits a veteran driver.";
    } else if (offer.years === 3) {
      lengthDelta = 2;
      lengthDetail = "Three years is acceptable, but not ideal.";
    } else {
      lengthDelta = -6;
      lengthDetail = "A four- or five-year deal is too long at this stage.";
    }
  } else if (offer.years >= 3) {
    lengthDelta = 9;
    lengthDetail = "A three-year deal provides stability.";
  } else if (offer.years >= 2) {
    lengthDelta = 5;
    lengthDetail = "A two-year deal is reasonable.";
  } else {
    lengthDelta = -5;
    lengthDetail = "A one-year deal signals little long-term commitment.";
  }

  const factors: DriverMoodFactor[] = [
    factor(
      "Salary offer",
      salaryRatio >= 1.35
        ? `${Math.round(salaryRatio * 100)}% of expected — a strong package.`
        : salaryRatio >= 1
          ? `${Math.round(salaryRatio * 100)}% of expected salary.`
          : `${Math.round(salaryRatio * 100)}% of expected — below the asking rate.`,
      Math.round(salaryDelta),
    ),
    factor("Contract length", `${offer.years} year${offer.years === 1 ? "" : "s"}. ${lengthDetail}`, Math.round(lengthDelta)),
  ];

  return { salaryDelta, lengthDelta, factors };
}

export function evaluateDriverMood(save: SaveData, driverId: string, targetTeamId: string): DriverMood {
  const season = save.season;
  const driver = season.roster[driverId];
  const team = season.teams[targetTeamId];
  if (!driver || !team) {
    return { driverId, score: 35, label: "unhappy", factors: [factor("No fit", "The driver cannot evaluate this seat.", -20)] };
  }

  const position = constructorPosition(season, targetTeamId);
  const teamProfile = getTeamExpectationProfile(targetTeamId, season);
  const carAverage = Math.round((team.car.pace + team.car.efficiency + team.car.reliability) / 3);
  const investment = recentInvestmentScore(season, targetTeamId);
  const factors: DriverMoodFactor[] = [];

  factors.push(
    factor(
      "Team prestige",
      `${teamProfile.roleLabel} (${teamProfile.prestigeRating}/100).`,
      clamp(Math.round((teamProfile.prestigeRating - 58) / 4), -8, 12),
    ),
  );
  factors.push(
    factor(
      "Team performance",
      `Constructor position P${position} (expected P${teamProfile.expectedConstructorPosition}).`,
      clamp(14 - position * 2 + (teamProfile.expectedConstructorPosition - position), -10, 14),
    ),
  );
  factors.push(
    factor(
      "Car quality",
      `Current car platform ${carAverage}/100.`,
      clamp(Math.round((carAverage - 68) / 2), -10, 12),
    ),
  );
  factors.push(
    factor(
      "Team investment",
      investment >= 0 ? "Recent team spending shows ambition." : "Recent investment has been cautious.",
      investment,
    ),
  );
  factors.push(
    factor(
      "Team culture",
      `Team morale ${Math.round(team.morale)}%.`,
      clamp(Math.round((team.morale - 60) / 3), -8, 9),
    ),
  );
  factors.push(
    factor(
      "Budget health",
      team.budget >= 100_000_000 ? "The team has room to fund the programme." : "Budget pressure could limit progress.",
      team.budget >= 140_000_000 ? 8 : team.budget >= 90_000_000 ? 3 : -8,
    ),
  );

  const currentTeamBonus = driver.teamId === targetTeamId ? 7 : 0;
  if (currentTeamBonus) factors.push(factor("Continuity", "Staying with the current team is attractive.", currentTeamBonus));

  const driverResult = season.driverStandings[driverId];
  if (driverResult) {
    const delta = driverResult.wins > 0 ? 8 : driverResult.podiums > 0 ? 5 : driverResult.points > 20 ? 3 : -2;
    factors.push(factor("Recent results", `${driverResult.points} points this season.`, delta));
  }

  const score = clamp(52 + factors.reduce((sum, item) => sum + item.delta, 0), 0, 100);
  return { driverId, score, label: moodLabel(score), factors };
}

export function expectedSalaryForOffer(save: SaveData, driverId: string, targetTeamId: string, role: DriverLineupRole): number {
  const driver = save.season.roster[driverId];
  if (!driver) return 2_000_000;
  const mood = evaluateDriverMood(save, driverId, targetTeamId);
  const base = annualSalaryForDriver(driver, role);
  const moodPremium = mood.score >= 72 ? 0.88 : mood.score >= 56 ? 1 : mood.score >= 40 ? 1.22 : 1.65;
  const prestigePremium = save.season.teams[targetTeamId]?.teamType === "works" && driver.profile.overall >= 86 ? 1.08 : 1;
  return Math.round(base * moodPremium * prestigePremium);
}

export function driverOfferAcceptance(save: SaveData, driverId: string, targetTeamId: string, offer: DriverOffer): DriverOfferPreview {
  const driver = save.season.roster[driverId];
  if (!driver) {
    return { accepted: false, label: "refused", reason: "Driver not found.", score: 0, factors: [] };
  }
  const mood = evaluateDriverMood(save, driverId, targetTeamId);
  const expected = expectedSalaryForOffer(save, driverId, targetTeamId, offer.role);
  const { salaryDelta, lengthDelta, factors: offerFactors } = evaluateOfferTerms(driver, offer, expected);
  const salaryRatio = offer.salary / Math.max(1, expected);
  const score = mood.score + salaryDelta + lengthDelta;
  const factors = [...offerFactors];

  const moodGateThreshold = mood.score < 24 ? 2.1 : mood.score < 32 ? 1.45 : 0;
  if (moodGateThreshold > 0 && salaryRatio < moodGateThreshold && score < 48) {
    return {
      accepted: false,
      label: "refused",
      reason: "The offer is not generous enough to overcome the driver's doubts about the seat.",
      score: Math.round(score),
      factors,
    };
  }
  if (score >= 62) {
    return { accepted: true, label: "likely", reason: "Offer meets the driver's expectations.", score: Math.round(score), factors };
  }
  if (score >= 50) {
    return { accepted: true, label: "uncertain", reason: "The offer is just good enough.", score: Math.round(score), factors };
  }
  if (score >= 38) {
    return { accepted: false, label: "unlikely", reason: "The offer is below expectations.", score: Math.round(score), factors };
  }
  return { accepted: false, label: "refused", reason: "The driver is not interested in that package.", score: Math.round(score), factors };
}

export function optimalDriverOffer(
  save: SaveData,
  driverId: string,
  targetTeamId: string,
  role: DriverLineupRole,
): DriverOffer | null {
  const expected = expectedSalaryForOffer(save, driverId, targetTeamId, role);
  const yearsOrder = role === "race" ? [2, 1, 3] : [1, 2, 3];
  const multipliers = [0.86, 0.94, 1, 1.08, 1.18, 1.35, 1.55, 1.85];

  for (const years of yearsOrder) {
    for (const multiplier of multipliers) {
      const offer = { years, salary: Math.round(expected * multiplier), role };
      if (driverOfferAcceptance(save, driverId, targetTeamId, offer).accepted) return offer;
    }
  }

  return null;
}

export function ensureDriverContractState(save: SaveData): void {
  const season = save.season;
  season.driverContracts = Array.isArray(season.driverContracts) && season.driverContracts.length > 0
    ? season.driverContracts
    : createInitialContracts(season);
  season.driverMood = season.driverMood ?? {};
  ensureFreeAgentPool(season);

  for (const driver of Object.values(season.roster)) {
    if (!driver.active) continue;
    const targetTeamId = driver.teamId === "free-agent" ? save.meta.playerTeamId : driver.teamId;
    season.driverMood[driver.driverId] = evaluateDriverMood(save, driver.driverId, targetTeamId);
  }
}

function hasFutureContract(season: SeasonState, driverId: string): boolean {
  return Boolean(futureDriverContract(season, driverId));
}

export function expiringPlayerDriverRows(save: SaveData): DriverMarketRow[] {
  ensureDriverContractState(save);
  const teamId = save.meta.playerTeamId;
  return Object.values(save.season.roster)
    .filter((driver) => driver.active && driver.teamId === teamId)
    .filter((driver) => {
      const contract = activeDriverContract(save.season, driver.driverId);
      return !hasFutureContract(save.season, driver.driverId) && (!contract || contract.endSeason <= save.season.seasonYear);
    })
    .map((driver) => toMarketRow(save, driver.driverId, teamId, driver.lineupRole));
}

function futureTeamRaceSeatCount(season: SeasonState, teamId: string): number {
  const future = (season.driverContracts ?? []).filter(
    (contract) => contract.teamId === teamId && contract.startSeason === season.seasonYear + 1 && contract.role === "race",
  ).length;
  const retained = Object.values(season.roster).filter((driver) => {
    const current = activeDriverContract(season, driver.driverId);
    return driver.active && driver.teamId === teamId && driver.lineupRole === "race" && current && current.endSeason > season.seasonYear;
  }).length;
  return future + retained;
}

function nextOpenRole(season: SeasonState, teamId: string): DriverLineupRole {
  return futureTeamRaceSeatCount(season, teamId) < 2 ? "race" : "reserve";
}

export function freeAgentDriverRows(save: SaveData): DriverMarketRow[] {
  ensureDriverContractState(save);
  const teamId = save.meta.playerTeamId;
  const role = nextOpenRole(save.season, teamId);
  return Object.values(save.season.roster)
    .filter((driver) => driver.active && driver.teamId === "free-agent")
    .slice(0, 12)
    .map((driver) => toMarketRow(save, driver.driverId, teamId, role));
}

function toMarketRow(save: SaveData, driverId: string, targetTeamId: string, role: DriverLineupRole): DriverMarketRow {
  const driver = save.season.roster[driverId]!;
  const mood = evaluateDriverMood(save, driverId, targetTeamId);
  const expectedSalary = expectedSalaryForOffer(save, driverId, targetTeamId, role);
  const optimalOffer = optimalDriverOffer(save, driverId, targetTeamId, role);
  const contract = activeDriverContract(save.season, driverId);
  const currentTeam = save.season.teams[driver.teamId];
  const salaryOptions = [0.85, 1, 1.15, 1.35, 1.6, 1.85, 2.25].map((multiplier) => Math.round(expectedSalary * multiplier));
  return {
    driverId,
    name: driver.name,
    age: driver.age,
    currentTeamId: driver.teamId,
    currentTeamName: currentTeam?.name ?? "Free Agent",
    role,
    overall: Math.round(driver.profile.overall),
    potential: Math.round(driver.peakProfile.overall),
    mood,
    expectedSalary,
    contractEnds: contract?.endSeason ?? null,
    signDisabledReason: optimalOffer ? null : "No team-friendly offer is likely to be accepted.",
    optimalOffer,
    salaryOptions,
    yearOptions: [1, 2, 3],
  };
}

function seatsFilledForNextSeason(season: SeasonState, teamId: string): boolean {
  return futureTeamRaceSeatCount(season, teamId) >= 2;
}

export function playerNeedsFreeAgentSigning(save: SaveData): boolean {
  return !seatsFilledForNextSeason(save.season, save.meta.playerTeamId);
}

export function signDriverToTeam(
  save: SaveData,
  driverId: string,
  teamId: string,
  offer: DriverOffer,
): { ok: true; contract: DriverContract } | { ok: false; error: string } {
  ensureDriverContractState(save);
  const season = save.season;
  const driver = season.roster[driverId];
  if (!driver || !driver.active) return { ok: false, error: "Driver not found." };
  if (futureDriverContract(season, driverId)) return { ok: false, error: "Driver already has a future contract." };
  const acceptance = driverOfferAcceptance(save, driverId, teamId, offer);
  if (!acceptance.accepted) return { ok: false, error: acceptance.reason };
  if (offer.role === "race" && futureTeamRaceSeatCount(season, teamId) >= 2) {
    return { ok: false, error: "Both race seats are already assigned for next season." };
  }

  const contract = {
    ...createDriverContract(driverId, teamId, offer.salary, season.seasonYear + 1, offer.years, offer.role),
    status: "future" as const,
  };
  season.driverContracts.push(contract);
  driver.teamId = teamId;
  driver.lineupRole = offer.role;
  season.driverMood[driverId] = evaluateDriverMood(save, driverId, teamId);
  season.eventLog.push(event(`${driver.name} signed a ${offer.years}-year deal with ${season.teams[teamId]?.abbreviation ?? teamId}.`, season, teamId));
  return { ok: true, contract };
}

export function signOptimalDriver(
  save: SaveData,
  driverId: string,
  teamId: string,
  role: DriverLineupRole,
): { ok: true; contract: DriverContract } | { ok: false; error: string } {
  const offer = optimalDriverOffer(save, driverId, teamId, role);
  if (!offer) return { ok: false, error: "No team-friendly accepted offer is available." };
  return signDriverToTeam(save, driverId, teamId, offer);
}

export function releaseUnsignedPlayerExpiringDrivers(save: SaveData): void {
  ensureDriverContractState(save);
  const teamId = save.meta.playerTeamId;
  for (const row of expiringPlayerDriverRows(save)) {
    const driver = save.season.roster[row.driverId];
    if (!driver || futureDriverContract(save.season, row.driverId)) continue;
    driver.teamId = "free-agent";
    driver.lineupRole = "reserve";
    save.season.eventLog.push(event(`${driver.name} entered free agency.`, save.season, teamId));
  }
}

export function autoProcessAiDriverContracts(save: SaveData): EventLogEntry[] {
  ensureDriverContractState(save);
  const season = save.season;
  const events: EventLogEntry[] = [];

  for (const team of Object.values(season.teams)) {
    if (team.id === save.meta.playerTeamId) continue;
    for (const driver of Object.values(season.roster).filter((row) => row.active && row.teamId === team.id)) {
      const contract = activeDriverContract(season, driver.driverId);
      if (futureDriverContract(season, driver.driverId) || (contract && contract.endSeason > season.seasonYear)) continue;
      const mood = evaluateDriverMood(save, driver.driverId, team.id);
      if (mood.score >= 38 || driver.profile.overall >= 84) {
        const offer = optimalDriverOffer(save, driver.driverId, team.id, driver.lineupRole);
        if (offer) {
          const result = signDriverToTeam(save, driver.driverId, team.id, offer);
          if (result.ok) events.push(event(`${driver.name} renewed with ${team.abbreviation}.`, season, team.id));
          continue;
        }
      }
      driver.teamId = "free-agent";
      driver.lineupRole = "reserve";
      events.push(event(`${driver.name} left ${team.abbreviation}.`, season, team.id));
    }
  }

  for (const team of Object.values(season.teams)) {
    if (team.id === save.meta.playerTeamId) continue;
    while (futureTeamRaceSeatCount(season, team.id) < 2) {
      const freeAgent = Object.values(season.roster)
        .filter((driver) => driver.active && driver.teamId === "free-agent" && !futureDriverContract(season, driver.driverId))
        .sort((a, b) => b.profile.overall - a.profile.overall)[0];
      if (!freeAgent) break;
      const offer = optimalDriverOffer(save, freeAgent.driverId, team.id, "race") ?? {
        years: 1,
        salary: Math.round(annualSalaryForDriver(freeAgent, "race") * 1.35),
        role: "race" as const,
      };
      const result = signDriverToTeam(save, freeAgent.driverId, team.id, offer);
      if (!result.ok) break;
      events.push(event(`${freeAgent.name} joined ${team.abbreviation}.`, season, team.id));
    }
  }

  return events;
}
