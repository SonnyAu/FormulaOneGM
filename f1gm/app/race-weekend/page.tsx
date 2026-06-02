"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CommentaryFeed } from "@/components/raceweekend/CommentaryFeed";
import { Leaderboard } from "@/components/raceweekend/Leaderboard";
import { PhaseHeader } from "@/components/raceweekend/PhaseHeader";
import { PitLog } from "@/components/raceweekend/PitLog";
import { StrategyControls } from "@/components/raceweekend/StrategyControls";
import { TireCards } from "@/components/raceweekend/TireCards";
import { buildEntryMap, formatLapTime } from "@/components/raceweekend/helpers";
import { simulationSession } from "@/lib/sim/session";
import { RaceWeekendState, StrategyDecision } from "@/lib/sim/raceweekend/raceTypes";

function clone(weekend: RaceWeekendState | null): RaceWeekendState | null {
  return weekend ? (structuredClone(weekend) as RaceWeekendState) : null;
}

function RaceWeekendContent({ saveId }: { saveId: string | null }) {
  const router = useRouter();
  const [weekend, setWeekend] = useState<RaceWeekendState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const result = simulationSession.getRaceWeekend();
    setWeekend(result.ok ? clone(result.data) : null);
  }, []);

  useEffect(() => {
    if (!saveId) return;
    let active = true;
    const bootstrap = async () => {
      if (!simulationSession.getActiveSaveMeta() || simulationSession.getActiveSaveMeta()?.id !== saveId) {
        const load = await simulationSession.loadSave(saveId);
        if (!active) return;
        if (!load.ok) {
          setError(load.error);
          setLoaded(true);
          return;
        }
      }
      if (!active) return;
      refresh();
      setLoaded(true);
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [saveId, refresh]);

  const entryMap = useMemo(() => (weekend ? buildEntryMap(weekend.entries) : {}), [weekend]);

  const onDecision = useCallback(
    (decision: StrategyDecision) => {
      simulationSession.submitStrategyDecision(decision);
      refresh();
    },
    [refresh],
  );

  const tick = useCallback(
    (laps: number) => {
      simulationSession.tickRaceWeekend(laps);
      refresh();
    },
    [refresh],
  );

  const skipToEnd = useCallback(() => {
    simulationSession.autoFinishRaceWeekend();
    refresh();
  }, [refresh]);

  const nextPhase = useCallback(async () => {
    setBusy(true);
    await simulationSession.advanceRaceWeekendPhase();
    refresh();
    setBusy(false);
  }, [refresh]);

  const finishWeekend = useCallback(async () => {
    setBusy(true);
    const result = await simulationSession.completeRaceWeekend();
    setBusy(false);
    if (!result.ok) return;
    if (result.data.seasonComplete) {
      router.push(`/season-review?saveId=${saveId}`);
      return;
    }
    router.push(`/dashboard?saveId=${saveId}`);
  }, [router, saveId]);

  if (!saveId) {
    return <Centered>Missing save selection. <Link className="text-cyan-300 underline" href="/">Go to saves</Link>.</Centered>;
  }
  if (!loaded) {
    return <Centered>Loading race weekend…</Centered>;
  }
  if (error) {
    return <Centered>{error}</Centered>;
  }
  if (!weekend) {
    return (
      <Centered>
        No race weekend in progress.{" "}
        <Link className="text-cyan-300 underline" href={`/dashboard?saveId=${saveId}`}>Back to dashboard</Link>
      </Centered>
    );
  }

  return (
    <main className="min-h-screen bg-[#151a23] px-4 py-4 text-zinc-100 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/dashboard?saveId=${saveId}`} className="ui-interactive text-sm text-zinc-400 hover:text-zinc-200">← Dashboard</Link>
        </div>
        <PhaseHeader weekend={weekend} />

        {weekend.phase === "practice" ? (
          <PracticePanel weekend={weekend} entryMap={entryMap} onNext={nextPhase} busy={busy} />
        ) : null}

        {weekend.phase === "qualifying" ? (
          <QualifyingPanel weekend={weekend} entryMap={entryMap} onNext={nextPhase} busy={busy} />
        ) : null}

        {weekend.phase === "race" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <RaceControls weekend={weekend} onTick={tick} onSkip={skipToEnd} onResults={nextPhase} busy={busy} />
              <Leaderboard weekend={weekend} entryMap={entryMap} />
              <PitLog weekend={weekend} entryMap={entryMap} />
            </div>
            <div className="space-y-4">
              <TireCards weekend={weekend} entryMap={entryMap} />
              <StrategyControls weekend={weekend} entryMap={entryMap} onDecision={onDecision} />
              <CommentaryFeed weekend={weekend} />
            </div>
          </div>
        ) : null}

        {weekend.phase === "complete" ? (
          <ResultsPanel weekend={weekend} entryMap={entryMap} onFinish={finishWeekend} busy={busy} />
        ) : null}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151a23] px-4 text-zinc-200">
      <p className="rounded border border-zinc-700 bg-[#1b232e] px-6 py-4 text-center">{children}</p>
    </main>
  );
}

