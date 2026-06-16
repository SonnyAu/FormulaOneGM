import { getLikelyRetirements, getSeasonAwards, isSeasonComplete } from "@/lib/sim/awards";
import { createNewSave } from "@/lib/sim/factory";
import { finalizeRaceWeekend, runSimulationTick } from "@/lib/sim/engine";
import { getNewsFeed } from "@/lib/sim/news";
import { recordOwnerConfidenceReview } from "@/lib/sim/ownerConfidence";
import { startNextSeason } from "@/lib/sim/seasonRollover";
import {
  AcademyViewRow,
  CalendarRow,
  getAcademyView,
  getCalendarView,
  getDashboardSummary,
  getHistoryView,
  getLatestConstructorDevelopmentReports,
  getRaceResultsView,
  getRosterView,
  getStandings,
  getTeamManagement,
  getWeekendPlanRecommendation,
  RaceResultRow,
  TeamManagement,
  type HistoryView,
  type RosterView,
} from "@/lib/sim/selectors";
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
  SeasonAwards,
  ConstructorDevelopmentReport,
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
