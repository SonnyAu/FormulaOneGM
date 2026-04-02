"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateTeamForm, type CustomTeamDraft } from "@/components/team/CreateTeamForm";
import { TeamList } from "@/components/team/TeamList";
import { teams } from "@/data/teams";
import { simulationSession } from "@/lib/sim/session";
import { formatCustomChassis } from "@/lib/teamSelection";
import { SaveDifficulty } from "@/types/sim";

type ViewMode = "select" | "create";

const seasonYear = 2026;

export default function TeamSetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("select");
  const [saveName, setSaveName] = useState("My New Career");
  const [difficulty, setDifficulty] = useState<SaveDifficulty>("standard");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [customTeam, setCustomTeam] = useState<CustomTeamDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId],
  );

  const startSave = async () => {
    if (isStarting) return;

    setError(null);
    if (!saveName.trim()) {
      setError("Save name is required.");
      return;
    }

    setIsStarting(true);
    const selection = mode === "select" && selectedTeamId
      ? { mode: "existing" as const, teamId: selectedTeamId }
      : customTeam
        ? { mode: "custom" as const, team: customTeam }
        : null;

    if (!selection) {
      setError("Select or create a team before starting your save.");
      setIsStarting(false);
      return;
    }

    try {
      const result = await simulationSession.initializeSave({
        selection,
        name: saveName,
        difficulty,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/dashboard?saveId=${result.data.id}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-red-400">F1 General Manager</p>
              <h1 className="mt-1 text-2xl font-semibold">New Save Setup · {seasonYear}</h1>
              <p className="mt-2 text-sm text-zinc-400">Create a local save slot, pick your team, and start your career.</p>
            </div>
            <Link href="/" className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">Back to Saves</Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-300">
              <span className="text-zinc-400">Save Name</span>
              <input value={saveName} onChange={(event) => setSaveName(event.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
            </label>
            <label className="space-y-1 text-sm text-zinc-300">
              <span className="text-zinc-400">Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SaveDifficulty)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
                <option value="easy">Easy</option>
                <option value="standard">Standard</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>

          <div className="mt-4 inline-flex rounded-md border border-zinc-700 bg-zinc-900 p-1">
            <button type="button" onClick={() => setMode("select")} className={`rounded px-4 py-2 text-sm transition ${mode === "select" ? "bg-red-600 text-white" : "text-zinc-300 hover:text-zinc-100"}`}>Select Existing Team</button>
            <button type="button" onClick={() => setMode("create")} className={`rounded px-4 py-2 text-sm transition ${mode === "create" ? "bg-red-600 text-white" : "text-zinc-300 hover:text-zinc-100"}`}>Create New Team</button>
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
                </div>
              ) : <p className="mt-2 text-sm text-zinc-400">Choose a team to continue.</p>}
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
                  <p>Chassis: {formatCustomChassis(customTeam.chassisPrefix, customTeam.chassisNamingPattern, seasonYear)}</p>
                  <p>Drivers: {customTeam.driverOne} · {customTeam.driverTwo}</p>
                </div>
              ) : <p className="mt-2 text-sm text-zinc-400">Fill in the form to stage your custom entry for the {seasonYear} championship.</p>}
            </aside>
          </section>
        )}

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <button type="button" onClick={startSave} disabled={isStarting} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70">{isStarting ? "Creating save..." : "Create Save & Enter Career"}</button>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
