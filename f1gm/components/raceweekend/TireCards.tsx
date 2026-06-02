import { RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";
import { COMPOUND_LABEL, compoundBadgeClass, EntryView, healthColor } from "@/components/raceweekend/helpers";

type TireCardsProps = {
  weekend: RaceWeekendState;
  entryMap: Record<string, EntryView>;
};

export function TireCards({ weekend, entryMap }: TireCardsProps) {
  const race = weekend.race;
  if (!race) return null;

  const playerDrivers = race.drivers.filter((driver) => entryMap[driver.driverId]?.isPlayer);
  if (playerDrivers.length === 0) return null;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Your Tires</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {playerDrivers.map((driver) => {
          const entry = entryMap[driver.driverId];
          return (
            <div key={driver.driverId} className="rounded border border-zinc-700 bg-[#222a35] p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{entry?.name}</p>
                <span className={`rounded border px-1.5 py-0.5 text-xs font-bold ${compoundBadgeClass(driver.tire.compound)}`}>
                  {COMPOUND_LABEL[driver.tire.compound]}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                P{driver.position} · {driver.tire.ageLaps} laps · {driver.pitStops} stop{driver.pitStops === 1 ? "" : "s"} · {driver.paceMode}
              </p>
              <div className="mt-2">
                <div className="mb-0.5 flex justify-between text-xs text-zinc-400">
                  <span>Tire health</span>
                  <span>{Math.round(driver.tire.health)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
                  <div className={`h-full ${healthColor(driver.tire.health)}`} style={{ width: `${Math.max(0, Math.min(100, driver.tire.health))}%` }} />
                </div>
              </div>
              {driver.dnf ? <p className="mt-2 text-xs text-red-400">Retired{driver.dnfReason ? ` — ${driver.dnfReason}` : ""}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
