import { RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";
import { COMPOUND_LABEL, EntryView } from "@/components/raceweekend/helpers";

type PitLogProps = {
  weekend: RaceWeekendState;
  entryMap: Record<string, EntryView>;
};

export function PitLog({ weekend, entryMap }: PitLogProps) {
  const pits = weekend.race?.pitEvents ?? [];
  const recent = [...pits].reverse();

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Pit Stop Log</h3>
      <div className="standings-scroll h-48 space-y-1 overflow-y-auto pr-1 text-sm">
        {recent.length === 0 ? (
          <p className="text-zinc-500">No stops yet.</p>
        ) : (
          recent.map((pit, index) => (
            <p key={`${pit.driverId}-${pit.lap}-${index}`} className="text-zinc-300">
              <span className="text-zinc-500">L{pit.lap}</span>{" "}
              {entryMap[pit.driverId]?.abbreviation ?? pit.driverId}{" "}
              {COMPOUND_LABEL[pit.fromCompound]}→{COMPOUND_LABEL[pit.toCompound]}{" "}
              <span className="text-zinc-400">{pit.stopTimeSeconds.toFixed(1)}s</span>
            </p>
          ))
        )}
      </div>
    </section>
  );
}
