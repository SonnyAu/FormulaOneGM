"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CarStrengths } from "@/components/factory/CarStrengths";
import { FacilityCards } from "@/components/factory/FacilityCards";
import { WeekendPlanForm } from "@/components/factory/WeekendPlanForm";
import { ManagementFrame, money } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { TeamManagement } from "@/lib/sim/selectors";
import { WeekendPlan } from "@/types/sim";
import { defaultWeekendPlan } from "@/lib/sim/subsystems/weekendPlan";

function readManagement(): TeamManagement | null {
  const result = simulationSession.getTeamManagement();
  return result.ok ? result.data : null;
}

function readRecommendation(): { plan: WeekendPlan; rationale: string } | null {
  const rec = simulationSession.getWeekendPlanRecommendation();
  return rec.ok ? rec.data : null;
}

function FactoryBody() {
  const [data, setData] = useState<TeamManagement | null>(readManagement);
  const [recommendation, setRecommendation] = useState<{ plan: WeekendPlan; rationale: string } | null>(readRecommendation);

  const refresh = () => {
    setData(readManagement());
    setRecommendation(readRecommendation());
  };

  if (!data) return <p className="text-zinc-400">Loading factory…</p>;

  const onCommit = (plan: WeekendPlan) => {
    simulationSession.commitWeekendPlan(plan);
    refresh();
  };

  return (
    <div className="space-y-4">
      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Budget</p>
            <p className="text-2xl font-semibold">{money.format(data.budget)}</p>
          </div>
          <p className="text-sm text-zinc-400">
            Next race: <span className="text-zinc-200">{data.nextRace?.name ?? "TBD"}</span>
            {data.pendingPlan ? <span className="ml-2 text-emerald-300">· Plan committed</span> : null}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <WeekendPlanForm
            initialPlan={data.pendingPlan ?? defaultWeekendPlan()}
            recommendation={recommendation}
            difficulty={data.difficulty}
            onCommit={onCommit}
          />
          <FacilityCards facilities={data.facilities} />
        </div>
        <CarStrengths car={data.effectiveCar} />
      </div>
    </div>
  );
}

function FactoryWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Factory" title="Factory" subtitle="Per-weekend development">
      <FactoryBody />
    </ManagementFrame>
  );
}

export default function FactoryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <FactoryWithSaveId />
    </Suspense>
  );
}
