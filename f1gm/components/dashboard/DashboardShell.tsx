import Link from "next/link";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ title, subtitle, sidebar, children }: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-[#151a23] text-zinc-100">
      <header className="border-b border-zinc-700 bg-[#2a313c]">
        <div className="flex items-center justify-between gap-3 px-3 py-2 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-100"
              aria-label="Open menu"
            >
              ☰
            </button>
            <p className="font-semibold text-zinc-100">🏁 FormulaOneGM</p>
            <button type="button" className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
              Play ▾
            </button>
            <span className="hidden text-sm text-zinc-300 md:block">{subtitle}</span>
          </div>

          <nav className="hidden items-center gap-4 text-sm text-zinc-300 lg:flex">
            <button type="button" className="hover:text-white">League ▾</button>
            <button type="button" className="hover:text-white">Team ▾</button>
            <button type="button" className="hover:text-white">Drivers ▾</button>
            <button type="button" className="hover:text-white">Stats ▾</button>
            <button type="button" className="hover:text-white">Tools ▾</button>
            <Link href="/team-setup" className="hover:text-white">New Career</Link>
          </nav>
        </div>
      </header>

      <div className="grid lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-zinc-800 bg-[#222a35]">{sidebar}</aside>
        <section className="px-3 py-3 lg:px-4">
          <h1 className="border-b border-zinc-700 pb-2 text-4xl font-semibold leading-tight">{title}</h1>
          <div className="pt-4">{children}</div>
        </section>
      </div>
    </main>
  );
}
