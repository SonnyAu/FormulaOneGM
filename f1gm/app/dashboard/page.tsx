"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DriverLineupTable, StandingsTable } from "@/components/dashboard/DashboardTables";
import { Headlines, LinkList, RecordPanel } from "@/components/dashboard/DashboardWidgets";
import { driverMap } from "@/data/drivers";
import { teams } from "@/data/teams";
import { simulationSession } from "@/lib/sim/session";
import { DashboardSummary } from "@/types/sim";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type DashboardPageContentProps = {
  saveId: string | null;
};

function DashboardPageContent({ saveId }: DashboardPageContentProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [raceWeekendActive, setRaceWeekendActive] = useState(false);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const [driverRows, setDriverRows] = useState<{ driverId: string; name: string; teamAbbreviation: string; points: number }[]>([]);

  const refreshStandings = () => {
    const result = simulationSession.getStandings();
    setDriverRows(result.ok ? result.data.drivers : []);
  };

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
      setRaceWeekendActive(simulationSession.hasActiveRaceWeekend());
      const complete = simulationSession.isSeasonComplete();
      setSeasonComplete(complete.ok ? complete.data : false);
      refreshStandings();
      setSessionError(null);
    };

    void bootstrap();
  }, [saveId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === summary?.playerTeam.id) ?? null,
    [summary?.playerTeam],
  );

  const drivers = useMemo(() => {
    if (!selectedTeam) return [];
    return selectedTeam.driverIds
      .map((driverId) => driverMap.get(driverId))
      .filter((driver): driver is NonNullable<typeof driver> => driver !== undefined);
  }, [selectedTeam]);

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
    if (simulationSession.hasActiveRaceWeekend()) {
      router.push(`/race-weekend?saveId=${saveId}`);
      return;
    }
    setRaceWeekendActive(false);
    const complete = simulationSession.isSeasonComplete();
    setSeasonComplete(complete.ok ? complete.data : false);
  };

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
          <button type="button" onClick={onAdvanceWeek} className="ui-interactive rounded bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500">Advance week</button>
        )}
        <Link href="/" className="ui-interactive rounded border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500">Back to saves</Link>
        {sessionError && <p className="text-sm text-red-300">{sessionError}</p>}
        <p className="w-full text-xs text-zinc-500">
          Auto-save: weekly decisions are written to this device after a short delay; advancing the week saves immediately. Switching tabs flushes any pending save.
        </p>
      </div>
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
            <LinkList title="Team Leaders" rows={[{ label: `${drivers[0]?.name ?? "Lead Driver"}  |  best finish`, value: "—" }, { label: `${drivers[1]?.name ?? "Second Driver"}  |  avg quali`, value: "—" }, { label: `${drivers[0]?.name ?? "Lead Driver"}  |  overtakes`, value: "0" }]} footerLink="Full roster" />
            <LinkList title="Team Stats" rows={[{ label: "Points", value: String(summary.playerTeam.points) }, { label: "Reliability", value: `${summary.playerTeam.reliability}` }, { label: "Pace", value: `${summary.playerTeam.pace}` }, { label: "Season", value: String(summary.meta.seasonYear) }]} footerLink="Team stats" />
          </div>
          <LinkList title="Finances" rows={[{ label: "Budget", value: money.format(summary.playerTeam.budget) }, { label: "Save Difficulty", value: summary.meta.difficulty }, { label: "Last Played", value: new Date(summary.meta.lastPlayedAt).toLocaleString() }, { label: "Week", value: String(summary.meta.week) }, { label: "Save Name", value: summary.meta.name }]} footerLink="Team finances" />
        </div>

        <div className="space-y-3">
          <Headlines teamName={summary.playerTeam.name} headlines={summary.recentEvents} newsFeedHref={`/news?saveId=${saveId}`} />
          <LinkList title="Recent simulation events" rows={(summary.recentEvents.length ? summary.recentEvents : [{ message: "No events yet" }]).map((entry) => ({ label: entry.message }))} />
        </div>
      </div>
      <div className="mt-4"><DriverLineupTable drivers={drivers} /></div>
    </DashboardShell>
  );
}

function DashboardWithSaveId() {
  const searchParams = useSearchParams();
  const saveId = searchParams.get("saveId");
  return <DashboardPageContent key={searchParams.toString()} saveId={saveId} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-400"><div className="ui-section-enter w-full max-w-2xl space-y-2"><div className="ui-skeleton h-8 rounded-md" /><div className="ui-skeleton h-28 rounded-md" /></div></main>}>
      <DashboardWithSaveId />
    </Suspense>
  );
}
