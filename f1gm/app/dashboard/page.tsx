"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DriverLineupTable, StandingsTable } from "@/components/dashboard/DashboardTables";
import { Headlines, LinkList, RecordPanel } from "@/components/dashboard/DashboardWidgets";
import { driverMap } from "@/data/drivers";
import { abbreviateConstructorName, teams } from "@/data/teams";
import { simulationSession } from "@/lib/sim/session";
import {
  formatCustomChassis,
  getTeamSelectionStorageServerSnapshot,
  getTeamSelectionStorageSnapshot,
  parseTeamSelectionRaw,
  subscribeTeamSelection,
} from "@/lib/teamSelection";
import { Driver, TeamSelection } from "@/types/f1";
import { DashboardSummary } from "@/types/sim";

const seasonYear = 2026;

function buildCustomDrivers(selection: TeamSelection): Driver[] {
  if (selection.mode !== "custom") return [];
  return [
    { id: `${selection.team.driverOne.toLowerCase().replace(/\s+/g, "-")}-01`, name: selection.team.driverOne, number: 27, nationality: "TBD" },
    { id: `${selection.team.driverTwo.toLowerCase().replace(/\s+/g, "-")}-02`, name: selection.team.driverTwo, number: 88, nationality: "TBD" },
  ];
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const selectionRaw = useSyncExternalStore(
    subscribeTeamSelection,
    getTeamSelectionStorageSnapshot,
    getTeamSelectionStorageServerSnapshot,
  );

  const selection = useMemo(() => parseTeamSelectionRaw(selectionRaw), [selectionRaw]);

  const selectedExistingTeam = useMemo(() => {
    const teamIdFromQuery = searchParams.get("team");
    if (selection?.mode === "existing") return teams.find((team) => team.id === selection.teamId) ?? null;
    if (teamIdFromQuery && teamIdFromQuery !== "custom") return teams.find((team) => team.id === teamIdFromQuery) ?? null;
    return null;
  }, [selection, searchParams]);

  const chassisName =
    selection?.mode === "custom"
      ? formatCustomChassis(selection.team.chassisPrefix, selection.team.chassisNamingPattern, seasonYear)
      : (selectedExistingTeam?.chassis ?? "—");

  const drivers = useMemo(() => {
    if (selection?.mode === "custom") return buildCustomDrivers(selection);
    if (!selectedExistingTeam) return [];
    return selectedExistingTeam.driverIds
      .map((driverId) => driverMap.get(driverId))
      .filter((driver): driver is NonNullable<typeof driver> => driver !== undefined);
  }, [selection, selectedExistingTeam]);

  const teamName = selection?.mode === "custom" ? selection.team.constructorName : (selectedExistingTeam?.entrant ?? "Unassigned Team");

  const teamNameAbbrev = useMemo(() => {
    if (selection?.mode === "custom") return abbreviateConstructorName(selection.team.constructorName);
    return selectedExistingTeam?.abbreviation ?? "—";
  }, [selection, selectedExistingTeam]);

  useEffect(() => {
    if (!selection) return;

    const bootstrap = async () => {
      const savesResult = await simulationSession.getSaves();
      if (!savesResult.ok) {
        setSessionError(savesResult.error);
        return;
      }

      const firstSave = savesResult.data[0];
      const loadResult = firstSave
        ? await simulationSession.loadSave(firstSave.id)
        : await simulationSession.initializeSave(selection);

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
      setSessionError(null);
    };

    void bootstrap();
  }, [selection]);

  const constructorStandings = useMemo(() => {
    const fromSummary = summary?.standings.map((row, index) => ({ pos: index + 1, team: row.abbreviation, pts: row.points }));
    if (fromSummary?.length) return fromSummary;
    const base = teams.map((team, index) => ({ pos: index + 1, team: team.abbreviation, pts: 0 }));
    if (!base.some((row) => row.team === teamNameAbbrev)) return [...base, { pos: base.length + 1, team: teamNameAbbrev, pts: 0 }];
    return base;
  }, [summary, teamNameAbbrev]);

  const driverStandings = useMemo(() => {
    const rows: { pos: number; name: string; team: string; pts: number }[] = [];
    let pos = 1;
    for (const team of teams) {
      for (const driverId of team.driverIds) {
        const d = driverMap.get(driverId);
        if (d) rows.push({ pos: pos++, name: d.name, team: team.abbreviation, pts: 0 });
      }
    }
    if (selection?.mode === "custom") {
      for (const d of buildCustomDrivers(selection)) rows.push({ pos: pos++, name: d.name, team: teamNameAbbrev, pts: 0 });
    }
    return rows;
  }, [selection, teamNameAbbrev]);

  if (!selection && !selectedExistingTeam) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100"><section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center"><h1 className="text-2xl font-semibold">No active career found</h1><p className="mt-2 text-zinc-400">Choose a team first to generate your management dashboard.</p><Link href="/team-setup" className="mt-4 inline-flex rounded bg-red-600 px-4 py-2 text-sm font-medium text-white">Go to Team Setup</Link></section></main>;
  }

  const leaderOne = drivers[0]?.name ?? "Lead Driver";
  const leaderTwo = drivers[1]?.name ?? "Second Driver";

  const onAdvanceWeek = async () => {
    const result = await simulationSession.advanceWeek();
    if (!result.ok) {
      setSessionError(result.error);
      return;
    }
    setSummary(result.data);
  };

  const onSubmitDefaultDecision = () => {
    if (!summary) return;
    const result = simulationSession.submitPlayerDecision({
      teamId: summary.playerTeam.id,
      rdSpend: 1_050_000,
      reliabilitySpend: 420_000,
      facilitySpend: 360_000,
      staffSpend: 300_000,
      sponsorRisk: "balanced",
      focus: "aero",
      notes: "Default development allocation",
    });

    if (!result.ok) setSessionError(result.error);
  };

  return (
    <DashboardShell
      title={`${teamName} Dashboard`}
      subtitle={`${seasonYear} · Week ${summary?.meta.week ?? 1} · ${summary?.upcomingEvent?.name ?? "Preseason"}`}
      sidebar={<DashboardSidebar activeLabel="Dashboard" />}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={onSubmitDefaultDecision} className="rounded bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700">Submit default weekly decision</button>
        <button type="button" onClick={onAdvanceWeek} className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500">Advance week</button>
        {sessionError && <p className="text-sm text-red-300">{sessionError}</p>}
      </div>
      <div className="grid gap-3 xl:grid-cols-[290px_1fr_340px]">
        <StandingsTable constructorStandings={constructorStandings} driverStandings={driverStandings} highlightedTeam={teamNameAbbrev} />

        <div className="space-y-3">
          <RecordPanel raceRecord={`${summary?.playerTeam.points ?? 0} pts`} championshipPos={`${constructorStandings.findIndex((row) => row.team === (summary?.playerTeam.abbreviation ?? teamNameAbbrev)) + 1} place`} />
          <div className="grid gap-3 md:grid-cols-2">
            <LinkList title="Team Leaders" rows={[{ label: `${leaderOne}  |  best finish`, value: "—" }, { label: `${leaderTwo}  |  avg quali`, value: "—" }, { label: `${leaderOne}  |  overtakes`, value: "0" }]} footerLink="Full roster" />
            <LinkList title="Team Stats" rows={[{ label: "Points", value: String(summary?.playerTeam.points ?? 0) }, { label: "Reliability", value: `${summary?.playerTeam.reliability ?? 0}` }, { label: "Pace", value: `${summary?.playerTeam.pace ?? 0}` }, { label: "Chassis", value: chassisName }]} footerLink="Team stats" />
          </div>
          <LinkList title="Finances" rows={[{ label: "Budget", value: money.format(summary?.playerTeam.budget ?? 0) }, { label: "Revenue (YTD)", value: "Computed in sim" }, { label: "Profit (YTD)", value: "Computed in sim" }, { label: "Cash Flow", value: "Weekly checkpoint" }, { label: "Payroll", value: "In weekly costs" }]} footerLink="Team finances" />
        </div>

        <div className="space-y-3">
          <Headlines teamName={teamName} />
          <LinkList title="Recent simulation events" rows={(summary?.recentEvents.length ? summary.recentEvents : [{ message: "No events yet" }]).map((entry) => ({ label: entry.message }))} />
        </div>
      </div>
      <div className="mt-3"><DriverLineupTable drivers={drivers} /></div>
    </DashboardShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-400">Loading dashboard…</main>}>
      <DashboardPageContent />
    </Suspense>
  );
}
