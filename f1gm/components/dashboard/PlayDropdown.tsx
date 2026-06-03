"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { simulationSession, type PlayThroughAvailability, type PlayThroughMode } from "@/lib/sim/session";

const playOptions: Array<{ mode: PlayThroughMode; label: string }> = [
  { mode: "one-race", label: "Sim 1 Race Weekend" },
  { mode: "three-races", label: "Sim 3 Races" },
  { mode: "summer-break", label: "Sim to Summer Break" },
  { mode: "season", label: "Sim Season" },
];

export function PlayDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saveId = searchParams.get("saveId") ?? simulationSession.getActiveSaveMeta()?.id ?? null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<PlayThroughAvailability | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshAvailability = useCallback(() => {
    const result = simulationSession.getPlayThroughAvailability();
    setAvailability(result.ok ? result.data : null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(refreshAvailability, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAvailability, saveId]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const canPlay = Boolean(saveId) && Boolean(availability?.canPlay) && !busy;

  const onToggle = () => {
    refreshAvailability();
    setError(null);
    setOpen((value) => !value);
  };

  const onPlayThrough = async (mode: PlayThroughMode) => {
    if (!saveId) return;

    setBusy(true);
    setOpen(false);
    setError(null);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    const result = await simulationSession.playThrough(mode);
    setBusy(false);
    refreshAvailability();

    if (!result.ok) {
      setError(result.error);
      setOpen(true);
      return;
    }

    const activeSaveId = result.data.summary.meta.id;
    if (result.data.seasonComplete) {
      router.push(`/season-review?saveId=${activeSaveId}`);
      return;
    }

    const refreshKey = `${result.data.summary.meta.week}-${result.data.summary.playerTeam.points}-${result.data.racesCompleted}`;
    router.push(`/dashboard?saveId=${activeSaveId}&play=${encodeURIComponent(refreshKey)}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={!canPlay}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ui-interactive rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Play ▾
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-48 rounded border border-zinc-700 bg-[#1b232e] py-1 text-sm shadow-xl shadow-black/40"
        >
          {playOptions.map((option) => {
            const disabled =
              busy ||
              !availability?.canPlay ||
              (option.mode === "summer-break" && !availability.canPlayToSummerBreak);

            return (
              <button
                key={option.mode}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => void onPlayThrough(option.mode)}
                className="ui-interactive block w-full px-3 py-2 text-left text-xs font-medium text-zinc-100 hover:bg-zinc-700/70 disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-transparent"
              >
                {option.label}
              </button>
            );
          })}
          {error ? <p className="border-t border-zinc-700 px-3 py-2 text-xs text-red-300">{error}</p> : null}
          {availability?.seasonComplete ? (
            <p className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">Season complete.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
