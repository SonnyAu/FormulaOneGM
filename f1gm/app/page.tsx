"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { simulationSession } from "@/lib/sim/session";
import { SaveMetadata } from "@/types/sim";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function Home() {
  const router = useRouter();
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const loadSaves = async () => {
    const result = await simulationSession.getSaves();
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setSaves(result.data);
    setMessage(null);
  };

  useEffect(() => {
    void loadSaves();
  }, []);

  const onResume = async (saveId: string) => {
    const result = await simulationSession.loadSave(saveId);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    router.push(`/dashboard?saveId=${saveId}`);
  };

  const onDelete = async (saveId: string) => {
    const confirmed = window.confirm("Delete this save permanently?");
    if (!confirmed) return;

    await simulationSession.deleteSave(saveId);
    await loadSaves();
  };

  const onExport = async (saveId: string) => {
    const result = await simulationSession.exportSave(saveId);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const blob = new Blob([result.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `f1gm-save-${saveId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const serialized = await file.text();
    const result = await simulationSession.importSave(serialized);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setMessage(`Imported save: ${result.data.name}`);
    await loadSaves();
    event.target.value = "";
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-red-400">F1 General Manager</p>
          <h1 className="mt-2 text-3xl font-semibold">Career Saves</h1>
          <p className="mt-2 text-zinc-400">Select a local save to resume, or create a new team management career.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/team-setup" className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500">New Save</Link>
            <label className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:border-zinc-500">
              Import Save
              <input type="file" accept="application/json" className="hidden" onChange={onImport} />
            </label>
          </div>
        </header>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          {saves.length === 0 ? (
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-8 text-center">
              <p className="text-lg font-medium">No saves yet</p>
              <p className="mt-1 text-zinc-400">Create your first save to begin your career.</p>
              <Link href="/team-setup" className="mt-4 inline-flex rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">Create New Save</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-zinc-400">
                  <tr>
                    <th className="p-2">Save</th>
                    <th className="p-2">Team</th>
                    <th className="p-2">Season</th>
                    <th className="p-2">Week</th>
                    <th className="p-2">Difficulty</th>
                    <th className="p-2">Created</th>
                    <th className="p-2">Last Played</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {saves.map((save) => (
                    <tr key={save.id} className="border-t border-zinc-800">
                      <td className="p-2 font-medium text-zinc-100">{save.name}</td>
                      <td className="p-2">{save.playerTeamName}</td>
                      <td className="p-2">{save.seasonYear}</td>
                      <td className="p-2">{save.week}</td>
                      <td className="p-2 capitalize">{save.difficulty}</td>
                      <td className="p-2">{dateFormatter.format(new Date(save.createdAt))}</td>
                      <td className="p-2">{dateFormatter.format(new Date(save.lastPlayedAt))}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => onResume(save.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500">Resume</button>
                          <button type="button" onClick={() => onExport(save.id)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500">Export</button>
                          <button type="button" onClick={() => onDelete(save.id)} className="rounded border border-red-700 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {message ? <p className="mt-3 text-sm text-amber-300">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
