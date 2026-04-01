import { createNewSave } from "@/lib/sim/factory";
import { runSimulationTick } from "@/lib/sim/engine";
import { getDashboardSummary } from "@/lib/sim/selectors";
import { deleteSave, listSaveMetadata, readSave, writeSave } from "@/lib/storage/saveRepository";
import { TeamSelection } from "@/types/f1";
import { DashboardSummary, GameActionResult, SaveData, SaveMetadata, TeamDecision } from "@/types/sim";

class SimulationSessionService {
  private activeSave: SaveData | null = null;

  async initializeSave(selection: TeamSelection): Promise<GameActionResult<SaveMetadata>> {
    try {
      const save = createNewSave(selection);
      await writeSave(save);
      this.activeSave = save;
      return { ok: true, data: save.meta };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  async loadSave(saveId: string): Promise<GameActionResult<SaveMetadata>> {
    try {
      const save = await readSave(saveId);
      if (!save) return { ok: false, error: "Save not found or unreadable." };
      this.activeSave = save;
      return { ok: true, data: save.meta };
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
    return { ok: true, data: undefined };
  }

  async advanceWeek(): Promise<GameActionResult<DashboardSummary>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    const playerDecision = this.activeSave.season.pendingDecisions.filter(
      (decision) => decision.teamId === this.activeSave?.meta.playerTeamId,
    );

    const { save } = runSimulationTick(this.activeSave, playerDecision);
    this.activeSave = save;
    await writeSave(save);
    return this.getDashboard();
  }

  async checkpoint(): Promise<GameActionResult<SaveMetadata>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };

    await writeSave(this.activeSave);
    return { ok: true, data: this.activeSave.meta };
  }

  async exportActiveSave(): Promise<GameActionResult<string>> {
    if (!this.activeSave) return { ok: false, error: "No active save loaded." };
    return { ok: true, data: JSON.stringify(this.activeSave) };
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
