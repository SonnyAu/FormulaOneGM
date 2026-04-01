import { Driver, Team } from "@/types/f1";

type TeamCardProps = {
  team: Team;
  drivers: Driver[];
  selected: boolean;
  onSelect: (teamId: string) => void;
};

export function TeamCard({ team, drivers, selected, onSelect }: TeamCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(team.id)}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? "border-red-500 bg-zinc-900 shadow-[0_0_0_1px_rgba(239,68,68,0.45)]"
          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-400">Entrant</p>
          <h3 className="text-lg font-semibold text-zinc-50">{team.entrant}</h3>
        </div>
        {selected && (
          <span className="rounded border border-red-500/50 bg-red-950/60 px-2 py-1 text-xs text-red-200">
            Selected
          </span>
        )}
      </div>

      <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p>
          <span className="text-zinc-500">Constructor:</span> {team.constructor}
        </p>
        <p>
          <span className="text-zinc-500">Chassis:</span> {team.chassis}
        </p>
        <p className="sm:col-span-2">
          <span className="text-zinc-500">Power Unit:</span> {team.power_unit}
        </p>
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Driver Lineup</p>
        <ul className="space-y-1 text-sm text-zinc-100">
          {drivers.map((driver) => (
            <li key={driver.id} className="flex items-center justify-between gap-4">
              <span>{driver.name}</span>
              <span className="text-xs text-zinc-400">#{driver.number} · {driver.nationality}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}
