"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateTeamForm, type CustomTeamDraft } from "@/components/team/CreateTeamForm";
import { TeamList } from "@/components/team/TeamList";
import { teams } from "@/data/teams";

type ViewMode = "select" | "create";

const seasonYear = 2026;

function formatChassisCode(prefix: string, year: number, pattern: CustomTeamDraft["chassisNamingPattern"]) {
  if (pattern === "year-based") {
    return `${prefix}-${year.toString().slice(-2)}`;
  }

  return `${prefix} 01`;
}

export default function TeamSetupPage() {
  const [mode, setMode] = useState<ViewMode>("select");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [customTeam, setCustomTeam] = useState<CustomTeamDraft | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId],
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-red-400">F1 General Manager</p>
              <h1 className="mt-1 text-2xl font-semibold">Team Setup · {seasonYear} Season</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Start your save by selecting an existing constructor entry or build a new organization from scratch.
              </p>
            </div>
            <Link href="/" className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">
              Back to Home
            </Link>
          </div>

          <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`rounded px-4 py-2 text-sm transition ${
                mode === "select" ? "bg-red-600 text-white" : "text-zinc-300 hover:text-zinc-100"
              }`}
            >
              Select Existing Team
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`rounded px-4 py-2 text-sm transition ${
                mode === "create" ? "bg-red-600 text-white" : "text-zinc-300 hover:text-zinc-100"
              }`}
            >
              Create New Team
            </button>
          </div>
        </header>

        {mode === "select" ? (
          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div>
              <TeamList selectedTeamId={selectedTeamId} onSelectTeam={setSelectedTeamId} />
            </div>

            <aside className="h-fit rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Selection Status</p>
              {selectedTeam ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-zinc-300">You are managing:</p>
                  <p className="text-lg font-semibold text-zinc-100">{selectedTeam.entrant}</p>
                  <p className="text-zinc-400">Constructor: {selectedTeam.constructor}</p>
                  <p className="text-zinc-400">Chassis: {selectedTeam.chassis}</p>
                  <Link
                    href={`/dashboard?teamId=${selectedTeam.id}`}
                    className="mt-2 inline-flex rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
                  >
                    Start Career
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">Choose a team to continue.</p>
              )}
            </aside>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <CreateTeamForm seasonYear={seasonYear} onCreateTeam={setCustomTeam} />

            <aside className="h-fit rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Custom Team Preview</p>
              {customTeam ? (
                <div className="mt-3 space-y-2 text-sm text-zinc-300">
                  <p className="text-lg font-semibold text-zinc-100">{customTeam.constructorName}</p>
                  <p>Team Base: {customTeam.teamBase}</p>
                  <p>
                    Chassis: {formatChassisCode(
                      customTeam.chassisPrefix,
                      seasonYear,
                      customTeam.chassisNamingPattern,
                    )}
                  </p>
                  <p>
                    Drivers: {customTeam.driverOne} · {customTeam.driverTwo}
                  </p>
                  <Link
                    href={`/dashboard?entrant=${encodeURIComponent(customTeam.constructorName)}&constructor=${encodeURIComponent(customTeam.constructorName)}&chassis=${encodeURIComponent(formatChassisCode(customTeam.chassisPrefix, seasonYear, customTeam.chassisNamingPattern))}&powerUnit=${encodeURIComponent("Custom Power Unit")}&driverOne=${encodeURIComponent(customTeam.driverOne)}&driverTwo=${encodeURIComponent(customTeam.driverTwo)}`}
                    className="mt-2 inline-flex rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
                  >
                    Enter Championship
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  Fill in the form to stage your custom entry for the {seasonYear} championship.
                </p>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
