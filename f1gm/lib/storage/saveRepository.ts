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
    typeof meta.seasonYear === "number" &&
    typeof season.currentWeek === "number" &&
    typeof season.currentRound === "number" &&
    isObjectLike(season.teams)
  );
}

function migrateSaveData(record: SaveRecord): SaveData | null {
  if (record.version > SAVE_SCHEMA_VERSION) {
    return null;
  }

  if (record.version === SAVE_SCHEMA_VERSION && validateSaveData(record.payload)) {
    return record.payload;
  }

  return null;
}

export async function listSaveMetadata(): Promise<SaveMetadata[]> {
  const records = await idbGetAll<SaveMetadata>("metadata");
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function writeSave(save: SaveData): Promise<void> {
  const now = new Date().toISOString();
  const normalized: SaveData = {
    ...save,
    meta: {
      ...save.meta,
      version: SAVE_SCHEMA_VERSION,
      updatedAt: now,
    },
  };

  await idbPut("saves", {
    id: normalized.meta.id,
    version: SAVE_SCHEMA_VERSION,
    payload: normalized,
  } satisfies SaveRecord);
  await idbPut("metadata", normalized.meta);
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
