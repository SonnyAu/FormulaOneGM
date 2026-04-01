import { Driver } from "@/types/f1";

type ConstructorStanding = {
  pos: number;
  team: string;
  pts: number;
};

type StandingsTableProps = {
  standings: ConstructorStanding[];
  highlightedTeam: string;
};

export function StandingsTable({ standings, highlightedTeam }: StandingsTableProps) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1b232e] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Constructors</h3>
        <span className="text-xs text-amber-400">» Full standings</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-1">#</th>
            <th className="pb-1">Team</th>
            <th className="pb-1 text-right">PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr
              key={row.team}
              className={row.team === highlightedTeam ? "bg-cyan-900/30 text-cyan-200" : "text-zinc-300"}
            >
              <td className="border-t border-zinc-800 py-1.5">{row.pos}</td>
              <td className="border-t border-zinc-800 py-1.5">{row.team}</td>
              <td className="border-t border-zinc-800 py-1.5 text-right">{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type DriverLineupTableProps = {
  drivers: Driver[];
};

export function DriverLineupTable({ drivers }: DriverLineupTableProps) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1b232e] p-3">
      <h3 className="text-3xl font-semibold">Starting Lineup</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-1">No</th>
            <th className="pb-1">Name</th>
            <th className="pb-1">Role</th>
            <th className="pb-1">Nationality</th>
            <th className="pb-1 text-right">Contract</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver, idx) => (
            <tr key={driver.id} className="text-zinc-300">
              <td className="border-t border-zinc-800 py-1.5">#{driver.number}</td>
              <td className="border-t border-zinc-800 py-1.5">{driver.name}</td>
              <td className="border-t border-zinc-800 py-1.5">{idx === 0 ? "Lead" : "Wing"}</td>
              <td className="border-t border-zinc-800 py-1.5">{driver.nationality}</td>
              <td className="border-t border-zinc-800 py-1.5 text-right">{idx === 0 ? "to 2028" : "to 2027"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-amber-400">» Full roster</p>
    </section>
  );
}
