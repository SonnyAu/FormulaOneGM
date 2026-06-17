import { getLikelyRetirements, getSeasonAwards, isSeasonComplete } from "@/lib/sim/awards";
import { createNewSave } from "@/lib/sim/factory";
import { finalizeRaceWeekend, runSimulationTick } from "@/lib/sim/engine";
import {
  driverOfferAcceptance,
  expiringPlayerDriverRows,
  freeAgentDriverRows,
  releaseUnsignedPlayerExpiringDrivers,
  signDriverToTeam,
  signOptimalDriver as signDriverWithOptimalOffer,
  playerNeedsFreeAgentSigning,
  type DriverMarketRow,
  type DriverOfferPreview,
} from "@/lib/sim/driverContracts";
import { getNewsFeed } from "@/lib/sim/news";
import { canStartNextSeason, completeOffseasonStep as advanceOffseasonStep, ensureOffseasonState } from "@/lib/sim/offseason";
import { recordOwnerConfidenceReview } from "@/lib/sim/ownerConfidence";
import { startNextSeason } from "@/lib/sim/seasonRollover";
import {
  availableSponsorMarket,
  evaluateSponsorRenewal,
  expiringSponsorContracts,
  playerSponsorSlotsFull,
  previewSponsorDeal,
  previewSponsorRenewal,
  renewSponsorContract,
  signSponsorFromMarket,
  SPONSOR_MAX_TERM_YEARS,
  SPONSOR_MIN_TERM_YEARS,
  type SponsorDealPreview,
} from "@/lib/sim/sponsors";
import {
  AcademyViewRow,
  CalendarRow,
  getAcademyView,
  getCalendarView,
  getDashboardSummary,
  getHistoryView,
  getLatestConstructorDevelopmentReports,
  getPowerUnitManagement,
  getRaceResultsView,
  getRosterView,
  getStandings,
  getTeamManagement,
  getTechnicalReview as buildTechnicalReview,
  getWeekendPlanRecommendation,
  RaceResultRow,
  TeamManagement,
  type HistoryView,
  type PowerUnitManagement,
  type RosterView,
  type TechnicalReview,
} from "@/lib/sim/selectors";
import {
  commitPowerUnitDevelopmentProgram as setPowerUnitDevelopmentProgram,
  signPlayerPowerUnitContract as signPowerUnitContract,
} from "@/lib/sim/powerUnits";
import { swapDriverWithReserve } from "@/lib/sim/rosterActions";
import { advancePhase, advanceRace, applyPlayerDecision, autoFinishRace } from "@/lib/sim/raceweekend/raceWeekendEngine";
import { RaceWeekendState, StrategyDecision } from "@/lib/sim/raceweekend/raceTypes";
import { deleteSave, listSaveMetadata, readSave, upsertImportedSave, writeSave } from "@/lib/storage/saveRepository";
import {
  CreateSaveInput,
  DashboardSummary,
  GameActionResult,
  RaceResult,
  SaveData,
  SaveMetadata,
  OwnerConfidenceReview,
  PowerUnitDevelopmentProgram,
  PowerUnitManufacturerId,
  SeasonAwards,
  ConstructorDevelopmentReport,
  DriverLineupRole,
  OffseasonState,
  OffseasonStep,
  SponsorContract,
  SponsorRenewalTarget,
  TeamDecision,
  WeekendPlan,
} from "@/types/sim";

const AUTOSAVE_DELAY_MS = 600;
const SUMMER_BREAK_COMPLETED_ROUND = 13;
const PLAY_THROUGH_SAFETY_LIMIT = 200;

export type PlayThroughMode = "one-race" | "three-races" | "summer-break" | "season";

export type PlayThroughAvailability = {
  canPlay: boolean;
  canPlayToSummerBreak: boolean;
  racesCompleted: number;
  racesRemaining: number;
  seasonComplete: boolean;
};

export type PlayThroughResult = {
  summary: DashboardSummary;
  seasonComplete: boolean;
  racesCompleted: number;
};

export type PlayThroughPlan = {
  mode: PlayThroughMode;
  startRaceCount: number;
  targetRaceCount: number;
  totalRaceCount: number;
};

export type PlayThroughStepResult = {
  summary: DashboardSummary;
  seasonComplete: boolean;
  planComplete: boolean;
  racesCompleted: number;
  targetRaceCount: number;
  totalRaceCount: number;
  raceResult?: RaceResult;
};

