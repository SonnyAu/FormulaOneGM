import { RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";

const PHASE_LABEL: Record<string, string> = {
  practice: "Practice",
  qualifying: "Qualifying",
  race: "Race",
  complete: "Complete",
};

type PhaseHeaderProps = {
  weekend: RaceWeekendState;
};

export function PhaseHeader({ weekend }: PhaseHeaderProps) {
  const race = weekend.race;
  const safetyCar = race?.safetyCar.active;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Round {weekend.round} · {weekend.track.circuitName}</p>
          <h2 className="text-2xl font-semibold">{weekend.raceName}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Session</p>
            <p className="text-lg font-semibold text-cyan-200">{PHASE_LABEL[weekend.phase] ?? weekend.phase}</p>
          </div>
          {race ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Lap</p>
              <p className="text-lg font-semibold">{race.currentLap} / {race.totalLaps}</p>
            </div>
          ) : null}
          {safetyCar ? (
            <span className="rounded bg-yellow-500/20 px-3 py-1 text-sm font-semibold text-yellow-300">SAFETY CAR</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
