"use client";

import { RosterDriverRow } from "@/lib/sim/selectors";

type RosterDriverCardProps = {
  driver: RosterDriverRow;
  badge?: string;
  onSwap?: () => void;
  swapBusy?: boolean;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-zinc-700 bg-[#222a35] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function RosterDriverCard({ driver, badge, onSwap, swapBusy }: RosterDriverCardProps) {
  return (
    <article className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-zinc-50">{driver.name}</h4>
            {badge ? (
              <span className="rounded bg-zinc-700/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                {badge}
              </span>
            ) : null}
            {driver.fromAcademy ? (
              <span className="rounded bg-cyan-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                Academy grad
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Age {driver.age} · {driver.nationality}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Overall</p>
          <p className="text-2xl font-bold text-cyan-200">{driver.overall}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Quali" value={driver.qualifying} />
        <Stat label="Race pace" value={driver.racePace} />
        <Stat label="Consistency" value={driver.consistency} />
        <Stat label="WDC pts" value={driver.championshipPoints} />
        <Stat label="Wins" value={driver.wins} />
        <Stat label="Podiums" value={driver.podiums} />
      </div>

      {onSwap ? (
        <button
          type="button"
          onClick={onSwap}
          disabled={swapBusy || !driver.canSwapWithReserve}
          className="ui-interactive mt-3 w-full rounded border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {swapBusy ? "Updating lineup…" : "Switch with reserve"}
        </button>
      ) : null}
    </article>
  );
}
