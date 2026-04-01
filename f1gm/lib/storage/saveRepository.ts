import { idbDelete, idbGet, idbGetAll, idbPut } from "@/lib/storage/indexedDb";
import { SAVE_SCHEMA_VERSION, SaveData, SaveMetadata } from "@/types/sim";

type SaveRecord = {
  id: string;
  payload: unknown;
  version: number;
};

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSaveData(candidate: unknown): candidate is SaveData {
  if (!isObjectLike(candidate) || !isObjectLike(candidate.meta) || !isObjectLike(candidate.season)) {
    return false;
  }

  const meta = candidate.meta as Record<string, unknown>;
  const season = candidate.season as Record<string, unknown>;

  return (
    typeof meta.id === "string" &&
    typeof meta.name === "string" &&
    typeof meta.playerTeamId === "string" &&
    typeof meta.playerTeamName === "string" &&
    typeof meta.seasonYear === "number" &&
    typeof meta.week === "number" &&
    typeof meta.createdAt === "string" &&
    typeof season.currentWeek === "number" &&
    typeof season.currentRound === "number" &&
    isObjectLike(season.teams)
  );
}

function migrateSaveData(record: SaveRecord): SaveData | null {
  if (record.version > SAVE_SCHEMA_VERSION || !validateSaveData(record.payload)) {
    return null;
  }

  const save = record.payload;
  const now = new Date().toISOString();

  if (!save.meta.lastPlayedAt) save.meta.lastPlayedAt = now;
  if (!save.meta.difficulty) save.meta.difficulty = "standard";
  if (!save.meta.summary) {
    const player = save.season.teams[save.meta.playerTeamId];
    save.meta.summary = {
      points: player?.standings.points ?? 0,
      budget: player?.budget ?? 0,
    };
  }

  return save;
}

function buildMetadata(save: SaveData): SaveMetadata {
  const player = save.season.teams[save.meta.playerTeamId];
  return {
    ...save.meta,
    version: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    seasonYear: save.season.seasonYear,
    week: save.season.currentWeek,
    summary: {
      points: player?.standings.points ?? save.meta.summary.points ?? 0,
      budget: player?.budget ?? save.meta.summary.budget ?? 0,
    },
  };
}

function sortKeyForMetadata(meta: Partial<SaveMetadata>): string {
  return meta.lastPlayedAt ?? meta.updatedAt ?? meta.createdAt ?? "";
}

function coerceIsoTimestamp(value: string | undefined, fallback: string): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return fallback;
  return new Date(t).toISOString();
}

/** IndexedDB may contain older or partial metadata rows; coerce before sort/UI. */
function normalizeListedMetadata(raw: unknown): SaveMetadata | null {
  if (!isObjectLike(raw) || typeof raw.id !== "string") return null;

  const row = raw as Partial<SaveMetadata>;
  const now = new Date().toISOString();
  const createdAt = coerceIsoTimestamp(typeof row.createdAt === "string" ? row.createdAt : undefined, now);
  const updatedAt = coerceIsoTimestamp(typeof row.updatedAt === "string" ? row.updatedAt : undefined, createdAt);
  const lastPlayedAt = coerceIsoTimestamp(sortKeyForMetadata(row) || undefined, updatedAt);

  const difficulty =
    row.difficulty === "easy" || row.difficulty === "hard" || row.difficulty === "standard"
      ? row.difficulty
      : "standard";

  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : "Save",
    createdAt,
    updatedAt,
    lastPlayedAt,
    version: typeof row.version === "number" ? row.version : SAVE_SCHEMA_VERSION,
    playerTeamId: typeof row.playerTeamId === "string" ? row.playerTeamId : "",
    playerTeamName: typeof row.playerTeamName === "string" ? row.playerTeamName : "—",
    seasonYear: typeof row.seasonYear === "number" ? row.seasonYear : 2026,
    week: typeof row.week === "number" ? row.week : 1,
    difficulty,
    summary: {
      points: typeof row.summary?.points === "number" ? row.summary.points : 0,
      budget: typeof row.summary?.budget === "number" ? row.summary.budget : 0,
    },
  };
}

export async function listSaveMetadata(): Promise<SaveMetadata[]> {
  const records = await idbGetAll<unknown>("metadata");
  const normalized = records.map(normalizeListedMetadata).filter((m): m is SaveMetadata => m !== null);
  return normalized.sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}

export async function writeSave(save: SaveData): Promise<SaveData> {
  const normalized: SaveData = {
    ...save,
    meta: buildMetadata(save),
  };

  await idbPut("saves", {
    id: normalized.meta.id,
    version: SAVE_SCHEMA_VERSION,
    payload: normalized,
  } satisfies SaveRecord);
  await idbPut("metadata", normalized.meta);

  return normalized;
}

export async function upsertImportedSave(save: SaveData): Promise<SaveData> {
  const migrated = migrateSaveData({ id: save.meta.id, version: save.meta.version, payload: save });
  if (!migrated) {
    throw new Error("Imported save file is invalid or unsupported.");
  }

  return writeSave(migrated);
}

export async function readSave(saveId: string): Promise<SaveData | null> {
  const record = await idbGet<SaveRecord>("saves", saveId);
  if (!record) {
    return null;
  }

  const migrated = migrateSaveData(record);
  if (!migrated) {
    return null;
  }

  return migrated;
}

export async function deleteSave(saveId: string): Promise<void> {
  await Promise.all([idbDelete("saves", saveId), idbDelete("metadata", saveId)]);
}
