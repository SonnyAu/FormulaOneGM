"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DriverLineupTable, StandingsTable } from "@/components/dashboard/DashboardTables";
import { Headlines, StatCard, TwoColumnList } from "@/components/dashboard/DashboardWidgets";
import { driverMap } from "@/data/drivers";
import { teams } from "@/data/teams";
import { formatCustomChassis, loadTeamSelection } from "@/lib/teamSelection";
import { Driver, TeamSelection } from "@/types/f1";

const seasonYear = 2026;

const defaultStandings = teams.slice(0, 8).map((team, index) => ({
  pos: index + 1,
  team: team.entrant,
  pts: Math.max(0, 164 - index * 18),
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

  const teamIdFromQuery = searchParams.get("team");

  const selectedExistingTeam = useMemo(() => {
    if (selection?.mode === "existing") {
      return teams.find((team) => team.id === selection.teamId) ?? null;
    }

    if (teamIdFromQuery && teamIdFromQuery !== "custom") {
      return teams.find((team) => team.id === teamIdFromQuery) ?? null;
    }

    return null;
  }, [selection, teamIdFromQuery]);

  const displayName =
    selection?.mode === "custom"
      ? selection.team.constructorName
      : selectedExistingTeam?.entrant ?? "Unassigned Team";

  const displayChassis =
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

  const highlightedStandings = defaultStandings.some((row) => row.team === displayName)
    ? defaultStandings
    : [...defaultStandings, { pos: defaultStandings.length + 1, team: displayName, pts: 6 }];

  return (
    <DashboardShell
      title={`${displayName} Dashboard`}
      subtitle={`${seasonYear} preseason · team operations`}
      sidebar={<DashboardSidebar />}
    >
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        <StandingsTable standings={highlightedStandings} highlightedTeam={displayName} />

        <div className="space-y-4">
          <StatCard label="Championship Position" value="P7" hint="Target: Top 5 after Round 6" />
          <StatCard label="Chassis" value={displayChassis} hint="Aero package v1 in progress" />
          <TwoColumnList
            title="Team Stats"
            rows={[
              { label: "Avg Qualifying", value: "P8.5" },
              { label: "Pit Stop Rank", value: "6th" },
              { label: "Reliability", value: "91%" },
            ]}
          />
        </div>

        <div className="space-y-4">
          <Headlines teamName={displayName} />
          <TwoColumnList
            title="Finances"
            rows={[
              { label: "Budget (YTD)", value: "$161.0M" },
              { label: "R&D Spend", value: "$28.4M" },
              { label: "Sponsor Confidence", value: "Stable" },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <DriverLineupTable drivers={drivers} />
        <TwoColumnList
          title="Inbox"
          rows={[
            { label: "Technical Director", value: "Wind tunnel slot booked" },
            { label: "Race Engineer", value: "Setup sim ready" },
            { label: "Board", value: "Review due before R2" },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
