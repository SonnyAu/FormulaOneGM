type Facilities = { factory: number; cfd: number; simulator: number };

const FACILITY_INFO: Array<{ key: keyof Facilities; label: string; benefit: string }> = [
  { key: "factory", label: "Factory", benefit: "Faster upgrade delivery" },
  { key: "cfd", label: "CFD / Aero", benefit: "Better aero development" },
  { key: "simulator", label: "Simulator", benefit: "Sharper setups & prep" },
];

export function FacilityCards({ facilities }: { facilities: Facilities }) {
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Facilities</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {FACILITY_INFO.map((info) => {
          const level = facilities[info.key];
          return (
            <div key={info.key} className="rounded border border-zinc-700 bg-[#222a35] p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{info.label}</p>
                <span className="text-sm text-cyan-200">Lv {Math.round(level)}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">{info.benefit}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
                <div className="h-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(100, level))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-zinc-500">Invest in facilities via the Weekend Plan&apos;s &quot;facility upgrade&quot; option.</p>
    </section>
  );
}
