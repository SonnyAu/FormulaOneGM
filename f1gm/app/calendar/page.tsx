"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { CalendarRow } from "@/lib/sim/selectors";

function CalendarBody() {
  const [rows] = useState<CalendarRow[] | null>(() => {
    const result = simulationSession.getCalendar();
    return result.ok ? result.data : null;
  });

  if (!rows) return <p className="text-zinc-400">Loading calendar…</p>;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">2026 Calendar</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">Rd</th>
              <th className="pb-1">Grand Prix</th>
              <th className="pb-1 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.round}
                className={row.isNext ? "bg-cyan-900/30 text-cyan-100" : row.completed ? "text-zinc-500" : "text-zinc-300"}
              >
                <td className="border-t border-zinc-800 py-1.5">{row.round}</td>
                <td className="border-t border-zinc-800 py-1.5">{row.name}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right text-xs">
                  {row.completed ? "Completed" : row.isNext ? "Next" : "Upcoming"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CalendarWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Calendar" title="Calendar" subtitle="2026 season">
      <CalendarBody />
    </ManagementFrame>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <CalendarWithSaveId />
    </Suspense>
  );
}
