import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <section className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/60 p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-red-400">F1 General Manager</p>
        <h1 className="mt-2 text-3xl font-semibold">2026 Team Setup Module</h1>
        <p className="mt-3 text-zinc-400">
          Configure your career start by selecting an existing constructor or creating a brand-new entry.
        </p>
        <Link
          href="/team-setup"
          className="mt-6 inline-flex rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
        >
          Go to Team Setup
        </Link>
      </section>
    </main>
  );
}