export type { DriverOfferPreview } from "@/lib/sim/driverContracts";
export type { SponsorDealPreview } from "@/lib/sim/sponsors";

export type SponsorRenewalRow = {
  contract: SponsorContract;
  passed: boolean;
  actual: {
    constructorPosition: number;
    points: number;
    wins: number;
    podiums: number;
  };
  target: SponsorRenewalTarget;
};

export type SponsorMarketStatus = {
  market: ReturnType<typeof availableSponsorMarket>;
  slotsFull: boolean;
  nextSeason: number;
};

class SimulationSessionService {
  private activeSave: SaveData | null = null;
  /** Browser timeout id from `window.setTimeout` (typed loosely for DOM vs Node timer typings). */
  private autosaveTimer: number | null = null;

  private async persistActiveSave(): Promise<GameActionResult<SaveMetadata>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    try {
      this.activeSave = await writeSave(this.activeSave);
      return { ok: true, data: this.activeSave.meta };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private queueAutosave() {
    if (!this.activeSave || typeof window === "undefined") return;
    if (this.autosaveTimer !== null) window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => {
      void this.persistActiveSave();
      this.autosaveTimer = null;
    }, AUTOSAVE_DELAY_MS) as unknown as number;
  }

  private clearAutosaveTimer() {
    if (typeof window === "undefined") return;
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  private totalRaceCount(): number {
    return this.activeSave?.season.calendar.filter((entry) => entry.type === "race").length ?? 0;
  }

  private completedRaceCount(): number {
    return this.activeSave?.season.raceHistory.length ?? 0;
  }

  private playerPendingDecisions(): TeamDecision[] {
    if (!this.activeSave) return [];
    const playerTeamId = this.activeSave.meta.playerTeamId;
    return this.activeSave.season.pendingDecisions.filter((decision) => decision.teamId === playerTeamId);
  }

  private ensureEngineerWeekendPlan() {
    if (!this.activeSave || this.activeSave.season.pendingWeekendPlan) return;
    const recommendation = getWeekendPlanRecommendation(this.activeSave);
    if (!recommendation) return;
    this.activeSave.season.pendingWeekendPlan = { ...recommendation.plan, autoManaged: true };
  }

  private playThroughTarget(mode: PlayThroughMode): GameActionResult<number> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const completed = this.completedRaceCount();
    const total = this.totalRaceCount();
    if (total === 0) return { ok: false, error: "No races are available on this calendar." };
    if (completed >= total) return { ok: false, error: "Season is already complete." };

    if (mode === "one-race") return { ok: true, data: Math.min(total, completed + 1) };
    if (mode === "three-races") return { ok: true, data: Math.min(total, completed + 3) };
    if (mode === "season") return { ok: true, data: total };

    if (completed >= SUMMER_BREAK_COMPLETED_ROUND || this.activeSave.season.currentRound > SUMMER_BREAK_COMPLETED_ROUND) {
      return { ok: false, error: "Summer break has already passed." };
    }

    return { ok: true, data: Math.min(total, SUMMER_BREAK_COMPLETED_ROUND) };
  }

  /** Flush debounced autosave immediately (e.g. tab backgrounded). */
  async flushPendingWrites(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (!this.activeSave) return;
    await this.persistActiveSave();
  }

  async initializeSave(input: CreateSaveInput): Promise<GameActionResult<SaveMetadata>> {
    try {
      const save = createNewSave(input);
      this.activeSave = await writeSave(save);
      return { ok: true, data: this.activeSave.meta };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  async loadSave(saveId: string): Promise<GameActionResult<SaveMetadata>> {
    try {
      const save = await readSave(saveId);
      if (!save) return { ok: false, error: "Save not found or unreadable." };
      this.activeSave = save;
      const persisted = await this.persistActiveSave();
      return persisted.ok ? persisted : { ok: true, data: save.meta };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  getDashboard(): GameActionResult<DashboardSummary> {
    if (!this.activeSave) {
      return { ok: false, error: "No active save loaded." };
    }
    return { ok: true, data: getDashboardSummary(this.activeSave) };
  }

  // --- Management selectors ---

  getTeamManagement(): GameActionResult<TeamManagement> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const data = getTeamManagement(this.activeSave);
    return data ? { ok: true, data } : { ok: false, error: "Player team not found." };
  }

  getOffseasonStatus(): GameActionResult<OffseasonState> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: ensureOffseasonState(this.activeSave) };
  }

  completeOffseasonStep(step: OffseasonStep): GameActionResult<OffseasonState> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    if (!isSeasonComplete(this.activeSave)) return { ok: false, error: "The offseason opens after the season review." };
    const current = ensureOffseasonState(this.activeSave);
    if (!current.active && step !== "season-summary") {
      return { ok: false, error: "Start at the season summary before advancing offseason steps." };
    }
    if (current.active && current.step !== step && current.step !== "ready") {
      return { ok: false, error: `Complete the current offseason step first: ${current.step}.` };
    }

    if (step === "resign-drivers") {
      releaseUnsignedPlayerExpiringDrivers(this.activeSave);
    }
    if (step === "free-agent-drivers" && playerNeedsFreeAgentSigning(this.activeSave)) {
      return { ok: false, error: "Fill both race seats before advancing." };
    }

    const state = advanceOffseasonStep(this.activeSave, step);
    this.queueAutosave();
    return { ok: true, data: state };
  }

