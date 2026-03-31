type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <article className="rounded border border-zinc-700 bg-[#1a222d] p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
      {hint ? <p className="mt-1 text-sm text-zinc-400">{hint}</p> : null}
    </article>
  );
}

type TwoColumnListProps = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

export function TwoColumnList({ title, rows }: TwoColumnListProps) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1a222d] p-4">
      <h3 className="text-xl font-semibold text-zinc-100">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-2 text-zinc-300">
            <span>{row.label}</span>
            <span className="font-medium text-zinc-100">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type HeadlinesProps = {
  teamName: string;
};

export function Headlines({ teamName }: HeadlinesProps) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1a222d] p-4">
      <h3 className="text-xl font-semibold text-zinc-100">League Headlines</h3>
      <div className="mt-3 space-y-2 text-sm text-zinc-300">
        <p className="rounded bg-cyan-900/30 px-3 py-2">{teamName} confirms preseason targets and opens simulator program.</p>
        <p>• FIA confirms power unit allocation windows for 2026 are now open.</p>
        <p>• Paddock update: first aero development checkpoint due after Round 4.</p>
      </div>
    </section>
  );
}