function RaceControls({
  weekend,
  onTick,
  onSkip,
  onResults,
  busy,
}: {
  weekend: RaceWeekendState;
  onTick: (laps: number) => void;
  onSkip: () => void;
  onResults: () => void;
  busy: boolean;
}) {
  const finished = weekend.race?.finished;
  return (
    <section className="ui-card flex flex-wrap items-center gap-2 rounded border border-zinc-700 bg-[#1b232e] p-3">
      {finished ? (
        <button type="button" onClick={onResults} disabled={busy} className="ui-interactive rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
          View results
        </button>
      ) : (
        <>
          <button type="button" onClick={() => onTick(1)} className="ui-interactive rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">Next lap</button>
          <button type="button" onClick={() => onTick(5)} className="ui-interactive rounded bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">+5 laps</button>
          <button type="button" onClick={onSkip} className="ui-interactive rounded border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-400">Skip to end</button>
        </>
      )}
    </section>
  );
}

function PracticePanel({
  weekend,
  entryMap,
  onNext,
  busy,
}: {
  weekend: RaceWeekendState;
  entryMap: ReturnType<typeof buildEntryMap>;
  onNext: () => void;
  busy: boolean;
}) {
  const runs = [...(weekend.practice?.runs ?? [])].sort((a, b) => a.bestLapSeconds - b.bestLapSeconds);
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Practice Times</h3>
        <button type="button" onClick={onNext} disabled={busy} className="ui-interactive rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">Proceed to Qualifying</button>
      </div>
      {weekend.practice?.playerSetupBonus ? (
        <p className="mb-2 text-xs text-emerald-300">Setup gain: {(weekend.practice.playerSetupBonus * 100).toFixed(2)}% lap time</p>
      ) : null}
      <TimeTable rows={runs.map((run, i) => ({ pos: i + 1, name: entryMap[run.driverId]?.name ?? run.driverId, time: formatLapTime(run.bestLapSeconds) }))} />
    </section>
  );
}

function QualifyingPanel({
  weekend,
  entryMap,
  onNext,
  busy,
}: {
  weekend: RaceWeekendState;
  entryMap: ReturnType<typeof buildEntryMap>;
  onNext: () => void;
  busy: boolean;
}) {
  const grid = weekend.qualifying?.grid ?? [];
  const bestById = new Map<string, number>();
  for (const lap of weekend.qualifying?.results ?? []) {
    const prev = bestById.get(lap.driverId);
    if (prev === undefined || lap.bestLapSeconds < prev) bestById.set(lap.driverId, lap.bestLapSeconds);
  }
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Starting Grid</h3>
        <button type="button" onClick={onNext} disabled={busy} className="ui-interactive rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">Go to Race</button>
      </div>
      <TimeTable rows={grid.map((driverId, i) => ({ pos: i + 1, name: entryMap[driverId]?.name ?? driverId, time: formatLapTime(bestById.get(driverId) ?? 0) }))} />
    </section>
  );
}

function ResultsPanel({
  weekend,
  entryMap,
  onFinish,
  busy,
}: {
  weekend: RaceWeekendState;
  entryMap: ReturnType<typeof buildEntryMap>;
  onFinish: () => void;
  busy: boolean;
}) {
  const rows = weekend.result?.classification ?? [];
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Final Classification</h3>
        <button type="button" onClick={onFinish} disabled={busy} className="ui-interactive rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Confirm &amp; continue season</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">P</th>
              <th className="pb-1">Driver</th>
              <th className="pb-1 text-right">Pts</th>
              <th className="pb-1 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.driverId} className={entryMap[row.driverId]?.isPlayer ? "bg-cyan-900/30 text-cyan-100" : "text-zinc-300"}>
                <td className="border-t border-zinc-800 py-1.5">{row.dnf ? "DNF" : row.position}</td>
                <td className="border-t border-zinc-800 py-1.5">
                  {entryMap[row.driverId]?.name ?? row.driverId}
                  {row.hasFastestLap ? <span className="ml-1 text-xs text-purple-300">FL</span> : null}
                </td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right text-xs">{row.dnf ? "Retired" : "Finished"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TimeTable({ rows }: { rows: Array<{ pos: number; name: string; time: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-1">P</th>
            <th className="pb-1">Driver</th>
            <th className="pb-1 text-right">Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.pos}-${row.name}`} className="text-zinc-300">
              <td className="border-t border-zinc-800 py-1.5">{row.pos}</td>
              <td className="border-t border-zinc-800 py-1.5">{row.name}</td>
              <td className="border-t border-zinc-800 py-1.5 text-right">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RaceWeekendWithSaveId() {
  const searchParams = useSearchParams();
  const saveId = searchParams.get("saveId");
  return <RaceWeekendContent key={saveId ?? ""} saveId={saveId} />;
}

export default function RaceWeekendPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <RaceWeekendWithSaveId />
    </Suspense>
  );
}
