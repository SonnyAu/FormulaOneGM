"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { AcademyViewRow } from "@/lib/sim/selectors";
import { simulationSession } from "@/lib/sim/session";

function AcademyBody() {
  const [rows] = useState<AcademyViewRow[] | null>(() => {
    const result = simulationSession.getAcademy();
    return result.ok ? result.data : [];
  });

  if (!rows) return <p className="text-zinc-400">Loading academy…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Academy prospects are promoted automatically when a seat opens at season rollover. Full training and scouting — in progress.
      </p>
      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Prospects</h3>
        {rows.length === 0 ? (
          <p className="text-zinc-500">No prospects in the pipeline.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-1">Driver</th>
                  <th className="pb-1">Age</th>
                  <th className="pb-1">Nation</th>
                  <th className="pb-1 text-right">Potential</th>
                  <th className="pb-1 text-right">Readiness</th>
                  <th className="pb-1 text-right">Overall</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.driverId} className={index === 0 ? "bg-cyan-900/20 text-cyan-100" : "text-zinc-300"}>
                    <td className="border-t border-zinc-800 py-1.5">
                      {row.name}
                      {index === 0 ? <span className="ml-2 text-xs text-cyan-400">Next in line</span> : null}
                    </td>
                    <td className="border-t border-zinc-800 py-1.5">{row.age}</td>
                    <td className="border-t border-zinc-800 py-1.5">{row.nationality}</td>
                    <td className="border-t border-zinc-800 py-1.5 text-right">{row.potential}</td>
                    <td className="border-t border-zinc-800 py-1.5 text-right">{row.readiness}</td>
                    <td className="border-t border-zinc-800 py-1.5 text-right">{row.overall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AcademyWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Academy" title="Academy" subtitle="Junior driver pipeline">
      <AcademyBody />
    </ManagementFrame>
  );
}

export default function AcademyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <AcademyWithSaveId />
    </Suspense>
  );
}
