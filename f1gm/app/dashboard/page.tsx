"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DriverLineupTable, StandingsTable } from "@/components/dashboard/DashboardTables";
import { Headlines, LinkList, RecordPanel } from "@/components/dashboard/DashboardWidgets";
import { driverMap } from "@/data/drivers";
import { teams } from "@/data/teams";
import { formatCustomChassis, loadTeamSelection } from "@/lib/teamSelection";
import { Driver, TeamSelection } from "@/types/f1";

const seasonYear = 2026;

const defaultStandings = teams.map((team, index) => ({
  pos: index + 1,
  team: team.entrant,
  pts: Math.max(0, 184 - index * 14),
}));

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

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<TeamSelection | null>(null);

  useEffect(() => {
    const stored = loadTeamSelection();
    if (stored) {
      setSelection(stored);
    }
  }, []);

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

  const teamName =
    selection?.mode === "custom"
      ? selection.team.constructorName
      : selectedExistingTeam?.entrant ?? "Unassigned Team";

  const chassisName =
    selection?.mode === "custom"
      ? formatCustomChassis(selection.team.chassisPrefix, selection.team.chassisNamingPattern, seasonYear)
      : selectedExistingTeam?.chassis ?? "—";

  const drivers = useMemo(() => {
    if (selection?.mode === "custom") {
      return buildCustomDrivers(selection);
    }

    if (!selectedExistingTeam) {
      return [];
    }

    return selectedExistingTeam.driverIds
      .map((driverId) => driverMap.get(driverId))
      .filter((driver): driver is NonNullable<typeof driver> => driver !== undefined);
  }, [selection, selectedExistingTeam]);

  if (!selection && !selectedExistingTeam) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
          <h1 className="text-2xl font-semibold">No active career found</h1>
          <p className="mt-2 text-zinc-400">Choose a team first to generate your management dashboard.</p>
          <Link href="/team-setup" className="mt-4 inline-flex rounded bg-red-600 px-4 py-2 text-sm font-medium text-white">
            Go to Team Setup
          </Link>
        </section>
      </main>
    );
  }

  const standings = defaultStandings.some((row) => row.team === teamName)
    ? defaultStandings
    : [...defaultStandings.slice(0, 10), { pos: 11, team: teamName, pts: 8 }];

  const leaderOne = drivers[0]?.name ?? "Lead Driver";
  const leaderTwo = drivers[1]?.name ?? "Second Driver";

  return (
    <DashboardShell
      title={`${teamName} Dashboard`}
      subtitle={`${seasonYear} preseason · Idle`}
      sidebar={<DashboardSidebar activeLabel="Dashboard" />}
    >
      <div className="grid gap-3 xl:grid-cols-[290px_1fr_340px]">
        <StandingsTable standings={standings} highlightedTeam={teamName} />

        <div className="space-y-3">
          <RecordPanel raceRecord="0-0" championshipPos="14th in championship" />

          <div className="grid gap-3 md:grid-cols-2">
            <LinkList
              title="Team Leaders"
              rows={[
                { label: `${leaderOne}  |  best finish`, value: "P6" },
                { label: `${leaderTwo}  |  avg quali`, value: "P11" },
                { label: `${leaderOne}  |  overtakes`, value: "9" },
              ]}
              footerLink="Full roster"
            />

            <LinkList
              title="Team Stats"
              rows={[
                { label: "Points", value: "0.0 (3rd target)" },
                { label: "Allowed incidents", value: "0.0 (safety target)" },
                { label: "Avg pit stop", value: "2.49s" },
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