  getDriverReSignMarket(): GameActionResult<DriverMarketRow[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: expiringPlayerDriverRows(this.activeSave) };
  }

  getFreeAgentMarket(): GameActionResult<DriverMarketRow[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: freeAgentDriverRows(this.activeSave) };
  }

  signOptimalDriver(driverId: string, role: DriverLineupRole): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const result = signDriverWithOptimalOffer(this.activeSave, driverId, this.activeSave.meta.playerTeamId, role);
    if (!result.ok) return result;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  negotiateDriverContract(driverId: string, role: DriverLineupRole, years: number, salary: number): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const result = signDriverToTeam(this.activeSave, driverId, this.activeSave.meta.playerTeamId, { role, years, salary });
    if (!result.ok) return result;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  previewDriverOffer(driverId: string, role: DriverLineupRole, years: number, salary: number): GameActionResult<DriverOfferPreview> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return {
      ok: true,
      data: driverOfferAcceptance(this.activeSave, driverId, this.activeSave.meta.playerTeamId, { role, years, salary }),
    };
  }

  getSponsorRenewals(): GameActionResult<SponsorRenewalRow[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const season = this.activeSave.season;
    const teamId = this.activeSave.meta.playerTeamId;
    return {
      ok: true,
      data: expiringSponsorContracts(season, teamId).map((contract) => {
        const evaluation = evaluateSponsorRenewal(contract, season);
        return { contract, ...evaluation };
      }),
    };
  }

  getSponsorMarket(): GameActionResult<ReturnType<typeof availableSponsorMarket>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: availableSponsorMarket(this.activeSave.season, this.activeSave.meta.playerTeamId) };
  }

  getSponsorMarketStatus(): GameActionResult<SponsorMarketStatus> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const season = this.activeSave.season;
    const teamId = this.activeSave.meta.playerTeamId;
    const nextSeason = season.seasonYear + 1;
    return {
      ok: true,
      data: {
        market: availableSponsorMarket(season, teamId),
        slotsFull: playerSponsorSlotsFull(season, teamId, nextSeason),
        nextSeason,
      },
    };
  }

  renewSponsor(contractId: string, termYears = SPONSOR_MIN_TERM_YEARS): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const result = renewSponsorContract(this.activeSave, this.activeSave.meta.playerTeamId, contractId, termYears);
    if (!result.ok) return result;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  signSponsor(sponsorId: string, termYears = SPONSOR_MIN_TERM_YEARS): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const result = signSponsorFromMarket(this.activeSave, this.activeSave.meta.playerTeamId, sponsorId, termYears);
    if (!result.ok) return result;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  previewSponsorSign(sponsorId: string, termYears = SPONSOR_MIN_TERM_YEARS): GameActionResult<SponsorDealPreview> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const sponsor = availableSponsorMarket(this.activeSave.season, this.activeSave.meta.playerTeamId).find(
      (item) => item.sponsorId === sponsorId,
    );
    if (!sponsor) return { ok: false, error: "Sponsor is not on the market." };
    return {
      ok: true,
      data: previewSponsorDeal(this.activeSave, this.activeSave.meta.playerTeamId, sponsor, termYears),
    };
  }

  previewSponsorRenew(contractId: string, termYears = SPONSOR_MIN_TERM_YEARS): GameActionResult<SponsorDealPreview> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const contract = (this.activeSave.season.sponsorContracts ?? []).find(
      (item) => item.id === contractId && item.teamId === this.activeSave!.meta.playerTeamId,
    );
    if (!contract) return { ok: false, error: "Sponsor contract not found." };
    return {
      ok: true,
      data: previewSponsorRenewal(this.activeSave, this.activeSave.meta.playerTeamId, contract, termYears),
    };
  }

  getSponsorTermOptions(): GameActionResult<number[]> {
    const options: number[] = [];
    for (let years = SPONSOR_MIN_TERM_YEARS; years <= SPONSOR_MAX_TERM_YEARS; years += 1) {
      options.push(years);
    }
    return { ok: true, data: options };
  }

  getPowerUnitManagement(): GameActionResult<PowerUnitManagement> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const data = getPowerUnitManagement(this.activeSave);
    return data ? { ok: true, data } : { ok: false, error: "Player team not found." };
  }

  getTechnicalReview(): GameActionResult<TechnicalReview> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: buildTechnicalReview(this.activeSave) };
  }

  commitPowerUnitDevelopmentProgram(program: PowerUnitDevelopmentProgram): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const result = setPowerUnitDevelopmentProgram(this.activeSave, this.activeSave.meta.playerTeamId, program);
    if (!result.ok) return result;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  signPlayerPowerUnitContract(manufacturerId: PowerUnitManufacturerId, lengthYears: number): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    if (!isSeasonComplete(this.activeSave)) {
      return { ok: false, error: "Power unit contracts can only be signed after the season review." };
    }
    const result = signPowerUnitContract(this.activeSave, this.activeSave.meta.playerTeamId, manufacturerId, lengthYears);
    if (!result.ok) return result;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  getWeekendPlanRecommendation(): GameActionResult<{ plan: WeekendPlan; rationale: string }> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const data = getWeekendPlanRecommendation(this.activeSave);
    return data ? { ok: true, data } : { ok: false, error: "Player team not found." };
  }

  commitWeekendPlan(plan: WeekendPlan): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    this.activeSave.season.pendingWeekendPlan = plan;
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  getCalendar(): GameActionResult<CalendarRow[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getCalendarView(this.activeSave) };
  }

  getStandings(): GameActionResult<ReturnType<typeof getStandings>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getStandings(this.activeSave) };
  }

  getRaceResults(): GameActionResult<RaceResultRow[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getRaceResultsView(this.activeSave) };
  }

  getHistory(): GameActionResult<HistoryView> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getHistoryView(this.activeSave) };
  }

  getConstructorDevelopmentReports(): GameActionResult<ConstructorDevelopmentReport[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getLatestConstructorDevelopmentReports(this.activeSave) };
  }

  submitPlayerDecision(decision: Omit<TeamDecision, "week" | "tick" | "source">): GameActionResult<void> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const season = this.activeSave.season;
    const fullDecision: TeamDecision = {
      ...decision,
      week: season.currentWeek,
      tick: season.tick + 1,
      source: "player",
    };

    season.pendingDecisions = season.pendingDecisions.filter((item) => item.teamId !== fullDecision.teamId);
    season.pendingDecisions.push(fullDecision);
    this.queueAutosave();
    return { ok: true, data: undefined };
  }

  async advanceWeek(): Promise<GameActionResult<DashboardSummary>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const { save } = runSimulationTick(this.activeSave, this.playerPendingDecisions());
    this.activeSave = save;
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;

    return this.getDashboard();
  }

  getPlayThroughAvailability(): GameActionResult<PlayThroughAvailability> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const completed = this.completedRaceCount();
    const total = this.totalRaceCount();
    const seasonComplete = total > 0 && completed >= total;

    return {
      ok: true,
      data: {
        canPlay: total > 0 && !seasonComplete,
        canPlayToSummerBreak:
          total > 0 &&
          !seasonComplete &&
          completed < SUMMER_BREAK_COMPLETED_ROUND &&
          this.activeSave.season.currentRound <= SUMMER_BREAK_COMPLETED_ROUND,
        racesCompleted: completed,
        racesRemaining: Math.max(0, total - completed),
        seasonComplete,
      },
    };
  }

  createPlayThroughPlan(mode: PlayThroughMode): GameActionResult<PlayThroughPlan> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const target = this.playThroughTarget(mode);
    if (!target.ok) return target;

    return {
      ok: true,
      data: {
        mode,
        startRaceCount: this.completedRaceCount(),
        targetRaceCount: target.data,
        totalRaceCount: this.totalRaceCount(),
      },
    };
  }

  private buildCompletedPlayThroughStep(plan: PlayThroughPlan): GameActionResult<PlayThroughStepResult> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const dashboard = this.getDashboard();
    if (!dashboard.ok) return dashboard;

    return {
      ok: true,
      data: {
        summary: dashboard.data,
        seasonComplete: isSeasonComplete(this.activeSave),
        planComplete: true,
        racesCompleted: Math.max(0, this.completedRaceCount() - plan.startRaceCount),
        targetRaceCount: plan.targetRaceCount,
        totalRaceCount: this.totalRaceCount(),
      },
    };
  }

  async playThroughStep(plan: PlayThroughPlan): Promise<GameActionResult<PlayThroughStepResult>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const total = this.totalRaceCount();
    if (total === 0) return { ok: false, error: "No races are available on this calendar." };

    const completedBefore = this.completedRaceCount();
    if (completedBefore >= plan.targetRaceCount || completedBefore >= total) {
      return this.buildCompletedPlayThroughStep(plan);
    }

    this.clearAutosaveTimer();

    let guard = 0;
    while (this.activeSave && this.completedRaceCount() === completedBefore && this.completedRaceCount() < plan.targetRaceCount) {
      guard += 1;
      if (guard > PLAY_THROUGH_SAFETY_LIMIT) {
        return { ok: false, error: "Fast-sim could not reach the next race weekend." };
      }

      const weekend = this.activeSave.season.activeRaceWeekend;
      if (weekend) {
        this.ensureEngineerWeekendPlan();
        autoFinishRace(weekend, { engineerForPlayer: true });
        const { save } = finalizeRaceWeekend(this.activeSave);
        this.activeSave = save;
        continue;
      }

      const { save } = runSimulationTick(this.activeSave, this.playerPendingDecisions());
      this.activeSave = save;
    }

    const completedAfter = this.completedRaceCount();
    const completedThisStep = completedAfter - completedBefore;
    if (completedThisStep > 1) {
      return { ok: false, error: "Fast-sim completed more than one race weekend in a single step." };
    }
    if (completedThisStep < 1) {
      return { ok: false, error: "Fast-sim could not complete the next race weekend." };
    }

    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;

    const dashboard = this.getDashboard();
    if (!dashboard.ok) return dashboard;

    return {
      ok: true,
      data: {
        summary: dashboard.data,
        seasonComplete: isSeasonComplete(this.activeSave),
        planComplete: completedAfter >= plan.targetRaceCount || isSeasonComplete(this.activeSave),
        racesCompleted: Math.max(0, completedAfter - plan.startRaceCount),
        targetRaceCount: plan.targetRaceCount,
        totalRaceCount: this.totalRaceCount(),
        raceResult: this.activeSave.season.raceHistory[completedAfter - 1],
      },
    };
  }

  async playThrough(mode: PlayThroughMode): Promise<GameActionResult<PlayThroughResult>> {
    const plan = this.createPlayThroughPlan(mode);
    if (!plan.ok) return plan;

    const step = await this.playThroughStep(plan.data);
    if (!step.ok) return step;

    return {
      ok: true,
      data: {
        summary: step.data.summary,
        seasonComplete: step.data.seasonComplete,
        racesCompleted: step.data.racesCompleted,
      },
    };
  }

  async checkpoint(): Promise<GameActionResult<SaveMetadata>> {
    return this.persistActiveSave();
  }

  // --- Race weekend ---

  hasActiveRaceWeekend(): boolean {
    return Boolean(this.activeSave?.season.activeRaceWeekend);
  }

  getRaceWeekend(): GameActionResult<RaceWeekendState | null> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: this.activeSave.season.activeRaceWeekend ?? null };
  }

  /** Move practice -> qualifying -> race -> complete. Persists immediately. */
  async advanceRaceWeekendPhase(): Promise<GameActionResult<RaceWeekendState>> {
    const weekend = this.activeSave?.season.activeRaceWeekend;
    if (!this.activeSave || !weekend) return { ok: false, error: "No active race weekend." };
    advancePhase(weekend);
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return { ok: false, error: persisted.error };
    return { ok: true, data: weekend };
  }

  /** Advance the live race by one (or several) laps. */
  tickRaceWeekend(laps = 1): GameActionResult<RaceWeekendState> {
    const weekend = this.activeSave?.season.activeRaceWeekend;
    if (!this.activeSave || !weekend) return { ok: false, error: "No active race weekend." };
    advanceRace(weekend, laps);
    this.queueAutosave();
    return { ok: true, data: weekend };
  }

  /** Auto-play the remaining race to the flag (skip-to-end). */
  autoFinishRaceWeekend(): GameActionResult<RaceWeekendState> {
    const weekend = this.activeSave?.season.activeRaceWeekend;
    if (!this.activeSave || !weekend) return { ok: false, error: "No active race weekend." };
    autoFinishRace(weekend);
    this.queueAutosave();
    return { ok: true, data: weekend };
  }

  submitStrategyDecision(decision: StrategyDecision): GameActionResult<RaceWeekendState> {
    const weekend = this.activeSave?.season.activeRaceWeekend;
    if (!this.activeSave || !weekend) return { ok: false, error: "No active race weekend." };
    applyPlayerDecision(weekend, decision);
    this.queueAutosave();
    return { ok: true, data: weekend };
  }

  /** Finalize the weekend: write results into the season, advance week/round. */
  async completeRaceWeekend(): Promise<GameActionResult<{ summary: DashboardSummary; seasonComplete: boolean }>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const { save } = finalizeRaceWeekend(this.activeSave);
    this.activeSave = save;
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;
    const dashboard = this.getDashboard();
    if (!dashboard.ok) return dashboard;
    return { ok: true, data: { summary: dashboard.data, seasonComplete: isSeasonComplete(save) } };
  }

  isSeasonComplete(): GameActionResult<boolean> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: isSeasonComplete(this.activeSave) };
  }

  getSeasonAwards(): GameActionResult<SeasonAwards> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getSeasonAwards(this.activeSave) };
  }

  getLikelyRetirements(): GameActionResult<ReturnType<typeof getLikelyRetirements>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getLikelyRetirements(this.activeSave) };
  }

  async getOwnerConfidenceReview(): Promise<GameActionResult<OwnerConfidenceReview>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    if (!isSeasonComplete(this.activeSave)) {
      return { ok: false, error: "Season is not complete yet." };
    }
    const review = recordOwnerConfidenceReview(this.activeSave);
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;
    return { ok: true, data: review };
  }

  getNewsFeed(limit = 50): GameActionResult<ReturnType<typeof getNewsFeed>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getNewsFeed(this.activeSave, limit) };
  }

  getAcademy(): GameActionResult<AcademyViewRow[]> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getAcademyView(this.activeSave) };
  }

  getRoster(): GameActionResult<RosterView> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: getRosterView(this.activeSave) };
  }

  async swapWithReserve(raceDriverId: string): Promise<GameActionResult<RosterView>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const result = swapDriverWithReserve(this.activeSave, this.activeSave.meta.playerTeamId, raceDriverId);
    if ("error" in result) return { ok: false, error: result.error };

    this.activeSave = result.save;
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;
    return { ok: true, data: getRosterView(this.activeSave) };
  }

  async startNextSeason(): Promise<GameActionResult<DashboardSummary>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    if (!isSeasonComplete(this.activeSave)) {
      return { ok: false, error: "Season is not complete yet." };
    }
    if (!canStartNextSeason(this.activeSave)) {
      return { ok: false, error: "Complete the offseason review before starting the next season." };
    }
    const review = recordOwnerConfidenceReview(this.activeSave);
    if (review.wasFired) {
      return { ok: false, error: "The owners have ended your tenure. This career cannot advance to another season." };
    }
    this.activeSave = startNextSeason(this.activeSave);
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;
    return this.getDashboard();
  }

  async exportSave(saveId: string): Promise<GameActionResult<string>> {
    const save = await readSave(saveId);
    if (!save) return { ok: false, error: "Save not found." };
    return { ok: true, data: JSON.stringify(save, null, 2) };
  }

  async importSave(serialized: string): Promise<GameActionResult<SaveMetadata>> {
    try {
      const parsed = JSON.parse(serialized) as SaveData;
      const stored = await upsertImportedSave(parsed);
      return { ok: true, data: stored.meta };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  getActiveSaveMeta(): SaveMetadata | null {
    return this.activeSave?.meta ?? null;
  }

  async getSaves(): Promise<GameActionResult<SaveMetadata[]>> {
    return { ok: true, data: await listSaveMetadata() };
  }

  async deleteSave(saveId: string): Promise<GameActionResult<void>> {
    await deleteSave(saveId);
    if (this.activeSave?.meta.id === saveId) this.activeSave = null;
    return { ok: true, data: undefined };
  }
}

export const simulationSession = new SimulationSessionService();

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void simulationSession.flushPendingWrites();
    }
  });
}
