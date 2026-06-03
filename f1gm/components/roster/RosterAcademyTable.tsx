"use client";

import { AcademyViewRow } from "@/lib/sim/selectors";

type RosterAcademyTableProps = {
  rows: AcademyViewRow[];
};

export function RosterAcademyTable({ rows }: RosterAcademyTableProps) {
  if (rows.length === 0) {
    return <p className="text-zinc-500">No prospects in the pipeline.</p>;
  }

  return (
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
  );
}
