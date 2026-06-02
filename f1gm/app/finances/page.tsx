"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame, money } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { TeamManagement } from "@/lib/sim/selectors";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-zinc-100";
  return (
    <div className="rounded border border-zinc-700 bg-[#222a35] p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function FinancesBody() {
  const [data] = useState<TeamManagement | null>(() => {
    const result = simulationSession.getTeamManagement();
    return result.ok ? result.data : null;
  });

  if (!data) return <p className="text-zinc-400">Loading finances…</p>;

  const weeklyNet = data.weeklyIncome + data.sponsors.basePayout - data.weeklyCosts;

  return (
    <div className="space-y-4">
      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Overview</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Budget" value={money.format(data.budget)} tone={data.budget > 0 ? "good" : "bad"} />
          <Stat label="Weekly income" value={money.format(data.weeklyIncome)} />
          <Stat label="Weekly costs" value={money.format(data.weeklyCosts)} />
          <Stat label="Weekly net" value={money.format(weeklyNet)} tone={weeklyNet >= 0 ? "good" : "bad"} />
        </div>
      </section>

      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Sponsors</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Title sponsor" value={data.sponsors.titleSponsor} />
          <Stat label="Base payout" value={money.format(data.sponsors.basePayout)} />
          <Stat label="Confidence" value={`${Math.round(data.sponsors.confidence)}%`} tone={data.sponsors.confidence >= 50 ? "good" : "bad"} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Sponsor risk is set in your Weekend Plan: chasing payouts boosts income at races but lowers confidence.
        </p>
      </section>
    </div>
  );
}

function FinancesWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Finances" title="Finances" subtitle="Budget & sponsors">
      <FinancesBody />
    </ManagementFrame>
  );
}

export default function FinancesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <FinancesWithSaveId />
    </Suspense>
  );
}
