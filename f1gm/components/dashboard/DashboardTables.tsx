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
    <section className="rounded border border-zinc-700 bg-[#1a222d] p-4">
      <h3 className="text-2xl font-semibold">Constructors Standings</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="pb-2">Pos</th>
            <th className="pb-2">Team</th>
            <th className="pb-2 text-right">PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.team} className={row.team === highlightedTeam ? "bg-cyan-900/30 text-cyan-200" : "text-zinc-300"}>
              <td className="border-t border-zinc-800 py-2">{row.pos}</td>
              <td className="border-t border-zinc-800 py-2">{row.team}</td>
              <td className="border-t border-zinc-800 py-2 text-right">{row.pts}</td>
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
    <section className="rounded border border-zinc-700 bg-[#1a222d] p-4">
      <h3 className="text-2xl font-semibold">Driver Lineup</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="pb-2">No.</th>
            <th className="pb-2">Driver</th>
            <th className="pb-2">Nat</th>
            <th className="pb-2 text-right">Contract</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver, idx) => (
            <tr key={driver.id} className="text-zinc-300">
              <td className="border-t border-zinc-800 py-2">#{driver.number}</td>
              <td className="border-t border-zinc-800 py-2">{driver.name}</td>
              <td className="border-t border-zinc-800 py-2">{driver.nationality}</td>
              <td className="border-t border-zinc-800 py-2 text-right">{idx === 0 ? "Lead Driver" : "Second Seat"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
