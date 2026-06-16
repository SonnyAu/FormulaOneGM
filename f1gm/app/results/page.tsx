"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { RaceResultRow } from "@/lib/sim/selectors";

type DriverRow = NonNullable<RaceResultRow["driverFinishingOrder"]>[number];

function resultStatus(row: DriverRow): string {
  if (row.dnf) return "Retired";

  const notes = ["Finished"];
  if (row.penaltySeconds > 0) notes.push(`+${row.penaltySeconds}s penalty`);
  if (row.issueCount > 0) notes.push(`${row.issueCount} issue${row.issueCount === 1 ? "" : "s"}`);
  return notes.join(" | ");
}

function ResultsBody() {
  const [rows] = useState<RaceResultRow[] | null>(() => {
    const result = simulationSession.getRaceResults();
    return result.ok ? result.data : null;
  });

  if (!rows) return <p className="text-zinc-400">Loading results…</p>;
  if (rows.length === 0) return <p className="text-zinc-500">No races completed yet.</p>;

  return (
    <div className="space-y-4">
      {rows.map((race) => (
        <section key={race.round} className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
          <h3 className="mb-2 text-lg font-semibold">
            Round {race.round}: {race.raceName}
          </h3>
          <div className="overflow-x-auto">
            {race.driverFinishingOrder ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pb-1">P</th>
                    <th className="pb-1">Driver</th>
                    <th className="pb-1">Team</th>
                    <th className="pb-1 text-right">Pts</th>
                    <th className="pb-1 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {race.driverFinishingOrder.map((row) => (
                    <tr key={row.driverId} className="text-zinc-300">
                      <td className="border-t border-zinc-800 py-1.5">{row.dnf ? "DNF" : row.position}</td>
                      <td className="border-t border-zinc-800 py-1.5">
                        {row.name}
                        {row.hasFastestLap ? <span className="ml-1 text-xs text-purple-300">FL</span> : null}
                      </td>
                      <td className="border-t border-zinc-800 py-1.5">{row.teamAbbreviation}</td>
                      <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
                      <td className="border-t border-zinc-800 py-1.5 text-right text-xs">{resultStatus(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pb-1">P</th>
                    <th className="pb-1">Team</th>
                    <th className="pb-1 text-right">Pts</th>
                    <th className="pb-1 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {race.finishingOrder.map((row, index) => (
                    <tr key={row.teamId} className="text-zinc-300">
                      <td className="border-t border-zinc-800 py-1.5">{row.dnf ? "DNF" : index + 1}</td>
                      <td className="border-t border-zinc-800 py-1.5">{row.abbreviation}</td>
                      <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
                      <td className="border-t border-zinc-800 py-1.5 text-right text-xs">{row.dnf ? "Retired" : "Finished"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function ResultsWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Results" title="Race Results" subtitle="Completed rounds">
      <ResultsBody />
    </ManagementFrame>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <ResultsWithSaveId />
    </Suspense>
  );
}
