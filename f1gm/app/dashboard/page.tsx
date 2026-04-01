"use client";

import Link from "next/link";
import { Suspense, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import {
  DriverLineupTable,
  StandingsTable,
} from "@/components/dashboard/DashboardTables";
import {
  Headlines,
  LinkList,
  RecordPanel,
} from "@/components/dashboard/DashboardWidgets";
import { driverMap } from "@/data/drivers";
import { abbreviateConstructorName, teams } from "@/data/teams";
import {
  formatCustomChassis,
  getTeamSelectionStorageServerSnapshot,
  getTeamSelectionStorageSnapshot,
  parseTeamSelectionRaw,
  subscribeTeamSelection,
} from "@/lib/teamSelection";
import { Driver, TeamSelection } from "@/types/f1";

const seasonYear = 2026;

function buildCustomDrivers(selection: TeamSelection): Driver[] {
  if (selection.mode !== "custom") {
    return [];
  }

  return [
    {
      id: `${selection.team.driverOne.toLowerCase().replace(/\s+/g, "-")}-01`,
      name: selection.team.driverOne,
      number: 27,
      nationality: "TBD",
    },
    {
      id: `${selection.team.driverTwo.toLowerCase().replace(/\s+/g, "-")}-02`,
      name: selection.team.driverTwo,
      number: 88,
      nationality: "TBD",
    },
  ];
}

function DashboardPageContent() {
  const searchParams = useSearchParams();

  const selectionRaw = useSyncExternalStore(
    subscribeTeamSelection,
    getTeamSelectionStorageSnapshot,
    getTeamSelectionStorageServerSnapshot,
  );

  const selection = useMemo(
    () => parseTeamSelectionRaw(selectionRaw),
    [selectionRaw],
  );

  const selectedExistingTeam = useMemo(() => {
    const teamIdFromQuery = searchParams.get("team");

    if (selection?.mode === "existing") {
      return teams.find((team) => team.id === selection.teamId) ?? null;
    }

    if (teamIdFromQuery && teamIdFromQuery !== "custom") {
      return teams.find((team) => team.id === teamIdFromQuery) ?? null;
    }

    return null;
  }, [selection, searchParams]);

  const chassisName =
    selection?.mode === "custom"
      ? formatCustomChassis(
          selection.team.chassisPrefix,
          selection.team.chassisNamingPattern,
          seasonYear,
        )
      : (selectedExistingTeam?.chassis ?? "—");

  const drivers = useMemo(() => {
    if (selection?.mode === "custom") {
      return buildCustomDrivers(selection);
    }

    if (!selectedExistingTeam) {
      return [];
    }

    return selectedExistingTeam.driverIds
      .map((driverId) => driverMap.get(driverId))
      .filter(
        (driver): driver is NonNullable<typeof driver> => driver !== undefined,
      );
  }, [selection, selectedExistingTeam]);

  const teamName =
    selection?.mode === "custom"
      ? selection.team.constructorName
      : (selectedExistingTeam?.entrant ?? "Unassigned Team");

  const teamNameAbbrev = useMemo(() => {
    if (selection?.mode === "custom") {
      return abbreviateConstructorName(selection.team.constructorName);
    }
    return selectedExistingTeam?.abbreviation ?? "—";
  }, [selection, selectedExistingTeam]);

  const constructorStandings = useMemo(() => {
    const base = teams.map((team, index) => ({
      pos: index + 1,
      team: team.abbreviation,
      pts: 0,
    }));
    if (!base.some((row) => row.team === teamNameAbbrev)) {
      return [
        ...base,
        { pos: base.length + 1, team: teamNameAbbrev, pts: 0 },
      ];
    }
    return base;
  }, [teamNameAbbrev]);

  const driverStandings = useMemo(() => {
    const rows: { pos: number; name: string; team: string; pts: number }[] =
      [];
    let pos = 1;
    for (const team of teams) {
      for (const driverId of team.driverIds) {
        const d = driverMap.get(driverId);
        if (d) {
          rows.push({
            pos: pos++,
            name: d.name,
            team: team.abbreviation,
            pts: 0,
          });
        }
      }
    }
    if (selection?.mode === "custom") {
      for (const d of buildCustomDrivers(selection)) {
        rows.push({
          pos: pos++,
          name: d.name,
          team: teamNameAbbrev,
          pts: 0,
        });
      }
    }
    return rows;
  }, [selection, teamNameAbbrev]);

  if (!selection && !selectedExistingTeam) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <h1 className="text-2xl font-semibold">No active career found</h1>
          <p className="mt-2 text-zinc-400">
            Choose a team first to generate your management dashboard.
          </p>
          <Link
            href="/team-setup"
            className="mt-4 inline-flex rounded bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            Go to Team Setup
          </Link>
        </section>
      </main>
    );
  }

  const leaderOne = drivers[0]?.name ?? "Lead Driver";
  const leaderTwo = drivers[1]?.name ?? "Second Driver";

  return (
    <DashboardShell
      title={`${teamName} Dashboard`}
      subtitle={`${seasonYear} preseason · Idle`}
      sidebar={<DashboardSidebar activeLabel="Dashboard" />}
    >
      <div className="grid gap-3 xl:grid-cols-[290px_1fr_340px]">
        <StandingsTable
          constructorStandings={constructorStandings}
          driverStandings={driverStandings}
          highlightedTeam={teamNameAbbrev}
        />

        <div className="space-y-3">
          <RecordPanel
            raceRecord="0-0"
            championshipPos="0 pts · preseason"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <LinkList
              title="Team Leaders"
              rows={[
                { label: `${leaderOne}  |  best finish`, value: "—" },
                { label: `${leaderTwo}  |  avg quali`, value: "—" },
                { label: `${leaderOne}  |  overtakes`, value: "0" },
              ]}
              footerLink="Full roster"
            />

            <LinkList
              title="Team Stats"
              rows={[
                { label: "Points", value: "0" },
                { label: "Allowed incidents", value: "0" },
                { label: "Avg pit stop", value: "—" },
                { label: "Chassis", value: chassisName },
              ]}
              footerLink="Team stats"
            />
          </div>

          <LinkList
            title="Finances"
            rows={[
              { label: "Budget (YTD)", value: "$160.0M" },
              { label: "Revenue (YTD)", value: "$0" },
              { label: "Profit (YTD)", value: "$0" },
              { label: "Cash", value: "$10M" },
              { label: "Payroll", value: "$21.2M" },
            ]}
            footerLink="Team finances"
          />
        </div>

        <div className="space-y-3">
          <Headlines teamName={teamName} />
          <LinkList
            title="Inbox"
            rows={[
              { label: "No urgent messages" },
              { label: "Simulator prep due before Round 1" },
              { label: "Board review scheduled for next week" },
            ]}
          />
        </div>
      </div>

      <div className="mt-3">
        <DriverLineupTable drivers={drivers} />
      </div>
    </DashboardShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-400">
          Loading dashboard…
        </main>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
