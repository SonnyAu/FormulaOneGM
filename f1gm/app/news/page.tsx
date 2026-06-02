"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { EventLogEntry } from "@/types/sim";

function NewsBody() {
  const [entries] = useState<EventLogEntry[] | null>(() => {
    const result = simulationSession.getNewsFeed(100);
    return result.ok ? result.data : [];
  });

  if (!entries) return <p className="text-zinc-400">Loading news…</p>;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">News Feed</h3>
      {entries.length === 0 ? (
        <p className="text-zinc-500">No headlines yet. Complete a race weekend to generate news.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <p className="text-sm text-zinc-200">{entry.message}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Week {entry.week} · {entry.category} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewsWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="News Feed" title="News Feed" subtitle="League headlines">
      <NewsBody />
    </ManagementFrame>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <NewsWithSaveId />
    </Suspense>
  );
}
