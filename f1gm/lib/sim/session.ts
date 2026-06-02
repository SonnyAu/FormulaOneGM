import { createNewSave } from "@/lib/sim/factory";
import { finalizeRaceWeekend, runSimulationTick } from "@/lib/sim/engine";
import { getDashboardSummary } from "@/lib/sim/selectors";
import { advancePhase, advanceRace, applyPlayerDecision, autoFinishRace } from "@/lib/sim/raceweekend/raceWeekendEngine";
import { RaceWeekendState, StrategyDecision } from "@/lib/sim/raceweekend/raceTypes";
import { deleteSave, listSaveMetadata, readSave, upsertImportedSave, writeSave } from "@/lib/storage/saveRepository";
import { CreateSaveInput, DashboardSummary, GameActionResult, SaveData, SaveMetadata, TeamDecision } from "@/types/sim";

const AUTOSAVE_DELAY_MS = 600;

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

    const playerDecision = this.activeSave.season.pendingDecisions.filter(
      (decision) => decision.teamId === this.activeSave?.meta.playerTeamId,
    );

    const { save } = runSimulationTick(this.activeSave, playerDecision);
    this.activeSave = save;
    const persisted = await this.persistActiveSave();
    if (!persisted.ok) return persisted;

    return this.getDashboard();
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
  async completeRaceWeekend(): Promise<GameActionResult<DashboardSummary>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    const { save } = finalizeRaceWeekend(this.activeSave);
    this.activeSave = save;
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
