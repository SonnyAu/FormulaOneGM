import Link from "next/link";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ title, subtitle, sidebar, children }: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-[#151b24] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-700 bg-[#222b37]">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-4">
            <p className="font-semibold text-zinc-100">🏁 FormulaOneGM</p>
            <button className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-200">Play ▾</button>
            <div className="hidden text-sm text-zinc-400 md:block">{subtitle}</div>
          </div>

          <nav className="hidden items-center gap-4 text-sm text-zinc-300 md:flex">
            <button type="button" className="hover:text-white">League</button>
            <button type="button" className="hover:text-white">Team</button>
            <button type="button" className="hover:text-white">Drivers</button>
            <button type="button" className="hover:text-white">R&D</button>
            <Link href="/team-setup" className="hover:text-white">New Career</Link>
          </nav>
        </div>
      </header>

      <div className="grid lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-zinc-800 bg-[#1d2530]">{sidebar}</aside>
        <section className="px-4 py-5 lg:px-6">
          <h1 className="border-b border-zinc-700 pb-2 text-3xl font-semibold">{title}</h1>
          <div className="pt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
