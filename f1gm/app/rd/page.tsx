"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { TeamManagement } from "@/lib/sim/selectors";

const RD_AREAS: Array<{ key: "aero" | "power" | "mechanical" | "reliability"; label: string }> = [
  { key: "aero", label: "Aero" },
  { key: "power", label: "Power" },
  { key: "mechanical", label: "Mechanical" },
  { key: "reliability", label: "Reliability" },
];

function RdBody() {
  const [data] = useState<TeamManagement | null>(() => {
    const result = simulationSession.getTeamManagement();
    return result.ok ? result.data : null;
  });

  if (!data) return <p className="text-zinc-400">Loading R&amp;D…</p>;

  const active = data.queue.filter((p) => !p.completed);
  const completed = data.queue.filter((p) => p.completed).slice(-8).reverse();

  return (
    <div className="space-y-4">
      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Department Ratings</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {RD_AREAS.map((area) => (
            <div key={area.key} className="rounded border border-zinc-700 bg-[#222a35] p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{area.label}</p>
              <p className="text-xl font-semibold text-cyan-200">{Math.round(data.rd[area.key])}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Active Projects</h3>
        {active.length === 0 ? (
          <p className="text-zinc-500">No upgrades in development. Commit a Weekend Plan in the Factory to start one.</p>
        ) : (
          <div className="space-y-2">
            {active.map((project) => (
              <div key={project.id}>
                <div className="mb-0.5 flex justify-between text-sm text-zinc-300">
                  <span className="capitalize">{project.area} upgrade (+{project.gain})</span>
                  <span>{Math.round(project.progress)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
                  <div className="h-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Recently Completed</h3>
        {completed.length === 0 ? (
          <p className="text-zinc-500">No completed upgrades yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-300">
            {completed.map((project) => (
              <li key={project.id} className="capitalize">
                {project.area} upgrade delivered (+{project.gain})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RdWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="R&D" title="Research & Development" subtitle="Upgrade pipeline">
      <RdBody />
    </ManagementFrame>
  );
}

export default function RdPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <RdWithSaveId />
    </Suspense>
  );
}
