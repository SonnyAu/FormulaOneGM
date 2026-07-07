"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DriverLineupTable, StandingsTable, type DashboardLineupRow } from "@/components/dashboard/DashboardTables";
import { Headlines, LinkList, RecordPanel } from "@/components/dashboard/DashboardWidgets";
import { driverMap } from "@/data/drivers";
import { simulationSession, type PlayThroughMode, type PlayThroughPlan } from "@/lib/sim/session";
import { DashboardSummary } from "@/types/sim";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const SIM_STEP_DELAY_MS = 900;

const SIM_MODE_LABEL: Record<PlayThroughMode, string> = {
  "one-race": "Sim 1 Race Weekend",
  "three-races": "Sim 3 Races",
  "summer-break": "Sim to Summer Break",
  season: "Sim Season",
};

function isPlayThroughMode(value: string | null): value is PlayThroughMode {
  return value === "one-race" || value === "three-races" || value === "summer-break" || value === "season";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type VisualSimStatus = "running" | "stopping" | "stopped" | "complete" | "error";

type VisualSimState = {
  mode: PlayThroughMode;
  status: VisualSimStatus;
  completedRaces: number;
  targetRaces: number;
  lastRaceName?: string;
  message: string;
};

type DashboardPageContentProps = {
  saveId: string | null;
  simMode: PlayThroughMode | null;
  simRun: string | null;
};

function DashboardPageContent({ saveId, simMode, simRun }: DashboardPageContentProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [raceWeekendActive, setRaceWeekendActive] = useState(false);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const [driverRows, setDriverRows] = useState<{ driverId: string; name: string; teamAbbreviation: string; points: number }[]>([]);
  const [lineup, setLineup] = useState<DashboardLineupRow[]>([]);
  const [visualSim, setVisualSim] = useState<VisualSimState | null>(null);
  const activeSimRunRef = useRef<string | null>(null);
  const handledSimRunsRef = useRef<Set<string>>(new Set());
  const stopAfterCurrentRaceRef = useRef(false);
  const cancelledRef = useRef(false);

  const refreshStandings = useCallback(() => {
    const result = simulationSession.getStandings();
    setDriverRows(result.ok ? result.data.drivers : []);
  }, []);

  const refreshLineup = useCallback(() => {
    const result = simulationSession.getRoster();
    if (!result.ok) {
      setLineup([]);
      return;
    }
    setLineup(
      result.data.raceDrivers.map((driver, index) => ({
        driverId: driver.driverId,
        name: driver.name,
        number: driverMap.get(driver.driverId)?.number ?? index + 1,
        nationality: driver.nationality,
        role: index === 0 ? "Lead" : "Wing",
        overall: driver.overall,
      })),
    );
  }, []);

  const refreshRaceFlags = useCallback(() => {
    setRaceWeekendActive(simulationSession.hasActiveRaceWeekend());
    const complete = simulationSession.isSeasonComplete();
    setSeasonComplete(complete.ok ? complete.data : false);
  }, []);

  const clearSimQuery = useCallback(() => {
    if (!saveId) return;
    router.replace(`/dashboard?saveId=${saveId}`, { scroll: false });
  }, [router, saveId]);

  useEffect(() => {
    if (!saveId) return;

    const bootstrap = async () => {
      const loadResult = await simulationSession.loadSave(saveId);
      if (!loadResult.ok) {
        setSessionError(loadResult.error);
        return;
      }

      const dashboard = simulationSession.getDashboard();
      if (!dashboard.ok) {
        setSessionError(dashboard.error);
        return;
      }

      setSummary(dashboard.data);
      refreshRaceFlags();
      refreshStandings();
      refreshLineup();
      setSessionError(null);
    };

    void bootstrap();
  }, [refreshLineup, refreshRaceFlags, refreshStandings, saveId]);

  useEffect(() => {
    activeSimRunRef.current = null;
    handledSimRunsRef.current.clear();
    stopAfterCurrentRaceRef.current = false;
    setVisualSim(null);
  }, [saveId]);

  const drivers = lineup;

  const constructorStandings = useMemo(
    () =>
      summary?.standings.map((row, index) => ({
        pos: index + 1,
        team: row.abbreviation,
        pts: row.points,
      })) ?? [],
    [summary],
  );

  const driverStandings = useMemo(() => {
    return driverRows.map((row, index) => ({
      pos: index + 1,
      name: row.name,
      team: row.teamAbbreviation,
      pts: row.points,
    }));
  }, [driverRows]);

  const runVisualSimulation = useCallback(
    async (mode: PlayThroughMode, runId: string) => {
      if (!saveId || activeSimRunRef.current || handledSimRunsRef.current.has(runId)) return;

      handledSimRunsRef.current.add(runId);
      activeSimRunRef.current = runId;
      stopAfterCurrentRaceRef.current = false;
      setSessionError(null);

      // The save is normally already active (we navigated here from the dashboard), but on a
      // direct load/refresh with sim params the session may not be hydrated yet - load it so the
      // run does not silently abort in createPlayThroughPlan.
      if (simulationSession.getActiveSaveMeta()?.id !== saveId) {
        const load = await simulationSession.loadSave(saveId);
        if (!load.ok) {
          setSessionError(load.error);
          setVisualSim(null);
          activeSimRunRef.current = null;
          clearSimQuery();
          return;
        }
      }

      const planResult = simulationSession.createPlayThroughPlan(mode);
      if (!planResult.ok) {
        setSessionError(planResult.error);
        setVisualSim(null);
        activeSimRunRef.current = null;
        clearSimQuery();
        return;
      }

      const plan: PlayThroughPlan = planResult.data;
      const targetRaces = Math.max(0, plan.targetRaceCount - plan.startRaceCount);
      let routeToSeasonReview = false;

      setVisualSim({
        mode,
        status: "running",
        completedRaces: 0,
        targetRaces,
        message: "Preparing next race weekend...",
      });

      try {
        while (true) {
          if (cancelledRef.current) break;

          if (stopAfterCurrentRaceRef.current) {
            await simulationSession.flushPendingWrites();
            setVisualSim((current) =>
              current ? { ...current, status: "stopped", message: "Stopped before starting the next race." } : current,
            );
            break;
          }

          setVisualSim((current) =>
            current ? { ...current, status: "running", message: "Simulating next race weekend..." } : current,
          );

          // Yield to the browser so React can paint the "Simulating..." state before the next
          // race is simulated synchronously - this is what makes the run visibly step race by race.
          await delay(0);
          if (cancelledRef.current) break;

          const step = await simulationSession.playThroughStep(plan);
          if (cancelledRef.current) break;
          if (!step.ok) {
            setSessionError(step.error);
            setVisualSim((current) => (current ? { ...current, status: "error", message: step.error } : current));
            break;
          }

          const completedRaces = Math.min(targetRaces, step.data.racesCompleted);
          const latestRace = step.data.raceResult?.raceName;

          setSummary(step.data.summary);
          refreshStandings();
          refreshLineup();
          refreshRaceFlags();
          setVisualSim({
            mode,
            status: step.data.planComplete || step.data.seasonComplete ? "complete" : "running",
            completedRaces,
            targetRaces,
            lastRaceName: latestRace,
            message: latestRace ? `Completed ${latestRace}.` : "Race weekend completed.",
          });

          if (step.data.seasonComplete) {
            routeToSeasonReview = true;
            await delay(SIM_STEP_DELAY_MS);
            break;
          }

          if (step.data.planComplete) {
            await delay(SIM_STEP_DELAY_MS);
            break;
          }

          await delay(SIM_STEP_DELAY_MS);
          if (cancelledRef.current) break;
          if (stopAfterCurrentRaceRef.current) {
            await simulationSession.flushPendingWrites();
            setVisualSim((current) =>
              current ? { ...current, status: "stopped", message: "Stopped after the current race." } : current,
            );
            break;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Fast-sim failed unexpectedly.";
        setSessionError(message);
        setVisualSim((current) => (current ? { ...current, status: "error", message } : current));
      } finally {
        activeSimRunRef.current = null;
        if (cancelledRef.current) {
          // Component is unmounting - do not touch the router.
        } else if (routeToSeasonReview) {
          router.push(`/season-review?saveId=${saveId}`);
        } else {
          clearSimQuery();
        }
      }
    },
    [clearSimQuery, refreshLineup, refreshRaceFlags, refreshStandings, router, saveId],
  );

  useEffect(() => {
    if (!simMode || !simRun) return;
    void runVisualSimulation(simMode, simRun);
  }, [runVisualSimulation, simMode, simRun]);

  // Allow a fresh run once the sim params clear (e.g. after a completed run cleared the query).
  useEffect(() => {
    if (!simRun) {
      handledSimRunsRef.current.clear();
      activeSimRunRef.current = null;
    }
  }, [simRun]);

  // Hard-stop any in-flight run when the dashboard unmounts (navigation away).
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  if (!saveId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <section className="ui-section-enter rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <h1 className="text-2xl font-semibold">Missing save selection</h1>
          <Link href="/" className="ui-interactive mt-4 inline-flex rounded bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">
            Go to Saves
          </Link>
        </section>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <section className="ui-section-enter w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <p className="mb-4 text-zinc-300">Loading save...</p>
          <div className="space-y-2">
            <div className="ui-skeleton h-8 rounded-md" />
            <div className="ui-skeleton h-24 rounded-md" />
            <div className="ui-skeleton h-24 rounded-md" />
          </div>
          {sessionError ? <p className="mt-2 text-sm text-red-300">{sessionError}</p> : null}
        </section>
      </main>
    );
  }

  const onAdvanceWeek = async () => {
    const result = await simulationSession.advanceWeek();
    if (!result.ok) {
      setSessionError(result.error);
      return;
    }
    setSummary(result.data);
    refreshStandings();
    refreshLineup();
    if (simulationSession.hasActiveRaceWeekend()) {
      router.push(`/race-weekend?saveId=${saveId}`);
      return;
    }
    setRaceWeekendActive(false);
    const complete = simulationSession.isSeasonComplete();
    setSeasonComplete(complete.ok ? complete.data : false);
  };

  const stopVisualSimulation = () => {
    stopAfterCurrentRaceRef.current = true;
    setVisualSim((current) =>
      current ? { ...current, status: "stopping", message: "Will stop after the current race." } : current,
    );
  };
  const simInProgress = visualSim?.status === "running" || visualSim?.status === "stopping";

  return (
    <DashboardShell
      title={`${summary.playerTeam.name} Dashboard`}
      subtitle={`${summary.meta.seasonYear} · Week ${summary.meta.week} · ${summary.upcomingEvent?.name ?? "Preseason"}`}
      sidebar={<DashboardSidebar activeLabel="Dashboard" />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/factory?saveId=${saveId}`} className="ui-interactive rounded bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Factory &amp; weekend plan</Link>
        {seasonComplete ? (
          <Link href={`/season-review?saveId=${saveId}`} className="ui-interactive rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400">
            Season Review →
          </Link>
        ) : raceWeekendActive ? (
          <Link href={`/race-weekend?saveId=${saveId}`} className="ui-interactive rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400">Resume race weekend →</Link>
        ) : (
          <button type="button" onClick={onAdvanceWeek} disabled={simInProgress} className="ui-interactive rounded bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">Advance week</button>
        )}
        <Link href="/" className="ui-interactive rounded border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500">Back to saves</Link>
        {sessionError && <p className="text-sm text-red-300">{sessionError}</p>}
        <p className="w-full text-xs text-zinc-500">
          Auto-save: weekly decisions are written to this device after a short delay; advancing the week saves immediately. Switching tabs flushes any pending save.
        </p>
      </div>
      {visualSim ? <VisualSimPanel state={visualSim} onStop={stopVisualSimulation} /> : null}
      <div className="grid gap-4 xl:grid-cols-[290px_1fr_340px]">
        <StandingsTable constructorStandings={constructorStandings} driverStandings={driverStandings} highlightedTeam={summary.playerTeam.abbreviation} />

        <div className="space-y-3">
          <RecordPanel raceRecord={`${summary.playerTeam.points} pts`} championshipPos={`${constructorStandings.findIndex((row) => row.team === summary.playerTeam.abbreviation) + 1} place`} />
          <LinkList
            title="Championship"
            rows={[
              { label: "WDC leader", value: summary.driverLeader ? `${summary.driverLeader.name} (${summary.driverLeader.points})` : "—" },
              { label: "WCC leader", value: `${constructorStandings[0]?.team ?? "—"} (${constructorStandings[0]?.pts ?? 0})` },
            ]}
            footerLink="Full standings"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <LinkList title="Team Leaders" rows={[{ label: `${drivers[0]?.name ?? "Lead Driver"}  |  best finish`, value: "—" }, { label: `${drivers[1]?.name ?? "Second Driver"}  |  avg quali`, value: "—" }, { label: `${drivers[0]?.name ?? "Lead Driver"}  |  overtakes`, value: "0" }]} footerLink="Full roster" footerHref={`/roster?saveId=${saveId}`} />
            <LinkList title="Team Stats" rows={[{ label: "Points", value: String(summary.playerTeam.points) }, { label: "Reliability", value: `${summary.playerTeam.reliability}` }, { label: "Pace", value: `${summary.playerTeam.pace}` }, { label: "Season", value: String(summary.meta.seasonYear) }]} footerLink="Team stats" />
          </div>
          <LinkList title="Finances" rows={[{ label: "Budget", value: money.format(summary.playerTeam.budget) }, { label: "Save Difficulty", value: summary.meta.difficulty }, { label: "Last Played", value: new Date(summary.meta.lastPlayedAt).toLocaleString() }, { label: "Week", value: String(summary.meta.week) }, { label: "Save Name", value: summary.meta.name }]} footerLink="Team finances" />
        </div>

        <div className="space-y-3">
          <Headlines teamName={summary.playerTeam.name} headlines={summary.recentEvents} newsFeedHref={`/news?saveId=${saveId}`} />
          <LinkList title="Recent simulation events" rows={(summary.recentEvents.length ? summary.recentEvents : [{ message: "No events yet" }]).map((entry) => ({ label: entry.message }))} />
        </div>
      </div>
      <div className="mt-4"><DriverLineupTable drivers={drivers} rosterHref={`/roster?saveId=${saveId}`} /></div>
    </DashboardShell>
  );
}

function VisualSimPanel({ state, onStop }: { state: VisualSimState; onStop: () => void }) {
  const canStop = state.status === "running";
  const statusLabel =
    state.status === "complete"
      ? "Complete"
      : state.status === "stopped"
        ? "Stopped"
        : state.status === "stopping"
          ? "Stopping"
          : state.status === "error"
            ? "Error"
            : "Running";

  return (
    <section className="mb-4 rounded border border-emerald-700/60 bg-emerald-950/25 p-4 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{statusLabel}</p>
          <h2 className="mt-1 text-lg font-semibold">{SIM_MODE_LABEL[state.mode]}</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {state.completedRaces} / {state.targetRaces} race weekend{state.targetRaces === 1 ? "" : "s"} completed.
            {state.lastRaceName ? ` Latest: ${state.lastRaceName}.` : ""}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{state.message}</p>
          {canStop && state.targetRaces > 1 ? (
            <p className="mt-1 text-xs text-emerald-300/80">Auto-advancing one race at a time - Stop halts after the current race.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
          className="ui-interactive rounded border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-800/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop after current race
        </button>
      </div>
    </section>
  );
}

function DashboardWithSaveId() {
  const searchParams = useSearchParams();
  const saveId = searchParams.get("saveId");
  const simModeParam = searchParams.get("simMode");
  const simMode = isPlayThroughMode(simModeParam) ? simModeParam : null;
  const simRun = searchParams.get("simRun");
  return <DashboardPageContent key={saveId ?? ""} saveId={saveId} simMode={simMode} simRun={simRun} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-400"><div className="ui-section-enter w-full max-w-2xl space-y-2"><div className="ui-skeleton h-8 rounded-md" /><div className="ui-skeleton h-28 rounded-md" /></div></main>}>
      <DashboardWithSaveId />
    </Suspense>
  );
}
