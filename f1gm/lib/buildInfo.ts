import "server-only";

import packageJson from "@/package.json";
import { CURRENT_UPDATE_LOG } from "@/lib/updateLog";
import type { BuildInfo } from "@/types/build";

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getBuildInfo(): BuildInfo {
  const version = nonEmpty(packageJson.version) ?? "0.0.0";
  const commitSha = nonEmpty(process.env.VERCEL_GIT_COMMIT_SHA);
  const publicBuildId = nonEmpty(process.env.NEXT_PUBLIC_BUILD_ID);
  const buildId = commitSha ?? publicBuildId ?? version;
  const commitShort = commitSha ? commitSha.slice(0, 7) : null;

  return {
    buildId,
    version,
    commitSha,
    commitShort,
    label: commitShort ? `v${version} (${commitShort})` : `v${version}`,
    updateLog: CURRENT_UPDATE_LOG,
  };
}
