"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { getStandings } from "@/lib/sim/selectors";

type Standings = ReturnType<typeof getStandings>;

function StandingsBody() {
  const [data] = useState<Standings | null>(() => {
    const result = simulationSession.getStandings();
    return result.ok ? result.data : null;
  });
  const [view, setView] = useState<"drivers" | "constructors">("drivers");

  if (!data) return <p className="text-zinc-400">Loading standings…</p>;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{view === "drivers" ? "World Drivers' Championship" : "Constructors' Championship"}</h3>
        <div className="inline-flex rounded border border-zinc-600 p-0.5 text-xs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "drivers"}
            onClick={() => setView("drivers")}
            className={view === "drivers" ? "rounded bg-zinc-700 px-2.5 py-1 text-zinc-100" : "ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"}
          >
            Drivers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "constructors"}
            onClick={() => setView("constructors")}
            className={view === "constructors" ? "rounded bg-zinc-700 px-2.5 py-1 text-zinc-100" : "ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"}
          >
            Constructors
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {view === "drivers" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-1">#</th>
                <th className="pb-1">Driver</th>
                <th className="pb-1">Team</th>
                <th className="pb-1 text-right">Wins</th>
                <th className="pb-1 text-right">Podiums</th>
                <th className="pb-1 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((row, index) => (
                <tr key={row.driverId} className="text-zinc-300">
                  <td className="border-t border-zinc-800 py-1.5">{index + 1}</td>
                  <td className="border-t border-zinc-800 py-1.5">{row.name}</td>
                  <td className="border-t border-zinc-800 py-1.5">{row.teamAbbreviation}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{row.wins}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{row.podiums}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-1">#</th>
                <th className="pb-1">Team</th>
                <th className="pb-1 text-right">Wins</th>
                <th className="pb-1 text-right">Podiums</th>
                <th className="pb-1 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.constructors.map((row, index) => (
                <tr key={row.teamId} className="text-zinc-300">
                  <td className="border-t border-zinc-800 py-1.5">{index + 1}</td>
                  <td className="border-t border-zinc-800 py-1.5">{row.name}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{row.wins}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{row.podiums}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function StandingsWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Standings" title="Standings" subtitle="Championship">
      <StandingsBody />
    </ManagementFrame>
  );
}

export default function StandingsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <StandingsWithSaveId />
    </Suspense>
  );
}
