"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManagementFrame, money } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import type { TechnicalReview } from "@/lib/sim/selectors";

function readTechnicalReview(): TechnicalReview | null {
  const result = simulationSession.getTechnicalReview();
  return result.ok ? result.data : null;
}

function barColor(value: number) {
  if (value >= 86) return "bg-emerald-500";
  if (value >= 74) return "bg-cyan-500";
  if (value >= 62) return "bg-amber-500";
  return "bg-red-500";
}

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-200">{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-zinc-800">
        <div className={`h-full ${barColor(value)}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function TechnicalReviewBody({ saveId }: { saveId: string }) {
  const router = useRouter();
  const [data] = useState<TechnicalReview | null>(readTechnicalReview);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return <p className="text-zinc-400">Loading technical review...</p>;

  const startNextSeason = async () => {
    setBusy(true);
    setMessage(null);
    const step = simulationSession.completeOffseasonStep("technical-review");
    if (!step.ok) {
      setBusy(false);
      setMessage(step.error);
      return;
    }
    const result = await simulationSession.startNextSeason();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.push(`/dashboard?saveId=${saveId}`);
  };

  return (
    <div className="space-y-5">
      {message ? <p className="rounded border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-200">{message}</p> : null}

      <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">Team Technical Order</h3>
        <div className="overflow-hidden rounded border border-zinc-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#222a35] text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Pace</th>
                <th className="px-3 py-2">Reliability</th>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Facilities</th>
                <th className="px-3 py-2">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data.teams.map((team) => (
                <tr key={team.teamId}>
                  <td className="px-3 py-2 font-medium text-zinc-100">{team.name}</td>
                  <td className="px-3 py-2 text-zinc-300">{team.pace}</td>
                  <td className="px-3 py-2 text-zinc-300">{team.reliability}</td>
                  <td className="px-3 py-2 text-zinc-300">{team.staff}</td>
                  <td className="px-3 py-2 text-zinc-300">{team.facilities}</td>
                  <td className="px-3 py-2 text-zinc-400">{money.format(team.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.powerUnits.map((powerUnit) => (
          <article key={powerUnit.id} className="rounded border border-zinc-700 bg-[#1b232e] p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-100">{powerUnit.name}</h4>
                <p className="text-xs text-zinc-500">{powerUnit.engineName}</p>
              </div>
              <p className="text-xl font-semibold text-cyan-200">{powerUnit.overall}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RatingBar label="ICE" value={powerUnit.ice} />
              <RatingBar label="ERS" value={powerUnit.ers} />
              <RatingBar label="Reliability" value={powerUnit.reliability} />
              <RatingBar label="Integration" value={powerUnit.integration} />
            </div>
          </article>
        ))}
      </section>

      {data.reports.length > 0 ? (
        <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
          <h3 className="mb-3 text-lg font-semibold text-zinc-100">Latest Winter Reports</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {data.reports.map((report) => (
              <div key={`${report.seasonYear}-${report.teamId}`} className="rounded border border-zinc-700 bg-[#222a35] p-3">
                <p className="font-semibold text-zinc-100">{report.teamName}</p>
                <p className="mt-1 text-sm text-zinc-400">{report.headline}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded border border-zinc-700 bg-[#1b232e] p-4 text-sm text-zinc-400">
          Winter development reports will be generated as the new season starts.
        </p>
      )}

      <button
        type="button"
        onClick={() => void startNextSeason()}
        disabled={busy}
        className="ui-interactive rounded bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Starting season..." : `Start ${data.seasonYear + 1} season`}
      </button>
    </div>
  );
}

function TechnicalReviewWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Season Review" title="Technical Review" subtitle="Team development and power units">
      {saveId ? <TechnicalReviewBody saveId={saveId} /> : null}
    </ManagementFrame>
  );
}

export default function TechnicalReviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <TechnicalReviewWithSaveId />
    </Suspense>
  );
}
