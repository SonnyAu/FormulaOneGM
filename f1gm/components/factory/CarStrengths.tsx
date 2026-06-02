import { CarProfile } from "@/lib/sim/raceweekend/raceTypes";

const ATTRS: Array<{ key: keyof CarProfile; label: string }> = [
  { key: "topSpeed", label: "Top speed" },
  { key: "downforce", label: "Downforce" },
  { key: "mechanicalGrip", label: "Mechanical grip" },
  { key: "tireWear", label: "Tire wear" },
  { key: "reliability", label: "Reliability" },
  { key: "pitCrew", label: "Pit crew" },
];

function barColor(value: number): string {
  if (value >= 85) return "bg-emerald-500";
  if (value >= 72) return "bg-cyan-500";
  if (value >= 60) return "bg-yellow-400";
  return "bg-red-500";
}

export function CarStrengths({ car }: { car: CarProfile }) {
  const rated = ATTRS.map((a) => ({ ...a, value: car[a.key] as number }));
  const strongest = [...rated].sort((a, b) => b.value - a.value)[0];
  const weakest = [...rated].sort((a, b) => a.value - b.value)[0];

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-1 text-lg font-semibold">Car Strengths</h3>
      <p className="mb-3 text-xs text-zinc-400">
        Strongest at <span className="text-emerald-300">{strongest.label.toLowerCase()}</span>, weakest at{" "}
        <span className="text-red-300">{weakest.label.toLowerCase()}</span>.
      </p>
      <div className="space-y-2">
        {rated.map((a) => (
          <div key={a.key}>
            <div className="mb-0.5 flex justify-between text-xs text-zinc-400">
              <span>{a.label}</span>
              <span>{Math.round(a.value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
              <div className={`h-full ${barColor(a.value)}`} style={{ width: `${Math.max(0, Math.min(100, a.value))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
