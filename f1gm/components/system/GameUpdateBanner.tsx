"use client";

import { useCallback, useEffect, useState } from "react";
import { simulationSession } from "@/lib/sim/session";
import type { BuildInfo } from "@/types/build";

const CHECK_INTERVAL_MS = 60_000;

function isBuildInfo(value: unknown): value is BuildInfo {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BuildInfo>;
  return (
    typeof candidate.buildId === "string" &&
    typeof candidate.version === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.updateLog?.title === "string" &&
    Array.isArray(candidate.updateLog.changes) &&
    candidate.updateLog.changes.every((change) => typeof change === "string")
  );
}

type GameUpdateBannerProps = {
  currentBuild: BuildInfo;
};

export function GameUpdateBanner({ currentBuild }: GameUpdateBannerProps) {
  const [latestBuild, setLatestBuild] = useState<BuildInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
        signal,
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (signal?.aborted) return;

      if (!response.ok) {
        setLatestBuild(null);
        return;
      }

      const data: unknown = await response.json();
      if (signal?.aborted) return;

      if (!isBuildInfo(data) || data.buildId === currentBuild.buildId) {
        setLatestBuild(null);
        return;
      }

      setLatestBuild(data);
      setError(null);
    } catch (fetchError) {
      if (signal?.aborted || (fetchError instanceof DOMException && fetchError.name === "AbortError")) {
        return;
      }
      setLatestBuild(null);
    }
  }, [currentBuild.buildId]);

  useEffect(() => {
    const controller = new AbortController();
    const initialCheckId = window.setTimeout(() => {
      void checkForUpdate(controller.signal);
    }, 0);
    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    const onFocus = () => void checkForUpdate();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkForUpdate]);

  const updateGame = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      await simulationSession.flushPendingWrites();
      if (simulationSession.getActiveSaveMeta()) {
        const checkpoint = await simulationSession.checkpoint();
        if (!checkpoint.ok) {
          setError(checkpoint.error);
          setIsUpdating(false);
          return;
        }
      }

      window.location.reload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update the game.");
      setIsUpdating(false);
    }
  };

  if (!latestBuild) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(calc(100vw-2rem),24rem)] rounded-lg border border-red-500/40 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Update available</p>
          <h2 className="mt-1 text-lg font-semibold">{latestBuild.label}</h2>
        </div>
        <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[0.68rem] text-zinc-300">
          {latestBuild.commitShort ?? latestBuild.version}
        </span>
      </div>

      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/70 p-3">
        <p className="text-sm font-medium text-zinc-100">{latestBuild.updateLog.title}</p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
          {latestBuild.updateLog.changes.map((change) => (
            <li key={change} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red-300" />
              <span>{change}</span>
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}

      <button
        type="button"
        onClick={updateGame}
        disabled={isUpdating}
        className="ui-interactive mt-4 w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUpdating ? "Saving..." : "Update Game"}
      </button>
    </aside>
  );
}
