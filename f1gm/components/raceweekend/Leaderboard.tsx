import { RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";
import { COMPOUND_LABEL, compoundBadgeClass, EntryView, formatGap } from "@/components/raceweekend/helpers";

type LeaderboardProps = {
  weekend: RaceWeekendState;
  entryMap: Record<string, EntryView>;
};

export function Leaderboard({ weekend, entryMap }: LeaderboardProps) {
  const race = weekend.race;
  if (!race) return null;

  const order = [...race.drivers].sort((a, b) => a.position - b.position);

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">P</th>
              <th className="pb-1">Driver</th>
              <th className="pb-1">Tire</th>
              <th className="pb-1 text-right">Age</th>
              <th className="pb-1 text-right">Stops</th>
              <th className="pb-1 text-right">Gap</th>
              <th className="pb-1 text-right">Pace</th>
            </tr>
          </thead>
          <tbody>
            {order.map((driver) => {
              const entry = entryMap[driver.driverId];
              const isPlayer = entry?.isPlayer;
              return (
                <tr
                  key={driver.driverId}
                  className={
                    driver.dnf
                      ? "text-zinc-600 line-through"
                      : isPlayer
                        ? "bg-cyan-900/30 text-cyan-100"
                        : "text-zinc-300"
                  }
                >
                  <td className="border-t border-zinc-800 py-1.5">{driver.dnf ? "DNF" : driver.position}</td>
                  <td className="border-t border-zinc-800 py-1.5">
                    <span className="font-medium">{entry?.name ?? driver.driverId}</span>
                    <span className="ml-1 text-xs text-zinc-500">{entry?.abbreviation}</span>
                    {driver.hasFastestLap ? <span className="ml-1 text-xs text-purple-300">FL</span> : null}
                  </td>
                  <td className="border-t border-zinc-800 py-1.5">
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-bold ${compoundBadgeClass(driver.tire.compound)}`}>
                      {COMPOUND_LABEL[driver.tire.compound]}
                    </span>
                  </td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{driver.tire.ageLaps}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">{driver.pitStops}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">
                    {driver.dnf ? "—" : driver.position === 1 ? "Leader" : formatGap(driver.gapToLeaderSeconds)}
                  </td>
                  <td className="border-t border-zinc-800 py-1.5 text-right text-xs">{driver.paceMode}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
